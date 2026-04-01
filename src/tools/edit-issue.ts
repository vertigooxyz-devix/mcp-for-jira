import type { AxiosInstance } from "axios";
import { z } from "zod";
import { IssueDetailsResponseSchema } from "../schemas/jira-responses.js";
import { EditIssueInputSchema, ResponseFormat } from "../schemas/issue.js";
import { handleJiraError } from "../services/jira-client.js";
import { fetchIssueTypesForProject } from "../services/jira-api.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Sends a logging message notification to the client.
 * Silently skips if the client doesn't support logging.
 */
async function sendLog(
  extra: ToolExtra,
  level: "debug" | "info" | "warning" | "error",
  message: string
): Promise<void> {
  try {
    await extra.sendNotification({
      method: "notifications/message",
      params: { level, data: message },
    });
  } catch {
    // Client may not support logging - silently skip
  }
}

/**
 * Resolves an issue type name or numeric ID to a numeric string ID.
 * When a pure-numeric string is provided it is passed through directly.
 * Otherwise, the project's issue types are fetched and matched by name
 * (case-insensitive).  The project key is extracted from the issue key
 * (e.g. "PROJ" from "PROJ-42").
 */
async function resolveIssueTypeId(
  client: AxiosInstance,
  issueKey: string,
  issueType: string
): Promise<string> {
  if (/^\d+$/.test(issueType)) {
    return issueType;
  }

  // Derive the project key from the issue key (best-effort; works for standard keys)
  const projectKey = issueKey.replace(/-\d+$/, "");

  const types = await fetchIssueTypesForProject(client, projectKey);
  const match = types.find((t) => t.name.toLowerCase() === issueType.toLowerCase());

  if (!match) {
    const names = types.map((t) => t.name).join(", ");
    throw new Error(
      `Issue type "${issueType}" not found in project ${projectKey}. Available: ${names || "none"}`
    );
  }

  return match.id;
}

const TOOL_DESCRIPTION = `Edit an existing Jira issue (EDIT_TASK).

Updates one or more mutable fields on an existing issue. Supply only the fields
you want to change — unchanged fields are left untouched. At least one of
summary, description, or issue_type must be provided.

Args:
  - issue_key (string): Issue key (e.g. PROJ-123) or numeric ID to edit
  - summary (string, optional): New issue title/summary (max 255 chars)
  - description (string, optional): New issue description (replaces existing)
  - issue_type (string, optional): New issue type name or numeric ID
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { "key": string, "id": string, "self": string, "updated_fields": string[] }
  For Markdown: Confirmation with updated fields listed

Error Handling:
  - 400: Invalid field values
  - 401: Check JIRA_EMAIL and JIRA_API_TOKEN
  - 403: No edit permission for this issue
  - 404: Issue not found
  - 422: Field-level validation failure`;

export function registerEditIssueTool(
  server: {
    registerTool: (
      name: string,
      config: object,
      handler: (args: unknown, extra: ToolExtra) => Promise<object>
    ) => void;
  },
  client: AxiosInstance
): void {
  server.registerTool(
    "jira_edit_issue",
    {
      title: "Edit Jira Issue",
      description: TOOL_DESCRIPTION,
      inputSchema: {
        issue_key: z.string().min(1).describe("Issue key or numeric ID to edit"),
        summary: z.string().min(1).max(255).optional().describe("New issue title"),
        description: z.string().max(32767).optional().describe("New issue description"),
        issue_type: z.string().min(1).optional().describe("New issue type name or ID"),
        response_format: z
          .nativeEnum(ResponseFormat)
          .default(ResponseFormat.MARKDOWN)
          .describe("Output format"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args: unknown, extra: ToolExtra) => {
      try {
        const { issue_key, summary, description, issue_type, response_format } =
          EditIssueInputSchema.parse(args);

        await sendLog(extra, "info", `Editing issue ${issue_key}...`);

        // Build the fields payload — only include fields that were supplied
        const fields: Record<string, unknown> = {};
        const updatedFields: string[] = [];

        if (summary !== undefined) {
          fields.summary = summary;
          updatedFields.push("summary");
        }

        if (description !== undefined) {
          // Jira Cloud requires Atlassian Document Format for description
          fields.description = {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: description }],
              },
            ],
          };
          updatedFields.push("description");
        }

        if (issue_type !== undefined) {
          await sendLog(extra, "debug", `Resolving issue type "${issue_type}"...`);
          const issueTypeId = await resolveIssueTypeId(client, issue_key, issue_type);
          await sendLog(extra, "debug", `Resolved issue type to ID: ${issueTypeId}`);
          fields.issuetype = { id: issueTypeId };
          updatedFields.push("issuetype");
        }

        // PUT /rest/api/3/issue/{issueIdOrKey}  — Jira returns 204 No Content
        await sendLog(extra, "info", "Sending update request to Jira API...");
        await client.put(`/issue/${encodeURIComponent(issue_key)}`, { fields });

        // Fetch the updated issue to return current values to the caller
        await sendLog(extra, "debug", "Fetching updated issue details...");
        const getRes = await client.get(`/issue/${encodeURIComponent(issue_key)}`);
        const updated = IssueDetailsResponseSchema.parse(getRes.data);

        await sendLog(extra, "info", `Issue ${issue_key} updated successfully`);

        const resultData = {
          key: updated.key,
          id: updated.id,
          self: updated.self,
          updated_fields: updatedFields,
        };

        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          textContent = [
            `# Issue Updated`,
            "",
            `**Key:** ${updated.key}`,
            `**ID:** ${updated.id}`,
            `**URL:** ${updated.self}`,
            `**Updated fields:** ${updatedFields.join(", ")}`,
          ].join("\n");
        } else {
          textContent = JSON.stringify(resultData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: textContent }],
          structuredContent: resultData,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: handleJiraError(error),
            },
          ],
        };
      }
    }
  );
}
