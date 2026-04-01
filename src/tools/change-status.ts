import type { AxiosInstance } from "axios";
import { z } from "zod";
import { ChangeStatusInputSchema, ResponseFormat } from "../schemas/issue.js";
import { handleJiraError } from "../services/jira-client.js";
import { fetchTransitionsForIssue } from "../services/jira-api.js";
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
 * Resolves a transition name or numeric ID to a validated transition ID.
 *
 * When a pure-numeric string is supplied it is returned as-is after confirming
 * it exists in the available transitions list (so callers always get a clear
 * error when an ID is stale or wrong).  Otherwise a case-insensitive name
 * match is performed.
 */
async function resolveTransitionId(
  client: AxiosInstance,
  issueKey: string,
  transitionName: string
): Promise<{ id: string; name: string; targetStatus: string }> {
  const transitions = await fetchTransitionsForIssue(client, issueKey);

  // Numeric ID path: verify the transition actually exists
  if (/^\d+$/.test(transitionName)) {
    const byId = transitions.find((t) => t.id === transitionName);
    if (!byId) {
      const available = transitions.map((t) => `${t.name} (id: ${t.id})`).join(", ");
      throw new Error(
        `Transition ID "${transitionName}" not found for issue ${issueKey}. Available: ${available || "none"}`
      );
    }
    return {
      id: byId.id,
      name: byId.name,
      targetStatus: byId.to?.name ?? transitionName,
    };
  }

  // Name path: case-insensitive match
  const byName = transitions.find((t) => t.name.toLowerCase() === transitionName.toLowerCase());
  if (!byName) {
    const available = transitions.map((t) => t.name).join(", ");
    throw new Error(
      `Transition "${transitionName}" not found for issue ${issueKey}. Available: ${available || "none"}`
    );
  }

  return {
    id: byName.id,
    name: byName.name,
    targetStatus: byName.to?.name ?? transitionName,
  };
}

const TOOL_DESCRIPTION = `Change the status of a Jira issue (CHANGE_STATUS).

Moves an issue through a workflow transition (e.g. from "To Do" to "In Progress",
or "In Progress" to "Done"). Uses the available transitions for the issue's
current status — invalid transitions are caught before the API call.

Args:
  - issue_key (string): Issue key (e.g. PROJ-123) or numeric ID
  - transition_name (string): Target transition name (e.g. 'In Progress', 'Done')
                              or numeric transition ID (e.g. '31')
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { "issue_key": string, "transition_id": string, "transition_name": string, "target_status": string }
  For Markdown: Confirmation with old and new status

Error Handling:
  - 400: Transition not valid for current status
  - 401: Check JIRA_EMAIL and JIRA_API_TOKEN
  - 403: No transition permission
  - 404: Issue not found`;

export function registerChangeStatusTool(
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
    "jira_change_status",
    {
      title: "Change Jira Issue Status",
      description: TOOL_DESCRIPTION,
      inputSchema: {
        issue_key: z.string().min(1).describe("Issue key or numeric ID"),
        transition_name: z.string().min(1).describe("Target transition name or numeric ID"),
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
        const { issue_key, transition_name, response_format } = ChangeStatusInputSchema.parse(args);

        await sendLog(extra, "info", `Changing status of issue ${issue_key}...`);

        // Resolve the transition name/ID to a validated transition
        await sendLog(extra, "debug", `Resolving transition "${transition_name}"...`);
        const resolved = await resolveTransitionId(client, issue_key, transition_name);
        await sendLog(extra, "debug", `Resolved transition "${resolved.name}" → ID ${resolved.id}`);

        // POST /rest/api/3/issue/{issueIdOrKey}/transitions
        await sendLog(extra, "info", "Sending transition request to Jira API...");
        await client.post(`/issue/${encodeURIComponent(issue_key)}/transitions`, {
          transition: { id: resolved.id },
        });

        await sendLog(
          extra,
          "info",
          `Issue ${issue_key} transitioned to "${resolved.targetStatus}"`
        );

        const resultData = {
          issue_key,
          transition_id: resolved.id,
          transition_name: resolved.name,
          target_status: resolved.targetStatus,
        };

        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          textContent = [
            `# Status Changed`,
            "",
            `**Key:** ${issue_key}`,
            `**Transition:** ${resolved.name}`,
            `**New Status:** ${resolved.targetStatus}`,
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
