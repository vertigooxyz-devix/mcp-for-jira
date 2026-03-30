import { describe, it, expect } from "vitest";
import { CreateIssueInputSchema, ListIssueTypesInputSchema } from "../../src/schemas/issue.js";
import {
  JiraIssueTypeSchema,
  CreatemetaIssueTypesResponseSchema,
  IssueTypeListResponseSchema,
  CreatedIssueResponseSchema,
} from "../../src/schemas/jira-responses.js";

// ---------------------------------------------------------------------------
// Input schemas (existing tests, unchanged)
// ---------------------------------------------------------------------------

describe("CreateIssueInputSchema", () => {
  it("should accept valid input", () => {
    const result = CreateIssueInputSchema.parse({
      project_key: "PROJ",
      summary: "Test issue",
      issue_type: "Bug",
    });
    expect(result.project_key).toBe("PROJ");
    expect(result.summary).toBe("Test issue");
    expect(result.issue_type).toBe("Bug");
    expect(result.response_format).toBe("markdown");
  });

  it("should accept valid input with description", () => {
    const result = CreateIssueInputSchema.parse({
      project_key: "DEMO",
      summary: "Full issue",
      issue_type: "Task",
      description: "Some description",
    });
    expect(result.description).toBe("Some description");
  });

  it("should accept issue_type as numeric ID", () => {
    const result = CreateIssueInputSchema.parse({
      project_key: "PROJ",
      summary: "Test",
      issue_type: "10001",
    });
    expect(result.issue_type).toBe("10001");
  });

  it("should reject empty project_key", () => {
    expect(() =>
      CreateIssueInputSchema.parse({
        project_key: "",
        summary: "Test",
        issue_type: "Bug",
      })
    ).toThrow();
  });

  it("should reject invalid project_key format", () => {
    expect(() =>
      CreateIssueInputSchema.parse({
        project_key: "lowercase",
        summary: "Test",
        issue_type: "Bug",
      })
    ).toThrow();
  });

  it("should reject empty summary", () => {
    expect(() =>
      CreateIssueInputSchema.parse({
        project_key: "PROJ",
        summary: "",
        issue_type: "Bug",
      })
    ).toThrow();
  });

  it("should reject empty issue_type", () => {
    expect(() =>
      CreateIssueInputSchema.parse({
        project_key: "PROJ",
        summary: "Test",
        issue_type: "",
      })
    ).toThrow();
  });

  it("should reject extra fields", () => {
    expect(() =>
      CreateIssueInputSchema.parse({
        project_key: "PROJ",
        summary: "Test",
        issue_type: "Bug",
        extra: "field",
      })
    ).toThrow();
  });
});

