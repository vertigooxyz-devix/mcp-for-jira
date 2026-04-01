export const createdIssueResponse = {
  id: "10000",
  key: "PROJ-123",
  self: "https://example.atlassian.net/rest/api/3/issue/10000",
};

export const issueTypesResponse = {
  values: [
    {
      id: "10001",
      name: "Bug",
      description: "A bug",
      self: "https://example.atlassian.net/rest/api/3/issuetype/10001",
    },
    {
      id: "10002",
      name: "Task",
      description: "A task",
      self: "https://example.atlassian.net/rest/api/3/issuetype/10002",
    },
    {
      id: "10003",
      name: "Story",
      description: "A user story",
      self: "https://example.atlassian.net/rest/api/3/issuetype/10003",
    },
  ],
};

// ---------------------------------------------------------------------------
// Fixtures for DELETE_TASK, EDIT_TASK, CHANGE_STATUS
// ---------------------------------------------------------------------------

/**
 * Minimal issue details response returned by GET /issue/{key}.
 * Used by the edit-issue tool after a successful PUT.
 */
export const issueDetailsResponse = {
  id: "10000",
  key: "PROJ-123",
  self: "https://example.atlassian.net/rest/api/3/issue/10000",
  fields: {
    summary: "Updated summary",
    status: { id: "10001", name: "In Progress" },
    issuetype: { id: "10001", name: "Bug" },
  },
};

/**
 * Available workflow transitions returned by
 * GET /issue/{key}/transitions.
 */
export const transitionsResponse = {
  transitions: [
    {
      id: "11",
      name: "To Do",
      to: { id: "10000", name: "To Do", statusCategory: { id: 2, key: "new", name: "To Do" } },
    },
    {
      id: "21",
      name: "In Progress",
      to: {
        id: "10001",
        name: "In Progress",
        statusCategory: { id: 4, key: "indeterminate", name: "In Progress" },
      },
    },
    {
      id: "31",
      name: "Done",
      to: { id: "10002", name: "Done", statusCategory: { id: 3, key: "done", name: "Done" } },
    },
  ],
};
