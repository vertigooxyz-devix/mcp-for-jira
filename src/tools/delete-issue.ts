import type { AxiosInstance } from "axios";
import { z } from "zod";
import { DeleteIssueInputSchema, ResponseFormat } from "../schemas/issue.js";
import { handleJiraError } from "../services/jira-client.js";
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

const TOOL_DESCRIPTION = `Delete an existing Jira issue (DELETE_TASK).

Permanently removes the specified issue from Jira. This action is irreversible.
Optionally also deletes all sub-tasks linked to the issue.

Args:
  - issue_key (string): Issue key (e.g. PROJ-123) or numeric issue ID to delete
  - delete_subtasks (boolean, optional): Delete sub-tasks too (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { "deleted": true, "issue_key": string }
  For Markdown: Confirmation message with issue key

Error Handling:
  - 400: Issue has subtasks and delete_subtasks is false
  - 401: Check JIRA_EMAIL and JIRA_API_TOKEN
  - 403: No delete permission for this issue
  - 404: Issue not found`;

export function registerDeleteIssueTool(
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
    "jira_delete_issue",
    {
      title: "Delete Jira Issue",
      description: TOOL_DESCRIPTION,
      inputSchema: {
        issue_key: z.string().min(1).describe("Issue key or numeric ID to delete"),
        delete_subtasks: z
          .boolean()
          .default(false)
          .describe("Also delete all sub-tasks (default: false)"),
        response_format: z
          .nativeEnum(ResponseFormat)
          .default(ResponseFormat.MARKDOWN)
          .describe("Output format"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args: unknown, extra: ToolExtra) => {
      try {
        const { issue_key, delete_subtasks, response_format } = DeleteIssueInputSchema.parse(args);

        await sendLog(extra, "info", `Deleting issue ${issue_key}...`);
        if (delete_subtasks) {
          await sendLog(extra, "debug", "Sub-tasks will also be deleted");
        }

        // DELETE /rest/api/3/issue/{issueIdOrKey}?deleteSubtasks=true|false
        await client.delete(`/issue/${encodeURIComponent(issue_key)}`, {
          params: { deleteSubtasks: delete_subtasks },
        });

        await sendLog(extra, "info", `Issue ${issue_key} deleted successfully`);

        const resultData = { deleted: true, issue_key };

        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          textContent = [
            `# Issue Deleted`,
            "",
            `**Key:** ${issue_key}`,
            `**Status:** Successfully deleted`,
            ...(delete_subtasks ? [`**Sub-tasks:** Also deleted`] : []),
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
