import type { AxiosInstance } from "axios";
import { z } from "zod";
import { handleJiraError } from "../services/jira-client.js";
import { fetchIssueTypesForProject } from "../services/jira-api.js";
import { ListIssueTypesInputSchema, ResponseFormat } from "../schemas/issue.js";
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

const TOOL_DESCRIPTION = `List issue types available for a Jira project.

Use this tool to discover which issue types (e.g. Bug, Task, Story) can be used when creating issues in a project. Returns id, name, and description for each type.

Args:
  - project_key (string): Jira project key (e.g. PROJ, DEMO)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { "issue_types": [{ "id": string, "name": string, "description": string }] }
  For Markdown: Formatted list of issue types

Examples:
  - "What issue types can I create in project PROJ?" -> project_key="PROJ"
  - Use before jira_create_issue to get valid issue_type values

Error Handling:
  - 401: Check JIRA_EMAIL and JIRA_API_TOKEN
  - 403: Insufficient permissions for the project
  - 404: Project not found`;

export function registerListIssueTypesTool(
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
    "jira_list_issue_types",
    {
      title: "List Jira Issue Types",
      description: TOOL_DESCRIPTION,
      inputSchema: {
        project_key: z
          .string()
          .min(1)
          .max(10)
          .regex(/^[A-Z][A-Z0-9]*$/)
          .describe("Jira project key"),
        response_format: z
          .nativeEnum(ResponseFormat)
          .default(ResponseFormat.MARKDOWN)
          .describe("Output format"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args: unknown, extra: ToolExtra) => {
      try {
        const { project_key, response_format } = ListIssueTypesInputSchema.parse(args);

        // Log start of operation
        await sendLog(extra, "info", `Fetching issue types for project ${project_key}...`);

        const issueTypes = await fetchIssueTypesForProject(client, project_key);
        await sendLog(extra, "info", `Found ${issueTypes.length} issue type(s)`);

        const output = {
          issue_types: issueTypes.map((it) => ({
            id: it.id,
            name: it.name,
            description: it.description ?? "",
          })),
        };

        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          const lines = [`# Issue Types for ${project_key}`, ""];
          for (const it of issueTypes) {
            lines.push(`## ${it.name} (id: ${it.id})`);
            if (it.description) lines.push(it.description);
            lines.push("");
          }
          textContent = lines.join("\n");
        } else {
          textContent = JSON.stringify(output, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: textContent }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleJiraError(error) }],
        };
      }
    }
  );
}
