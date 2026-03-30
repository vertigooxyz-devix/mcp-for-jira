import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateIssueTool } from "../../src/tools/create-issue.js";
import { createdIssueResponse, issueTypesResponse } from "../fixtures/jira-responses.js";
import type { AxiosInstance } from "axios";

// Mock extra parameter for tool handler
const createMockExtra = () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  signal: new AbortController().signal,
  requestId: "test-request-id",
});

describe("jira_create_issue", () => {
  let mockClient: AxiosInstance;
  let toolHandler: (params: unknown, extra: ReturnType<typeof createMockExtra>) => Promise<object>;
  let mockExtra: ReturnType<typeof createMockExtra>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
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

    registerCreateIssueTool(server as never, mockClient);
  });

  it("should create issue with valid payload", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueTypesResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: createdIssueResponse });

    const result = await toolHandler!(
      {
        project_key: "PROJ",
        summary: "Test bug",
        issue_type: "Bug",
      },
      mockExtra
    );

    expect(mockClient.get).toHaveBeenCalledWith("/issue/createmeta/PROJ/issuetypes");
    expect(mockClient.post).toHaveBeenCalledWith("/issue", {
      fields: {
        project: { key: "PROJ" },
        summary: "Test bug",
        issuetype: { id: "10001" },
      },
    });

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("PROJ-123");
    expect(content[0].text).toContain("Issue Created");

    // Verify logging notifications were sent
    expect(mockExtra.sendNotification).toHaveBeenCalled();
  });

  it("should use issue type ID when numeric", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: createdIssueResponse });

    await toolHandler!(
      {
        project_key: "PROJ",
        summary: "Test",
        issue_type: "10001",
      },
      mockExtra
    );

    expect(mockClient.get).not.toHaveBeenCalled();
    expect(mockClient.post).toHaveBeenCalledWith("/issue", {
      fields: {
        project: { key: "PROJ" },
        summary: "Test",
        issuetype: { id: "10001" },
      },
    });
  });

  it("should include description when provided", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueTypesResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: createdIssueResponse });

    await toolHandler!(
      {
        project_key: "PROJ",
        summary: "Test",
        issue_type: "Bug",
        description: "Detailed description",
      },
      mockExtra
    );

    expect(mockClient.post).toHaveBeenCalledWith("/issue", {
      fields: {
        project: { key: "PROJ" },
        summary: "Test",
        issuetype: { id: "10001" },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Detailed description" }],
            },
          ],
        },
      },
    });
  });

  it("should return JSON format when requested", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueTypesResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: createdIssueResponse });

    const result = await toolHandler!(
      {
        project_key: "PROJ",
        summary: "Test",
        issue_type: "Bug",
        response_format: "json",
      },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.key).toBe("PROJ-123");
    expect(parsed.id).toBe("10000");
  });

  it("should handle 401 error", async () => {
    const { AxiosError } = await import("axios");
    const axiosError = new AxiosError("Unauthorized");
    axiosError.response = {
      status: 401,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Unauthorized",
    };
    vi.mocked(mockClient.get).mockRejectedValueOnce(axiosError);

    const result = await toolHandler!(
      {
        project_key: "PROJ",
        summary: "Test",
        issue_type: "Bug",
      },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Authentication failed");
  });

  it("should reject invalid project_key", async () => {
    const result = await toolHandler!(
      {
        project_key: "invalid",
        summary: "Test",
        issue_type: "Bug",
      },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toMatch(/Error|invalid|required/i);
  });

  it("should throw when issue type name not found", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      data: { values: [{ id: "1", name: "Bug" }] },
    });

    const result = await toolHandler!(
      {
        project_key: "PROJ",
        summary: "Test",
        issue_type: "NonExistentType",
      },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("not found");
  });

  it("should show 'none' when issue type not found and no types available", async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: { values: [] } })
      .mockRejectedValueOnce(new Error("Not found"))
      .mockResolvedValueOnce({ data: [] });

    const result = await toolHandler!(
      {
        project_key: "PROJ",
        summary: "Test",
        issue_type: "NonExistentType",
      },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("not found");
    expect(content[0].text).toContain("Available: none");
  });
});
