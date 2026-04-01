import { z } from "zod";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export const CreateIssueInputSchema = z
  .object({
    project_key: z
      .string()
      .min(1, "Project key is required")
      .max(10, "Project key must not exceed 10 characters")
      .regex(
        /^[A-Z][A-Z0-9]*$/,
        "Project key must be uppercase letters and numbers (e.g. PROJ, DEMO)"
      )
      .describe("Jira project key (e.g. PROJ, DEMO)"),
    summary: z
      .string()
      .min(1, "Summary is required")
      .max(255, "Summary must not exceed 255 characters")
      .describe("Issue title/summary"),
    issue_type: z
      .string()
      .min(1, "Issue type is required")
      .describe("Issue type name (e.g. Bug, Task, Story) or numeric ID"),
    description: z.string().max(32767).optional().describe("Optional issue description"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict();

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

export const ListIssueTypesInputSchema = z
  .object({
    project_key: z
      .string()
      .min(1, "Project key is required")
      .max(10, "Project key must not exceed 10 characters")
      .regex(/^[A-Z][A-Z0-9]*$/, "Project key must be uppercase letters and numbers (e.g. PROJ)")
      .describe("Jira project key"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict();

export type ListIssueTypesInput = z.infer<typeof ListIssueTypesInputSchema>;

// ---------------------------------------------------------------------------
// DELETE_TASK  —  DELETE /rest/api/3/issue/{issueIdOrKey}
// ---------------------------------------------------------------------------

/**
 * Validated inputs for the jira_delete_issue tool.
 *
 * `issue_key` accepts both the human-readable project-scoped key (e.g. PROJ-123)
 * and the internal numeric issue ID (e.g. "10042").
 * `delete_subtasks` mirrors Jira's `deleteSubtasks` query param; when true,
 * all child sub-tasks are removed along with the parent issue.
 */
export const DeleteIssueInputSchema = z
  .object({
    issue_key: z
      .string()
      .min(1, "Issue key is required")
      .describe("Issue key (e.g. PROJ-123) or numeric ID to delete"),
    delete_subtasks: z
      .boolean()
      .default(false)
      .describe("Also delete all sub-tasks of this issue (default: false)"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict();

export type DeleteIssueInput = z.infer<typeof DeleteIssueInputSchema>;

// ---------------------------------------------------------------------------
// EDIT_TASK  —  PUT /rest/api/3/issue/{issueIdOrKey}
// ---------------------------------------------------------------------------

/**
 * Validated inputs for the jira_edit_issue tool.
 *
 * All mutable fields are optional; callers supply only what they want to change.
 * At least one of summary, description, or issue_type must be provided — this
 * is enforced by the `.refine()` check so the tool never sends an empty update.
 */
export const EditIssueInputSchema = z
  .object({
    issue_key: z
      .string()
      .min(1, "Issue key is required")
      .describe("Issue key (e.g. PROJ-123) or numeric ID to edit"),
    summary: z
      .string()
      .min(1, "Summary must not be empty")
      .max(255, "Summary must not exceed 255 characters")
      .optional()
      .describe("New issue title/summary"),
    description: z
      .string()
      .max(32767)
      .optional()
      .describe("New issue description (replaces the existing one)"),
    issue_type: z
      .string()
      .min(1, "Issue type must not be empty")
      .optional()
      .describe("New issue type name (e.g. Bug, Task) or numeric ID"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict()
  .refine((data) => data.summary !== undefined || data.description !== undefined || data.issue_type !== undefined, {
    message: "At least one of summary, description, or issue_type must be provided",
  });

export type EditIssueInput = z.infer<typeof EditIssueInputSchema>;

// ---------------------------------------------------------------------------
// CHANGE_STATUS  —  POST /rest/api/3/issue/{issueIdOrKey}/transitions
// ---------------------------------------------------------------------------

/**
 * Validated inputs for the jira_change_status tool.
 *
 * `transition_name` accepts a human-readable transition name (e.g. "In Progress",
 * "Done") or the numeric transition ID as a string (e.g. "31").  The tool will
 * first fetch the available transitions for the issue and resolve the name to an
 * ID before calling the transitions endpoint.
 */
export const ChangeStatusInputSchema = z
  .object({
    issue_key: z
      .string()
      .min(1, "Issue key is required")
      .describe("Issue key (e.g. PROJ-123) or numeric ID"),
    transition_name: z
      .string()
      .min(1, "Transition name is required")
      .describe("Target status transition name (e.g. 'In Progress', 'Done') or numeric transition ID"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict();

export type ChangeStatusInput = z.infer<typeof ChangeStatusInputSchema>;
