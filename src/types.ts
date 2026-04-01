/**
 * Public TypeScript types for Jira API response shapes.
 *
 * These types are derived directly from the Zod response schemas in
 * `src/schemas/jira-responses.ts` so that the runtime-validated schema and
 * the static TypeScript type are always in sync — there is a single source of
 * truth.
 */
export type {
  JiraIssueType,
  CreatedIssueResponse as CreatedIssue,
  CreatemetaIssueTypesResponse as IssueTypesResponse,
  JiraTransition,
  JiraTransitionsResponse,
  IssueDetailsResponse,
} from "./schemas/jira-responses.js";
