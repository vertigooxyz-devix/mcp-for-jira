import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerListIssueTypesTool } from "../../src/tools/list-issue-types.js";
import { issueTypesResponse } from "../fixtures/jira-responses.js";
import type { AxiosInstance } from "axios";

// Mock extra parameter for tool handler
const createMockExtra = () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  signal: new AbortController().signal,
  requestId: "test-request-id",
});

describe("jira_list_issue_types", () => {
  let mockClient: AxiosInstance;
  let toolHandler: (params: unknown, extra: ReturnType<typeof createMockExtra>) => Promise<object>;
  let mockExtra: ReturnType<typeof createMockExtra>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue({ data: issueTypesResponse }),
    } as unknown as AxiosInstance;

    mockExtra = createMockExtra();

    const server = {
      registerTool: vi.fn(
        (
          _name: string,
          _config: object,
          handler: (params: unknown, extra: ReturnType<typeof createMockExtra>) => Promise<object>
        ) => {
          toolHandler = handler;
        }
      ),
    };

    registerListIssueTypesTool(server as never, mockClient);
  });

  it("should list issue types for project", async () => {
    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    expect(mockClient.get).toHaveBeenCalledWith("/issue/createmeta/PROJ/issuetypes");

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Bug");
    expect(content[0].text).toContain("Task");
    expect(content[0].text).toContain("Story");
    expect(content[0].text).toContain("Issue Types for PROJ");

    // Verify logging notifications were sent
    expect(mockExtra.sendNotification).toHaveBeenCalled();
  });

  it("should return JSON format when requested", async () => {
    const result = await toolHandler!(
      {
        project_key: "PROJ",
        response_format: "json",
      },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.issue_types).toHaveLength(3);
    expect(parsed.issue_types[0]).toMatchObject({ id: "10001", name: "Bug" });
  });

  it("should include structuredContent", async () => {
    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    const structured = (result as { structuredContent?: { issue_types: unknown[] } })
      .structuredContent;
    expect(structured).toBeDefined();
    expect(structured!.issue_types).toHaveLength(3);
  });

  it("should handle empty issue types", async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: { values: [] } }) // createmeta → empty
      .mockResolvedValueOnce({ data: [] }) // /issuetype/project → empty array
      .mockResolvedValueOnce({ data: [] }); // /issuetype global → empty array

    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Issue Types for PROJ");
  });

  it("should handle createmeta with missing values key", async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: {} }) // createmeta → no values key (defaults to [])
      .mockResolvedValueOnce({
        data: [{ id: "1", name: "Task" }], // /issuetype/project → valid array
      });

    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Task");
  });

  it("should use project issuetype when createmeta returns empty", async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: { values: [] } })
      .mockResolvedValueOnce({
        data: [{ id: "10001", name: "Epic", description: "An epic" }],
      });

    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    expect(mockClient.get).toHaveBeenCalledTimes(2);
    expect(mockClient.get).toHaveBeenNthCalledWith(1, "/issue/createmeta/PROJ/issuetypes");
    expect(mockClient.get).toHaveBeenNthCalledWith(2, "/issuetype/project?projectId=PROJ");

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Epic");
  });

  it("should use global issuetype when project returns non-array", async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: { values: [] } })
      .mockResolvedValueOnce({ data: { unexpected: "format" } })
      .mockResolvedValueOnce({
        data: [{ id: "10001", name: "Task", description: "A task" }],
      });

    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    expect(mockClient.get).toHaveBeenCalledTimes(3);
    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Task");
  });

  it("should use global issuetype fallback when createmeta empty and project endpoint throws", async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: { values: [] } })
      .mockRejectedValueOnce(new Error("Not found"))
      .mockResolvedValueOnce({
        data: [{ id: "10001", name: "Task", description: "A task" }],
      });

    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    expect(mockClient.get).toHaveBeenCalledTimes(3);
    expect(mockClient.get).toHaveBeenNthCalledWith(1, "/issue/createmeta/PROJ/issuetypes");
    expect(mockClient.get).toHaveBeenNthCalledWith(2, "/issuetype/project?projectId=PROJ");
    expect(mockClient.get).toHaveBeenNthCalledWith(3, "/issuetype");

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Task");
  });

  it("should skip description in markdown when issue type has no description", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      data: {
        values: [
          { id: "1", name: "Bug", description: "Has desc" },
          { id: "2", name: "Task" },
        ],
      },
    });

    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("## Bug");
    expect(content[0].text).toContain("Has desc");
    expect(content[0].text).toContain("## Task");
    expect(content[0].text).not.toContain("undefined");
  });

  it("should handle API error", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { response: { status: 403 } })
    );

    const result = await toolHandler!({ project_key: "PROJ" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Error");
  });

  it("should reject invalid project_key", async () => {
    const result = await toolHandler!({ project_key: "invalid-key" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toMatch(/Error|invalid|required/i);
  });
});
