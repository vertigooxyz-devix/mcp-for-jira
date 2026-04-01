import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startMockJiraServer } from "./mock-jira-server.js";

describe("MCP Server Integration", () => {
  let mockJira: Awaited<ReturnType<typeof startMockJiraServer>>;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    mockJira = await startMockJiraServer();

    const serverPath = resolve(__dirname, "../../dist/index.js");
    transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: {
        JIRA_BASE_URL: mockJira.url,
        JIRA_EMAIL: "test@example.com",
        JIRA_API_TOKEN: "test-token",
      },
    });

    client = new Client(
      { name: "integration-test-client", version: "1.0.0" },
      {
        capabilities: {
          logging: {},
        },
      }
    );

    await client.connect(transport);
  }, 10000);

  afterAll(async () => {
    await transport?.close();
    mockJira?.server?.close();
  });

  it("should list available tools", async () => {
    const result = await client.listTools();

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThanOrEqual(5);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("jira_list_issue_types");
    expect(toolNames).toContain("jira_create_issue");
    expect(toolNames).toContain("jira_delete_issue");
    expect(toolNames).toContain("jira_edit_issue");
    expect(toolNames).toContain("jira_change_status");
  });

  it("should call jira_list_issue_types and return issue types", async () => {
    const result = await client.callTool({
      name: "jira_list_issue_types",
      arguments: { project_key: "PROJ" },
    });

    expect(result.content).toBeDefined();
    expect(result.content!.length).toBeGreaterThan(0);

    const textContent = result.content!.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    expect(textContent!.type).toBe("text");
    expect((textContent as { text: string }).text).toContain("Bug");
    expect((textContent as { text: string }).text).toContain("Task");
    expect((textContent as { text: string }).text).toContain("Story");
    expect((textContent as { text: string }).text).toContain("Issue Types for PROJ");
  });

  it("should call jira_create_issue and return created issue", async () => {
    const result = await client.callTool({
      name: "jira_create_issue",
      arguments: {
        project_key: "PROJ",
        summary: "Integration test issue",
        issue_type: "Bug",
      },
    });

    expect(result.content).toBeDefined();
    expect(result.content!.length).toBeGreaterThan(0);

    const textContent = result.content!.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    expect((textContent as { text: string }).text).toContain("PROJ-123");
    expect((textContent as { text: string }).text).toContain("Issue Created");
  });

  it("should return JSON format when requested", async () => {
    const result = await client.callTool({
      name: "jira_list_issue_types",
      arguments: { project_key: "PROJ", response_format: "json" },
    });

    const textContent = result.content!.find((c) => c.type === "text");
    const parsed = JSON.parse((textContent as { text: string }).text);
    expect(parsed.issue_types).toBeDefined();
    expect(Array.isArray(parsed.issue_types)).toBe(true);
    expect(parsed.issue_types.length).toBe(3);
  });

  it("should handle create issue with JSON response", async () => {
    const result = await client.callTool({
      name: "jira_create_issue",
      arguments: {
        project_key: "PROJ",
        summary: "JSON test",
        issue_type: "Task",
        response_format: "json",
      },
    });

    const textContent = result.content!.find((c) => c.type === "text");
    const parsed = JSON.parse((textContent as { text: string }).text);
    expect(parsed.key).toBe("PROJ-123");
    expect(parsed.id).toBe("10000");
    expect(parsed.self).toContain("/issue/10000");
  });

  // -------------------------------------------------------------------------
  // DELETE_TASK
  // -------------------------------------------------------------------------

  it("should call jira_delete_issue and return confirmation", async () => {
    const result = await client.callTool({
      name: "jira_delete_issue",
      arguments: { issue_key: "PROJ-123" },
    });

    expect(result.content).toBeDefined();
    const textContent = result.content!.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    expect((textContent as { text: string }).text).toContain("Issue Deleted");
    expect((textContent as { text: string }).text).toContain("PROJ-123");
  });

  it("should call jira_delete_issue with JSON format", async () => {
    const result = await client.callTool({
      name: "jira_delete_issue",
      arguments: { issue_key: "PROJ-123", response_format: "json" },
    });

    const textContent = result.content!.find((c) => c.type === "text");
    const parsed = JSON.parse((textContent as { text: string }).text);
    expect(parsed.deleted).toBe(true);
    expect(parsed.issue_key).toBe("PROJ-123");
  });

  // -------------------------------------------------------------------------
  // EDIT_TASK
  // -------------------------------------------------------------------------

  it("should call jira_edit_issue and return updated issue", async () => {
    const result = await client.callTool({
      name: "jira_edit_issue",
      arguments: {
        issue_key: "PROJ-123",
        summary: "Integration test update",
      },
    });

    expect(result.content).toBeDefined();
    const textContent = result.content!.find((c) => c.type === "text");
    expect((textContent as { text: string }).text).toContain("Issue Updated");
    expect((textContent as { text: string }).text).toContain("summary");
  });

  it("should call jira_edit_issue with JSON format", async () => {
    const result = await client.callTool({
      name: "jira_edit_issue",
      arguments: {
        issue_key: "PROJ-123",
        summary: "JSON edit test",
        response_format: "json",
      },
    });

    const textContent = result.content!.find((c) => c.type === "text");
    const parsed = JSON.parse((textContent as { text: string }).text);
    expect(parsed.key).toBe("PROJ-123");
    expect(parsed.updated_fields).toContain("summary");
  });

  // -------------------------------------------------------------------------
  // CHANGE_STATUS
  // -------------------------------------------------------------------------

  it("should call jira_change_status and return transition confirmation", async () => {
    const result = await client.callTool({
      name: "jira_change_status",
      arguments: {
        issue_key: "PROJ-123",
        transition_name: "Done",
      },
    });

    expect(result.content).toBeDefined();
    const textContent = result.content!.find((c) => c.type === "text");
    expect((textContent as { text: string }).text).toContain("Status Changed");
    expect((textContent as { text: string }).text).toContain("Done");
  });

  it("should call jira_change_status with JSON format", async () => {
    const result = await client.callTool({
      name: "jira_change_status",
      arguments: {
        issue_key: "PROJ-123",
        transition_name: "In Progress",
        response_format: "json",
      },
    });

    const textContent = result.content!.find((c) => c.type === "text");
    const parsed = JSON.parse((textContent as { text: string }).text);
    expect(parsed.issue_key).toBe("PROJ-123");
    expect(parsed.transition_name).toBe("In Progress");
    expect(parsed.target_status).toBe("In Progress");
  });
});
