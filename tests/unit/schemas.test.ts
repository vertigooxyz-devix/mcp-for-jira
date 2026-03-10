import { describe, it, expect } from "vitest";
import { CreateIssueInputSchema, ListIssueTypesInputSchema } from "../../src/schemas/issue.js";

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
