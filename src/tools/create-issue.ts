import type { AxiosInstance } from "axios";
import { z } from "zod";
import type { CreatedIssue } from "../types.js";
import { CreateIssueInputSchema, ResponseFormat } from "../schemas/issue.js";
import { handleJiraError } from "../services/jira-client.js";
import { fetchIssueTypesForProject } from "../services/jira-api.js";
import type {
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
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

async function resolveIssueTypeId(
  client: AxiosInstance,
  projectKey: string,
  issueType: string
): Promise<string> {
  if (/^\d+$/.test(issueType)) {
    return issueType;
  }

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

const TOOL_DESCRIPTION = `Create a new Jira issue in a project.

Creates an issue with the given project, summary, and issue type. Use jira_list_issue_types to discover valid issue types for a project.

Args:
  - project_key (string): Jira project key (e.g. PROJ)
  - summary (string): Issue title (required)
  - issue_type (string): Issue type name (e.g. Bug, Task) or numeric ID
  - description (string, optional): Issue description
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { "key": string, "id": string, "self": string }
  For Markdown: Summary with issue key and link

Examples:
  - Create a bug: project_key="PROJ", summary="Login fails", issue_type="Bug"
  - Create a task: project_key="DEMO", summary="Review docs", issue_type="Task"

Error Handling:
  - 401: Check JIRA_EMAIL and JIRA_API_TOKEN
  - 403: No create permission in project
  - 404: Project or issue type not found
  - 422: Validation error (e.g. missing required fields)`;

export function registerCreateIssueTool(
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
    "jira_create_issue",
    {
      title: "Create Jira Issue",
      description: TOOL_DESCRIPTION,
      inputSchema: {
        project_key: z
          .string()
          .min(1)
          .max(10)
          .regex(/^[A-Z][A-Z0-9]*$/)
          .describe("Jira project key"),
        summary: z.string().min(1).max(255).describe("Issue title"),
        issue_type: z.string().min(1).describe("Issue type name or ID"),
        description: z.string().max(32767).optional().describe("Optional description"),
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
        const { project_key, summary, issue_type, description, response_format } =
          CreateIssueInputSchema.parse(args);

        // Log start of operation
        await sendLog(extra, "info", `Creating issue in project ${project_key}...`);

        // Log issue type resolution
        await sendLog(extra, "debug", `Resolving issue type "${issue_type}"...`);
        const issueTypeId = await resolveIssueTypeId(client, project_key, issue_type);
        await sendLog(extra, "debug", `Resolved issue type to ID: ${issueTypeId}`);

        const fields: Record<string, unknown> = {
          project: { key: project_key },
          summary,
          issuetype: { id: issueTypeId },
        };

        if (description) {
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
        }

        // Log API call
        await sendLog(extra, "info", "Sending request to Jira API...");
        const response = await client.post<CreatedIssue>("/issue", {
          fields,
        });
        await sendLog(extra, "info", `Issue ${response.data.key} created successfully`);

        const result = {
          key: response.data.key,
          id: response.data.id,
          self: response.data.self,
        };

        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          textContent = [
            `# Issue Created`,
            "",
            `**Key:** ${result.key}`,
            `**ID:** ${result.id}`,
            `**URL:** ${result.self}`,
          ].join("\n");
        } else {
          textContent = JSON.stringify(result, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: textContent }],
          structuredContent: result,
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
