export interface CreatedIssue {
  id: string;
  key: string;
  self: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  self?: string;
  iconUrl?: string;
}

export interface IssueTypesResponse {
  values: JiraIssueType[];
}
