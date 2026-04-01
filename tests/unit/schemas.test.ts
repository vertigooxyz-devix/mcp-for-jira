import { describe, it, expect } from "vitest";
import {
  CreateIssueInputSchema,
  ListIssueTypesInputSchema,
  DeleteIssueInputSchema,
  EditIssueInputSchema,
  ChangeStatusInputSchema,
} from "../../src/schemas/issue.js";
import {
  JiraIssueTypeSchema,
  CreatemetaIssueTypesResponseSchema,
  IssueTypeListResponseSchema,
  CreatedIssueResponseSchema,
  JiraTransitionSchema,
  JiraTransitionsResponseSchema,
  IssueDetailsResponseSchema,
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

// ---------------------------------------------------------------------------
// DeleteIssueInputSchema
// ---------------------------------------------------------------------------

describe("DeleteIssueInputSchema", () => {
  it("should accept a minimal valid input", () => {
    const result = DeleteIssueInputSchema.parse({ issue_key: "PROJ-123" });
    expect(result.issue_key).toBe("PROJ-123");
    expect(result.delete_subtasks).toBe(false);
    expect(result.response_format).toBe("markdown");
  });

  it("should accept delete_subtasks: true", () => {
    const result = DeleteIssueInputSchema.parse({
      issue_key: "PROJ-123",
      delete_subtasks: true,
    });
    expect(result.delete_subtasks).toBe(true);
  });

  it("should accept a numeric issue ID string", () => {
    const result = DeleteIssueInputSchema.parse({ issue_key: "10042" });
    expect(result.issue_key).toBe("10042");
  });

  it("should accept response_format json", () => {
    const result = DeleteIssueInputSchema.parse({
      issue_key: "PROJ-1",
      response_format: "json",
    });
    expect(result.response_format).toBe("json");
  });

  it("should reject empty issue_key", () => {
    expect(() => DeleteIssueInputSchema.parse({ issue_key: "" })).toThrow();
  });

  it("should reject extra fields (strict mode)", () => {
    expect(() =>
      DeleteIssueInputSchema.parse({ issue_key: "PROJ-1", unexpected: "field" })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// EditIssueInputSchema
// ---------------------------------------------------------------------------

describe("EditIssueInputSchema", () => {
  it("should accept input with only summary changed", () => {
    const result = EditIssueInputSchema.parse({
      issue_key: "PROJ-123",
      summary: "New title",
    });
    expect(result.summary).toBe("New title");
    expect(result.description).toBeUndefined();
    expect(result.issue_type).toBeUndefined();
  });

  it("should accept input with only description changed", () => {
    const result = EditIssueInputSchema.parse({
      issue_key: "PROJ-123",
      description: "Updated description",
    });
    expect(result.description).toBe("Updated description");
  });

  it("should accept input with only issue_type changed", () => {
    const result = EditIssueInputSchema.parse({
      issue_key: "PROJ-123",
      issue_type: "Task",
    });
    expect(result.issue_type).toBe("Task");
  });

  it("should accept all three fields simultaneously", () => {
    const result = EditIssueInputSchema.parse({
      issue_key: "PROJ-123",
      summary: "Title",
      description: "Desc",
      issue_type: "Bug",
    });
    expect(result.summary).toBe("Title");
    expect(result.description).toBe("Desc");
    expect(result.issue_type).toBe("Bug");
  });

  it("should accept numeric issue_type ID", () => {
    const result = EditIssueInputSchema.parse({
      issue_key: "PROJ-123",
      issue_type: "10001",
    });
    expect(result.issue_type).toBe("10001");
  });

  it("should default response_format to markdown", () => {
    const result = EditIssueInputSchema.parse({
      issue_key: "PROJ-1",
      summary: "x",
    });
    expect(result.response_format).toBe("markdown");
  });

  it("should reject when no mutable field is provided", () => {
    expect(() =>
      EditIssueInputSchema.parse({ issue_key: "PROJ-123" })
    ).toThrow();
  });

  it("should reject empty issue_key", () => {
    expect(() =>
      EditIssueInputSchema.parse({ issue_key: "", summary: "x" })
    ).toThrow();
  });

  it("should reject summary exceeding 255 characters", () => {
    expect(() =>
      EditIssueInputSchema.parse({
        issue_key: "PROJ-1",
        summary: "x".repeat(256),
      })
    ).toThrow();
  });

  it("should reject extra fields (strict mode)", () => {
    expect(() =>
      EditIssueInputSchema.parse({
        issue_key: "PROJ-1",
        summary: "x",
        notAllowed: true,
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ChangeStatusInputSchema
// ---------------------------------------------------------------------------

describe("ChangeStatusInputSchema", () => {
  it("should accept a valid input", () => {
    const result = ChangeStatusInputSchema.parse({
      issue_key: "PROJ-123",
      transition_name: "In Progress",
    });
    expect(result.issue_key).toBe("PROJ-123");
    expect(result.transition_name).toBe("In Progress");
    expect(result.response_format).toBe("markdown");
  });

  it("should accept a numeric transition ID as transition_name", () => {
    const result = ChangeStatusInputSchema.parse({
      issue_key: "PROJ-123",
      transition_name: "31",
    });
    expect(result.transition_name).toBe("31");
  });

  it("should accept response_format json", () => {
    const result = ChangeStatusInputSchema.parse({
      issue_key: "PROJ-1",
      transition_name: "Done",
      response_format: "json",
    });
    expect(result.response_format).toBe("json");
  });

  it("should reject empty issue_key", () => {
    expect(() =>
      ChangeStatusInputSchema.parse({ issue_key: "", transition_name: "Done" })
    ).toThrow();
  });

  it("should reject empty transition_name", () => {
    expect(() =>
      ChangeStatusInputSchema.parse({ issue_key: "PROJ-1", transition_name: "" })
    ).toThrow();
  });

  it("should reject extra fields (strict mode)", () => {
    expect(() =>
      ChangeStatusInputSchema.parse({
        issue_key: "PROJ-1",
        transition_name: "Done",
        extra: "field",
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// JiraTransitionSchema
// ---------------------------------------------------------------------------

describe("JiraTransitionSchema", () => {
  it("should accept a minimal transition with only required fields", () => {
    const result = JiraTransitionSchema.parse({ id: "21", name: "In Progress" });
    expect(result.id).toBe("21");
    expect(result.name).toBe("In Progress");
    expect(result.to).toBeUndefined();
  });

  it("should accept a full transition with to.statusCategory", () => {
    const input = {
      id: "31",
      name: "Done",
      to: {
        id: "10002",
        name: "Done",
        statusCategory: { id: 3, key: "done", name: "Done" },
      },
    };
    const result = JiraTransitionSchema.parse(input);
    expect(result.to?.name).toBe("Done");
    expect(result.to?.statusCategory?.key).toBe("done");
  });

  it("should accept unknown extra fields without throwing", () => {
    expect(() =>
      JiraTransitionSchema.parse({ id: "1", name: "Foo", unknownField: true })
    ).not.toThrow();
  });

  it("should reject a missing id", () => {
    expect(() => JiraTransitionSchema.parse({ name: "Done" })).toThrow();
  });

  it("should reject a missing name", () => {
    expect(() => JiraTransitionSchema.parse({ id: "31" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// JiraTransitionsResponseSchema
// ---------------------------------------------------------------------------

describe("JiraTransitionsResponseSchema", () => {
  it("should accept an empty transitions array", () => {
    const result = JiraTransitionsResponseSchema.parse({ transitions: [] });
    expect(result.transitions).toHaveLength(0);
  });

  it("should accept a populated transitions array", () => {
    const result = JiraTransitionsResponseSchema.parse({
      transitions: [
        { id: "11", name: "To Do" },
        { id: "21", name: "In Progress" },
        { id: "31", name: "Done" },
      ],
    });
    expect(result.transitions).toHaveLength(3);
    expect(result.transitions[2].name).toBe("Done");
  });

  it("should default transitions to empty array when key is absent", () => {
    const result = JiraTransitionsResponseSchema.parse({});
    expect(result.transitions).toEqual([]);
  });

  it("should reject when transitions is not an array", () => {
    expect(() =>
      JiraTransitionsResponseSchema.parse({ transitions: "invalid" })
    ).toThrow();
  });

  it("should reject a malformed transition item", () => {
    expect(() =>
      JiraTransitionsResponseSchema.parse({
        transitions: [{ name: "Done" }], // missing id
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// IssueDetailsResponseSchema
// ---------------------------------------------------------------------------

describe("IssueDetailsResponseSchema", () => {
  it("should accept a minimal valid response", () => {
    const input = {
      id: "10000",
      key: "PROJ-123",
      self: "https://example.atlassian.net/rest/api/3/issue/10000",
    };
    const result = IssueDetailsResponseSchema.parse(input);
    expect(result.key).toBe("PROJ-123");
    expect(result.fields).toBeUndefined();
  });

  it("should accept a full response with fields", () => {
    const input = {
      id: "10000",
      key: "PROJ-123",
      self: "https://example.atlassian.net/rest/api/3/issue/10000",
      fields: {
        summary: "Test issue",
        status: { id: "10001", name: "In Progress" },
        issuetype: { id: "10001", name: "Bug" },
      },
    };
    const result = IssueDetailsResponseSchema.parse(input);
    expect(result.fields?.summary).toBe("Test issue");
    expect(result.fields?.status?.name).toBe("In Progress");
  });

  it("should accept unknown extra fields at the top level without throwing", () => {
    expect(() =>
      IssueDetailsResponseSchema.parse({
        id: "1",
        key: "X-1",
        self: "https://example.atlassian.net/rest/api/3/issue/1",
        expand: "renderedFields",
      })
    ).not.toThrow();
  });

  it("should reject a missing id", () => {
    expect(() =>
      IssueDetailsResponseSchema.parse({
        key: "PROJ-1",
        self: "https://example.atlassian.net/rest/api/3/issue/1",
      })
    ).toThrow();
  });

  it("should reject a missing key", () => {
    expect(() =>
      IssueDetailsResponseSchema.parse({
        id: "1",
        self: "https://example.atlassian.net/rest/api/3/issue/1",
      })
    ).toThrow();
  });

  it("should reject an invalid self URL", () => {
    expect(() =>
      IssueDetailsResponseSchema.parse({ id: "1", key: "X-1", self: "not-a-url" })
    ).toThrow();
  });
});
