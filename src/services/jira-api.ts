import type { AxiosInstance } from "axios";
import {
  CreatemetaIssueTypesResponseSchema,
  IssueTypeListResponseSchema,
  JiraTransitionsResponseSchema,
  type JiraIssueType,
  type JiraTransition,
} from "../schemas/jira-responses.js";

export async function fetchIssueTypesForProject(
  client: AxiosInstance,
  projectKey: string
): Promise<JiraIssueType[]> {
  // PRIMARY: GET /rest/api/3/issue/createmeta/{projectKey}/issuetypes
  const createmetaRes = await client.get(
    `/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`
  );
  const createmetaParsed = CreatemetaIssueTypesResponseSchema.parse(createmetaRes.data);
  const fromCreatemeta = createmetaParsed.values;
  if (fromCreatemeta.length > 0) return fromCreatemeta;

  try {
    // FALLBACK 1: GET /rest/api/3/issuetype/project?projectId={projectKey}
    const projectRes = await client.get(
      `/issuetype/project?projectId=${encodeURIComponent(projectKey)}`
    );
    const fromProject = IssueTypeListResponseSchema.parse(projectRes.data);
    if (fromProject.length > 0) return fromProject;
  } catch {
    // fallback to global
  }

  // FALLBACK 2: GET /rest/api/3/issuetype
  const globalRes = await client.get(`/issuetype`);
  return IssueTypeListResponseSchema.parse(globalRes.data);
}

// ---------------------------------------------------------------------------
// GET /rest/api/3/issue/{issueIdOrKey}/transitions
// ---------------------------------------------------------------------------

/**
 * Fetches all workflow transitions currently available for an issue.
 *
 * Jira only returns transitions that are valid from the issue's *current*
 * status, so the list is context-sensitive.  The response is validated
 * against `JiraTransitionsResponseSchema` and the inner `transitions` array
 * is returned directly.
 */
export async function fetchTransitionsForIssue(
  client: AxiosInstance,
  issueKey: string
): Promise<JiraTransition[]> {
  const res = await client.get(
    `/issue/${encodeURIComponent(issueKey)}/transitions`
  );
  const parsed = JiraTransitionsResponseSchema.parse(res.data);
  return parsed.transitions;
}
