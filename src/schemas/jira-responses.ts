import { z } from "zod";

/**
 * Zod response schemas matching Jira Cloud REST API v3 contracts.
 *
 * These schemas provide runtime validation of all API responses so that
 * unexpected shape changes from Jira surface as clear ZodErrors instead of
 * silent runtime failures deep in business logic.
 *
 * Reference: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */

// ---------------------------------------------------------------------------
// Shared / primitive schemas
// ---------------------------------------------------------------------------

/**
 * A Jira issue type as returned by:
 *  - GET /rest/api/3/issue/createmeta/{projectKey}/issuetypes  (inside `values[]`)
 *  - GET /rest/api/3/issuetype/project
 *  - GET /rest/api/3/issuetype
 *
 * Documented fields:
 *   id          – numeric string identifier
 *   name        – display name (e.g. "Bug", "Task")
 *   description – optional human-readable description
 *   self        – canonical REST URL for this resource
 *   iconUrl     – URL to the issue-type icon (may be absent on some instances)
 *   subtask     – whether this type represents a sub-task
 *   avatarId    – numeric avatar identifier (Cloud only, optional)
 *   hierarchyLevel – integer hierarchy level (optional)
 */
export const JiraIssueTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  self: z.string().url().optional(),
  iconUrl: z.string().optional(),
  subtask: z.boolean().optional(),
  avatarId: z.number().optional(),
  hierarchyLevel: z.number().optional(),
});

export type JiraIssueType = z.infer<typeof JiraIssueTypeSchema>;

// ---------------------------------------------------------------------------
// GET /rest/api/3/issue/createmeta/{projectKey}/issuetypes
// ---------------------------------------------------------------------------

/**
 * Paginated envelope returned by the createmeta issuetypes endpoint.
 * `values` defaults to an empty array when the key is absent, which handles
 * Jira returning `{}` for projects with no configured issue types.
 * The pagination fields are optional and only present on paginated responses.
 */
export const CreatemetaIssueTypesResponseSchema = z.object({
  values: z.array(JiraIssueTypeSchema).optional().default([]),
  maxResults: z.number().optional(),
  startAt: z.number().optional(),
  total: z.number().optional(),
});

export type CreatemetaIssueTypesResponse = z.infer<typeof CreatemetaIssueTypesResponseSchema>;

// ---------------------------------------------------------------------------
// GET /rest/api/3/issuetype/project  and  GET /rest/api/3/issuetype
// ---------------------------------------------------------------------------

/**
 * Both the project-scoped and global issuetype endpoints return a flat array
 * of issue type objects (no pagination envelope).
 */
export const IssueTypeListResponseSchema = z.array(JiraIssueTypeSchema);

export type IssueTypeListResponse = z.infer<typeof IssueTypeListResponseSchema>;

// ---------------------------------------------------------------------------
// POST /rest/api/3/issue
// ---------------------------------------------------------------------------

/**
 * Response body returned when an issue is successfully created.
 *
 * Documented fields:
 *   id   – internal numeric string identifier
 *   key  – project-scoped key (e.g. "PROJ-123")
 *   self – canonical REST URL for the new issue
 *   transition – optional transition outcome (included when a transition was
 *                applied during creation; ignored here with `.optional()`)
 */
export const CreatedIssueResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  self: z.string().url(),
  transition: z
    .object({
      status: z.number().optional(),
      errorCollection: z.object({ errorMessages: z.array(z.string()) }).optional(),
    })
    .optional(),
});

export type CreatedIssueResponse = z.infer<typeof CreatedIssueResponseSchema>;

// ---------------------------------------------------------------------------
// GET /rest/api/3/issue/{issueIdOrKey}/transitions
// ---------------------------------------------------------------------------

/**
 * A single workflow transition available for an issue.
 *
 * Documented fields:
 *   id   – numeric string identifier used when posting the transition
 *   name – human-readable name shown in the Jira UI (e.g. "In Progress")
 *   to   – the target status object after the transition is applied
 */
export const JiraTransitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  to: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      statusCategory: z
        .object({
          id: z.number().optional(),
          key: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type JiraTransition = z.infer<typeof JiraTransitionSchema>;

/**
 * Response envelope from GET /rest/api/3/issue/{issueIdOrKey}/transitions.
 * `transitions` defaults to an empty array when the key is absent.
 */
export const JiraTransitionsResponseSchema = z.object({
  transitions: z.array(JiraTransitionSchema).optional().default([]),
});

export type JiraTransitionsResponse = z.infer<typeof JiraTransitionsResponseSchema>;

// ---------------------------------------------------------------------------
// GET /rest/api/3/issue/{issueIdOrKey}  (fields subset used by edit tool)
// ---------------------------------------------------------------------------

/**
 * Minimal representation of an existing Jira issue returned by the issue
 * endpoint.  Only the fields that the edit and change-status tools need are
 * modelled here; extra fields from Jira are silently stripped (no `.strict()`).
 *
 * Documented fields:
 *   id     – internal numeric string identifier
 *   key    – project-scoped key (e.g. "PROJ-123")
 *   self   – canonical REST URL for this resource
 *   fields – nested object containing the mutable fields
 */
export const IssueDetailsResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  self: z.string().url(),
  fields: z
    .object({
      summary: z.string().optional(),
      status: z
        .object({
          id: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
      issuetype: z
        .object({
          id: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type IssueDetailsResponse = z.infer<typeof IssueDetailsResponseSchema>;
