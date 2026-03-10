import type { AxiosInstance } from "axios";
import type { JiraIssueType } from "../types.js";

export async function fetchIssueTypesForProject(
  client: AxiosInstance,
  projectKey: string
): Promise<JiraIssueType[]> {
  const createmetaRes = await client.get<{ values?: JiraIssueType[] }>(
    `/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`
  );
  const fromCreatemeta = createmetaRes.data.values ?? [];
  if (fromCreatemeta.length > 0) return fromCreatemeta;

  try {
    const projectRes = await client.get<JiraIssueType[]>(
      `/issuetype/project?projectId=${encodeURIComponent(projectKey)}`
    );
    const fromProject = Array.isArray(projectRes.data) ? projectRes.data : [];
    if (fromProject.length > 0) return fromProject;
  } catch {
    // fallback to global
  }

  const globalRes = await client.get<JiraIssueType[]>(`/issuetype`);
  return Array.isArray(globalRes.data) ? globalRes.data : [];
}
