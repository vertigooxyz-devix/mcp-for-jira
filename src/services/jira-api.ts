import type { AxiosInstance } from "axios";
import {
  CreatemetaIssueTypesResponseSchema,
  IssueTypeListResponseSchema,
  type JiraIssueType,
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
