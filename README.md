# Jira MCP Server

MCP (Model Context Protocol) server for **Jira Cloud** API integration. Create issues and list issue types using Basic Auth (email + API token).

## Features

- **jira_create_issue** – Create a new Jira issue with project, summary, and issue type
- **jira_list_issue_types** – List available issue types for a project

## Prerequisites

- Node.js 24+
- Jira Cloud site
- [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens)

## Setup

1. **Clone and install**

   ```bash
   cd jira_mcp
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   ```env
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=user@example.com
   JIRA_API_TOKEN=your_api_token_here
   ```

3. **Build**

   ```bash
   npm run build
   ```

## Usage

### Run the server

```bash
npm start
```

Or with env vars inline:

```bash
JIRA_BASE_URL=https://your-domain.atlassian.net JIRA_EMAIL=you@example.com JIRA_API_TOKEN=xxx npm start
```

The server runs via **stdio** and is intended to be used as a subprocess by MCP clients (e.g. Cursor, Claude Desktop).

### Cursor configuration

Add to your Cursor MCP config (e.g. `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/jira_mcp/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Tools

### jira_list_issue_types

List issue types (Bug, Task, Story, etc.) for a project.

| Parameter       | Type   | Required | Description                    |
| --------------- | ------ | -------- | ------------------------------ |
| project_key     | string | Yes      | Jira project key (e.g. PROJ)   |
| response_format | string | No       | `markdown` (default) or `json` |

### jira_create_issue

Create a new Jira issue.

| Parameter       | Type   | Required | Description                            |
| --------------- | ------ | -------- | -------------------------------------- |
| project_key     | string | Yes      | Jira project key                       |
| summary         | string | Yes      | Issue title                            |
| issue_type      | string | Yes      | Issue type name (e.g. Bug, Task) or ID |
| description     | string | No       | Issue description                      |
| response_format | string | No       | `markdown` (default) or `json`         |

## Testing Without Cursor

The best way to test the MCP server interactively is with **MCP Inspector**, a web UI for exercising tools, resources, and prompts.

1. **Build the project** (if not already done):

   ```bash
   npm run build
   ```

2. **Run MCP Inspector** with your server. With a `.env` file in the project root, the server loads it automatically:

   ```bash
   npm run inspector
   ```

   Or run directly (env from `.env` is loaded by the server):

   ```bash
   npx @modelcontextprotocol/inspector node dist/index.js
   ```

   To pass env vars explicitly instead:

   ```bash
   npx @modelcontextprotocol/inspector \
     -e JIRA_BASE_URL=https://your-domain.atlassian.net \
     -e JIRA_EMAIL=you@example.com \
     -e JIRA_API_TOKEN=your-token \
     node dist/index.js
   ```

3. **Open the Inspector** in your browser (typically `http://localhost:6274`).

4. **Test tools** – Use the Tools tab to call `jira_list_issue_types` and `jira_create_issue` with sample inputs.

The Inspector runs your server as a subprocess and connects via stdio, so it behaves like a real MCP client.

## Development

```bash
# Run with auto-reload
npm run dev

# Run all tests (unit + integration)
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests only (spawns MCP server + mock Jira)
npm run test:integration

# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check
```

### Pre-commit hooks (Husky)

On each `git commit`, Husky runs lint and Prettier on staged files. If there are errors, the commit is blocked with a message:

```
❌ Commit blocked: Fix the lint or Prettier errors above.
   Tips: npm run lint:fix  |  npm run format
```

To bypass (use sparingly): `git commit --no-verify` or `HUSKY=0 git commit`

### CI

GitHub Actions runs on **pull requests** to `main`/`master` with separate stages on **Node.js 24.x**:

- **Unit Tests** – `npm run test:unit` (90% coverage enforced)
- **Integration Tests** – `npm run test:integration` (MCP server + mock Jira)
- **Lint & Format** – ESLint and Prettier checks
- **Security Audit** – `npm audit` (fails on moderate+ vulnerabilities)
- **CodeQL** – Static security analysis (JavaScript/TypeScript)
- **Dependency Review** – Checks for vulnerable deps in PRs

**Dependabot** is configured for weekly dependency updates (`.github/dependabot.yml`).

To block merges until PRs pass, enable **branch protection** in GitHub: Settings → Branches → Add rule → Require status checks to pass before merging.

## API Reference

- [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Basic Auth for REST APIs](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/)

## License

MIT