describe("ListIssueTypesInputSchema", () => {
  it("should accept valid input", () => {
    const result = ListIssueTypesInputSchema.parse({
      project_key: "PROJ",
    });
    expect(result.project_key).toBe("PROJ");
    expect(result.response_format).toBe("markdown");
  });

  it("should accept response_format json", () => {
    const result = ListIssueTypesInputSchema.parse({
      project_key: "PROJ",
      response_format: "json",
    });
    expect(result.response_format).toBe("json");
  });

  it("should reject empty project_key", () => {
    expect(() =>
      ListIssueTypesInputSchema.parse({
        project_key: "",
      })
    ).toThrow();
  });

  it("should reject invalid project_key format", () => {
    expect(() =>
      ListIssueTypesInputSchema.parse({
        project_key: "invalid-key",
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// JiraIssueTypeSchema  — individual issue type object
// ---------------------------------------------------------------------------

describe("JiraIssueTypeSchema", () => {
  it("should accept a minimal issue type with only required fields", () => {
    const result = JiraIssueTypeSchema.parse({ id: "10001", name: "Bug" });
    expect(result.id).toBe("10001");
    expect(result.name).toBe("Bug");
    expect(result.description).toBeUndefined();
    expect(result.self).toBeUndefined();
    expect(result.iconUrl).toBeUndefined();
  });

  it("should accept a full issue type with all optional fields", () => {
    const input = {
      id: "10001",
      name: "Bug",
      description: "A software defect",
      self: "https://example.atlassian.net/rest/api/3/issuetype/10001",
      iconUrl: "https://example.atlassian.net/images/icons/bug.png",
      subtask: false,
      avatarId: 10303,
      hierarchyLevel: 0,
    };
    const result = JiraIssueTypeSchema.parse(input);
    expect(result).toMatchObject(input);
  });

  it("should accept a sub-task issue type", () => {
    const result = JiraIssueTypeSchema.parse({
      id: "10005",
      name: "Sub-task",
      subtask: true,
      hierarchyLevel: -1,
    });
    expect(result.subtask).toBe(true);
    expect(result.hierarchyLevel).toBe(-1);
  });

  it("should accept unknown extra fields (passthrough behaviour)", () => {
    // Zod by default strips unknown keys but does not throw — verify no error
    expect(() =>
      JiraIssueTypeSchema.parse({
        id: "1",
        name: "Task",
        someNewJiraField: "future-value",
      })
    ).not.toThrow();
  });

  it("should reject a missing id", () => {
    expect(() => JiraIssueTypeSchema.parse({ name: "Bug" })).toThrow();
  });

  it("should reject a missing name", () => {
    expect(() => JiraIssueTypeSchema.parse({ id: "10001" })).toThrow();
  });

  it("should reject a non-string id", () => {
    expect(() => JiraIssueTypeSchema.parse({ id: 10001, name: "Bug" })).toThrow();
  });

  it("should reject an invalid self URL", () => {
    expect(() => JiraIssueTypeSchema.parse({ id: "1", name: "Bug", self: "not-a-url" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CreatemetaIssueTypesResponseSchema  — GET /issue/createmeta/.../issuetypes
// ---------------------------------------------------------------------------

describe("CreatemetaIssueTypesResponseSchema", () => {
  it("should accept a response with an empty values array", () => {
    const result = CreatemetaIssueTypesResponseSchema.parse({ values: [] });
    expect(result.values).toHaveLength(0);
  });

  it("should accept a full paginated response", () => {
    const input = {
      values: [
        { id: "10001", name: "Bug", description: "A bug" },
        { id: "10002", name: "Task" },
      ],
      maxResults: 50,
      startAt: 0,
      total: 2,
    };
    const result = CreatemetaIssueTypesResponseSchema.parse(input);
    expect(result.values).toHaveLength(2);
    expect(result.maxResults).toBe(50);
    expect(result.total).toBe(2);
  });

  it("should accept a response without pagination fields", async () => {
    const result = CreatemetaIssueTypesResponseSchema.parse({
      values: [{ id: "10001", name: "Bug" }],
    });
    expect(result.startAt).toBeUndefined();
    expect(result.total).toBeUndefined();
  });

  it("should default values to empty array when values key is absent", () => {
    // Jira returns {} for projects with no configured issue types
    const result = CreatemetaIssueTypesResponseSchema.parse({});
    expect(result.values).toEqual([]);
  });

  it("should reject a response where values is not an array", () => {
    expect(() => CreatemetaIssueTypesResponseSchema.parse({ values: "not-an-array" })).toThrow();
  });

  it("should reject a response where a value item is malformed", () => {
    expect(() =>
      CreatemetaIssueTypesResponseSchema.parse({
        values: [{ name: "Bug" }], // missing id
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// IssueTypeListResponseSchema  — GET /issuetype/project  &  GET /issuetype
// ---------------------------------------------------------------------------

describe("IssueTypeListResponseSchema", () => {
  it("should accept an empty array", () => {
    const result = IssueTypeListResponseSchema.parse([]);
    expect(result).toHaveLength(0);
  });

  it("should accept an array of valid issue types", () => {
    const input = [
      { id: "10001", name: "Bug", description: "A bug" },
      { id: "10002", name: "Task" },
      { id: "10003", name: "Story", self: "https://x.atlassian.net/rest/api/3/issuetype/10003" },
    ];
    const result = IssueTypeListResponseSchema.parse(input);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Bug");
    expect(result[2].self).toContain("issuetype");
  });

  it("should reject a plain object instead of array", () => {
    expect(() => IssueTypeListResponseSchema.parse({ id: "1", name: "Bug" })).toThrow();
  });

  it("should reject an array containing an item without id", () => {
    expect(() => IssueTypeListResponseSchema.parse([{ name: "Bug" }])).toThrow();
  });

  it("should reject an array containing an item without name", () => {
    expect(() => IssueTypeListResponseSchema.parse([{ id: "10001" }])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CreatedIssueResponseSchema  — POST /rest/api/3/issue
// ---------------------------------------------------------------------------

describe("CreatedIssueResponseSchema", () => {
  it("should accept a minimal valid response", () => {
    const input = {
      id: "10000",
      key: "PROJ-123",
      self: "https://example.atlassian.net/rest/api/3/issue/10000",
    };
    const result = CreatedIssueResponseSchema.parse(input);
    expect(result.id).toBe("10000");
    expect(result.key).toBe("PROJ-123");
    expect(result.self).toBe("https://example.atlassian.net/rest/api/3/issue/10000");
    expect(result.transition).toBeUndefined();
  });

  it("should accept a response with an optional transition field", () => {
    const input = {
      id: "10001",
      key: "DEMO-42",
      self: "https://example.atlassian.net/rest/api/3/issue/10001",
      transition: {
        status: 200,
        errorCollection: { errorMessages: [] },
      },
    };
    const result = CreatedIssueResponseSchema.parse(input);
    expect(result.transition?.status).toBe(200);
    expect(result.transition?.errorCollection?.errorMessages).toHaveLength(0);
  });

  it("should accept a response with only a partial transition field", () => {
    const input = {
      id: "10002",
      key: "TEST-1",
      self: "https://example.atlassian.net/rest/api/3/issue/10002",
      transition: {},
    };
    const result = CreatedIssueResponseSchema.parse(input);
    expect(result.transition).toBeDefined();
    expect(result.transition?.status).toBeUndefined();
  });

  it("should reject a response missing id", () => {
    expect(() =>
      CreatedIssueResponseSchema.parse({
        key: "PROJ-1",
        self: "https://example.atlassian.net/rest/api/3/issue/1",
      })
    ).toThrow();
  });

  it("should reject a response missing key", () => {
    expect(() =>
      CreatedIssueResponseSchema.parse({
        id: "1",
        self: "https://example.atlassian.net/rest/api/3/issue/1",
      })
    ).toThrow();
  });

  it("should reject a response missing self", () => {
    expect(() => CreatedIssueResponseSchema.parse({ id: "1", key: "PROJ-1" })).toThrow();
  });

  it("should reject a response where self is not a valid URL", () => {
    expect(() =>
      CreatedIssueResponseSchema.parse({ id: "1", key: "PROJ-1", self: "not-a-url" })
    ).toThrow();
  });

  it("should reject a response where id is not a string", () => {
    expect(() =>
      CreatedIssueResponseSchema.parse({
        id: 10000,
        key: "PROJ-1",
        self: "https://example.atlassian.net/rest/api/3/issue/1",
      })
    ).toThrow();
  });
});
