import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerChangeStatusTool } from "../../src/tools/change-status.js";
import { transitionsResponse } from "../fixtures/jira-responses.js";
import type { AxiosInstance } from "axios";

// Mock extra parameter for tool handler
const createMockExtra = () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  signal: new AbortController().signal,
  requestId: "test-request-id",
});

describe("jira_change_status", () => {
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

    registerChangeStatusTool(server as never, mockClient);
  });

  it("should resolve transition by name and POST the correct ID", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: null, status: 204 });

    const result = await toolHandler!(
      { issue_key: "PROJ-123", transition_name: "In Progress" },
      mockExtra
    );

    expect(mockClient.get).toHaveBeenCalledWith("/issue/PROJ-123/transitions");
    expect(mockClient.post).toHaveBeenCalledWith("/issue/PROJ-123/transitions", {
      transition: { id: "21" },
    });

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Status Changed");
    expect(content[0].text).toContain("In Progress");
  });

  it("should resolve transition by numeric ID directly", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: null, status: 204 });

    await toolHandler!({ issue_key: "PROJ-123", transition_name: "31" }, mockExtra);

    expect(mockClient.post).toHaveBeenCalledWith("/issue/PROJ-123/transitions", {
      transition: { id: "31" },
    });
  });

  it("should perform case-insensitive transition name matching", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: null, status: 204 });

    await toolHandler!({ issue_key: "PROJ-123", transition_name: "done" }, mockExtra);

    expect(mockClient.post).toHaveBeenCalledWith("/issue/PROJ-123/transitions", {
      transition: { id: "31" },
    });
  });

  it("should return JSON format when requested", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: null, status: 204 });

    const result = await toolHandler!(
      {
        issue_key: "PROJ-123",
        transition_name: "Done",
        response_format: "json",
      },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.issue_key).toBe("PROJ-123");
    expect(parsed.transition_id).toBe("31");
    expect(parsed.transition_name).toBe("Done");
    expect(parsed.target_status).toBe("Done");
  });

  it("should include structuredContent in the response", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: null, status: 204 });

    const result = await toolHandler!(
      { issue_key: "PROJ-123", transition_name: "Done" },
      mockExtra
    );

    const typed = result as {
      structuredContent: {
        issue_key: string;
        transition_id: string;
        transition_name: string;
        target_status: string;
      };
    };
    expect(typed.structuredContent.issue_key).toBe("PROJ-123");
    expect(typed.structuredContent.transition_id).toBe("31");
  });

  it("should throw when transition name is not found", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });

    const result = await toolHandler!(
      { issue_key: "PROJ-123", transition_name: "Nonexistent" },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("not found");
    expect(content[0].text).toContain("PROJ-123");
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("should throw when numeric transition ID is not in the list", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });

    const result = await toolHandler!({ issue_key: "PROJ-123", transition_name: "99" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("not found");
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("should show 'none' when no transitions are available", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: { transitions: [] } });

    const result = await toolHandler!(
      { issue_key: "PROJ-123", transition_name: "Done" },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("not found");
    expect(content[0].text).toContain("Available: none");
  });

  it("should handle 401 authentication error from transitions GET", async () => {
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
      { issue_key: "PROJ-123", transition_name: "Done" },
      mockExtra
    );

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toContain("Authentication failed");
  });

  it("should reject an empty issue_key", async () => {
    const result = await toolHandler!({ issue_key: "", transition_name: "Done" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toMatch(/Error|invalid|required/i);
    expect(mockClient.get).not.toHaveBeenCalled();
  });

  it("should reject an empty transition_name", async () => {
    const result = await toolHandler!({ issue_key: "PROJ-123", transition_name: "" }, mockExtra);

    const content = (result as { content: { text: string }[] }).content;
    expect(content[0].text).toMatch(/Error|invalid|required/i);
    expect(mockClient.get).not.toHaveBeenCalled();
  });

  it("should send logging notifications during status change", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: transitionsResponse });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ data: null, status: 204 });

    await toolHandler!({ issue_key: "PROJ-123", transition_name: "Done" }, mockExtra);

    expect(mockExtra.sendNotification).toHaveBeenCalled();
  });
});
