import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerEditIssueTool } from "../../src/tools/edit-issue.js";
import { issueTypesResponse, issueDetailsResponse } from "../fixtures/jira-responses.js";
import type { AxiosInstance } from "axios";

// Mock extra parameter for tool handler
const createMockExtra = () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  signal: new AbortController().signal,
  requestId: "test-request-id",
});

describe("jira_edit_issue", () => {
  let mockClient: AxiosInstance;
  let toolHandler: (params: unknown, extra: ReturnType<typeof createMockExtra>) => Promise<object>;
  let mockExtra: ReturnType<typeof createMockExtra>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      put: vi.fn(),
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

    registerEditIssueTool(server as never, mockClient);
  });

  it("should update summary only", async () => {
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueDetailsResponse });

    const result = await toolHandler!({ issue_key: "PROJ-123", summary: "New title" }, mockExtra);

    expect(mockClient.put).toHaveBeenCalledWith("/issue/PROJ-123", {
      fields: { summary: "New title" },
    });

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Issue Updated");
    expect(content[0].text).toContain("summary");
  });

  it("should update description only with ADF wrapper", async () => {
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueDetailsResponse });

    await toolHandler!({ issue_key: "PROJ-123", description: "New description" }, mockExtra);

    expect(mockClient.put).toHaveBeenCalledWith("/issue/PROJ-123", {
      fields: {
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "New description" }],
            },
          ],
        },
      },
    });
  });

  it("should update issue_type by name using GET then PUT", async () => {
    // GET /issue/createmeta/PROJ/issuetypes for type resolution
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueTypesResponse });
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    // GET /issue/PROJ-123 for the updated issue details
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueDetailsResponse });

    await toolHandler!({ issue_key: "PROJ-123", issue_type: "Bug" }, mockExtra);

    expect(mockClient.put).toHaveBeenCalledWith("/issue/PROJ-123", {
      fields: { issuetype: { id: "10001" } },
    });
  });

  it("should use issue_type numeric ID without fetching types", async () => {
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueDetailsResponse });

    await toolHandler!({ issue_key: "PROJ-123", issue_type: "10002" }, mockExtra);

    // Only 1 GET call — the post-update fetch; NOT the type-resolution fetch
    expect(mockClient.get).toHaveBeenCalledTimes(1);
    expect(mockClient.put).toHaveBeenCalledWith("/issue/PROJ-123", {
      fields: { issuetype: { id: "10002" } },
    });
  });

  it("should update all three fields at once", async () => {
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: issueTypesResponse }) // type resolution
      .mockResolvedValueOnce({ data: issueDetailsResponse }); // post-update fetch

    await toolHandler!(
      {
        issue_key: "PROJ-123",
        summary: "Title",
        description: "Desc",
        issue_type: "Task",
      },
      mockExtra
    );

    const putCall = vi.mocked(mockClient.put).mock.calls[0];
    const fields = (putCall[1] as { fields: Record<string, unknown> }).fields;
    expect(fields.summary).toBe("Title");
    expect(fields.description).toBeDefined();
    expect(fields.issuetype).toEqual({ id: "10002" });
  });

  it("should return JSON format when requested", async () => {
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueDetailsResponse });

    const result = await toolHandler!(
      { issue_key: "PROJ-123", summary: "New", response_format: "json" },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.key).toBe("PROJ-123");
    expect(parsed.updated_fields).toContain("summary");
  });

  it("should include structuredContent with updated_fields", async () => {
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueDetailsResponse });

    const result = await toolHandler!({ issue_key: "PROJ-123", summary: "New" }, mockExtra);

    const typed = result as { structuredContent: { updated_fields: string[] } };
    expect(typed.structuredContent.updated_fields).toContain("summary");
  });

  it("should handle 401 authentication error", async () => {
    const { AxiosError } = await import("axios");
    const axiosError = new AxiosError("Unauthorized");
    axiosError.response = {
      status: 401,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Unauthorized",
    };
    vi.mocked(mockClient.put).mockRejectedValueOnce(axiosError);

    const result = await toolHandler!({ issue_key: "PROJ-123", summary: "x" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Authentication failed");
  });

  it("should reject when no editable field is provided", async () => {
    const result = await toolHandler!({ issue_key: "PROJ-123" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toMatch(/Error|invalid|required/i);
    expect(mockClient.put).not.toHaveBeenCalled();
  });

  it("should reject an empty issue_key", async () => {
    const result = await toolHandler!({ issue_key: "", summary: "x" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toMatch(/Error|invalid|required/i);
  });

  it("should show 'none' when issue type is not found in the project", async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ data: { values: [] } }) // createmeta empty
      .mockRejectedValueOnce(new Error("Not found")) // project fallback fails
      .mockResolvedValueOnce({ data: [] }); // global fallback empty

    const result = await toolHandler!(
      { issue_key: "PROJ-123", issue_type: "NonExistent" },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("not found");
    expect(content[0].text).toContain("Available: none");
  });

  it("should send logging notifications during edit", async () => {
    vi.mocked(mockClient.put).mockResolvedValueOnce({ data: null, status: 204 });
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: issueDetailsResponse });

    await toolHandler!({ issue_key: "PROJ-123", summary: "x" }, mockExtra);

    expect(mockExtra.sendNotification).toHaveBeenCalled();
  });
});
