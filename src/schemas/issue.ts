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
