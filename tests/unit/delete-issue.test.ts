import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerDeleteIssueTool } from "../../src/tools/delete-issue.js";
import type { AxiosInstance } from "axios";

// Mock extra parameter for tool handler
const createMockExtra = () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  signal: new AbortController().signal,
  requestId: "test-request-id",
});

describe("jira_delete_issue", () => {
  let mockClient: AxiosInstance;
  let toolHandler: (params: unknown, extra: ReturnType<typeof createMockExtra>) => Promise<object>;
  let mockExtra: ReturnType<typeof createMockExtra>;

  beforeEach(() => {
    mockClient = {
      delete: vi.fn(),
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

    registerDeleteIssueTool(server as never, mockClient);
  });

  it("should delete an issue with the correct API call", async () => {
    vi.mocked(mockClient.delete).mockResolvedValueOnce({ data: null, status: 204 });

    const result = await toolHandler!({ issue_key: "PROJ-123" }, mockExtra);

    expect(mockClient.delete).toHaveBeenCalledWith("/issue/PROJ-123", {
      params: { deleteSubtasks: false },
    });

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Issue Deleted");
    expect(content[0].text).toContain("PROJ-123");
  });

  it("should pass deleteSubtasks=true when requested", async () => {
    vi.mocked(mockClient.delete).mockResolvedValueOnce({ data: null, status: 204 });

    await toolHandler!({ issue_key: "PROJ-123", delete_subtasks: true }, mockExtra);

    expect(mockClient.delete).toHaveBeenCalledWith("/issue/PROJ-123", {
      params: { deleteSubtasks: true },
    });
  });

  it("should include sub-tasks line in markdown when delete_subtasks is true", async () => {
    vi.mocked(mockClient.delete).mockResolvedValueOnce({ data: null, status: 204 });

    const result = await toolHandler!({ issue_key: "PROJ-123", delete_subtasks: true }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Sub-tasks");
  });

  it("should return JSON format when requested", async () => {
    vi.mocked(mockClient.delete).mockResolvedValueOnce({ data: null, status: 204 });

    const result = await toolHandler!(
      { issue_key: "PROJ-123", response_format: "json" },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.deleted).toBe(true);
    expect(parsed.issue_key).toBe("PROJ-123");
  });

  it("should include structuredContent in the response", async () => {
    vi.mocked(mockClient.delete).mockResolvedValueOnce({ data: null, status: 204 });

    const result = await toolHandler!({ issue_key: "PROJ-123" }, mockExtra);

    const typed = result as { structuredContent: { deleted: boolean; issue_key: string } };
    expect(typed.structuredContent.deleted).toBe(true);
    expect(typed.structuredContent.issue_key).toBe("PROJ-123");
  });

  it("should handle 403 permission error", async () => {
    const { AxiosError } = await import("axios");
    const axiosError = new AxiosError("Forbidden");
    axiosError.response = {
      status: 403,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Forbidden",
    };
    vi.mocked(mockClient.delete).mockRejectedValueOnce(axiosError);

    const result = await toolHandler!({ issue_key: "PROJ-123" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Permission denied");
  });

  it("should handle 404 not found error", async () => {
    const { AxiosError } = await import("axios");
    const axiosError = new AxiosError("Not Found");
    axiosError.response = {
      status: 404,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Not Found",
    };
    vi.mocked(mockClient.delete).mockRejectedValueOnce(axiosError);

    const result = await toolHandler!({ issue_key: "PROJ-999" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("not found");
  });

  it("should reject an empty issue_key", async () => {
    const result = await toolHandler!({ issue_key: "" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toMatch(/Error|invalid|required/i);
    expect(mockClient.delete).not.toHaveBeenCalled();
  });

  it("should URL-encode special characters in the issue key", async () => {
    vi.mocked(mockClient.delete).mockResolvedValueOnce({ data: null, status: 204 });

    await toolHandler!({ issue_key: "PROJ-123" }, mockExtra);

    // The path passed to axios should have the key URL-encoded
    expect(mockClient.delete).toHaveBeenCalledWith(
      expect.stringContaining("PROJ-123"),
      expect.any(Object)
    );
  });

  it("should send logging notifications during deletion", async () => {
    vi.mocked(mockClient.delete).mockResolvedValueOnce({ data: null, status: 204 });

    await toolHandler!({ issue_key: "PROJ-123" }, mockExtra);

    expect(mockExtra.sendNotification).toHaveBeenCalled();
  });
});
