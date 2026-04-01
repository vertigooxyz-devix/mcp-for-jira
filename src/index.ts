#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createJiraClient } from "./services/jira-client.js";
import { registerCreateIssueTool } from "./tools/create-issue.js";
import { registerListIssueTypesTool } from "./tools/list-issue-types.js";
import { registerDeleteIssueTool } from "./tools/delete-issue.js";
import { registerEditIssueTool } from "./tools/edit-issue.js";
import { registerChangeStatusTool } from "./tools/change-status.js";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    console.error(`ERROR: ${name} environment variable is required`);
    process.exit(1);
  }
  return value.trim();
}

async function main(): Promise<void> {
  const baseUrl = getEnv("JIRA_BASE_URL");
  const email = getEnv("JIRA_EMAIL");
  const apiToken = getEnv("JIRA_API_TOKEN");

  const client = createJiraClient({ baseUrl, email, apiToken });

  const server = new McpServer({
    name: "jira-mcp-server",
    version: "1.0.0",
  });

  registerListIssueTypesTool(server as never, client);
  registerCreateIssueTool(server as never, client);
  registerDeleteIssueTool(server as never, client);
  registerEditIssueTool(server as never, client);
  registerChangeStatusTool(server as never, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jira MCP server running via stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
