import type { Server } from "http";
import express, { type Express } from "express";

const ISSUE_TYPES = {
  values: [
    { id: "10001", name: "Bug", description: "A bug" },
    { id: "10002", name: "Task", description: "A task" },
    { id: "10003", name: "Story", description: "A user story" },
  ],
};

const TRANSITIONS = {
  transitions: [
    { id: "11", name: "To Do",       to: { id: "10000", name: "To Do" } },
    { id: "21", name: "In Progress", to: { id: "10001", name: "In Progress" } },
    { id: "31", name: "Done",        to: { id: "10002", name: "Done" } },
  ],
};

export function createMockJiraServer(): Express {
  const app = express();
  app.use(express.json());

  // ---------------------------------------------------------------------------
  // Issue-type discovery endpoints (existing)
  // ---------------------------------------------------------------------------

  app.get("/rest/api/3/issue/createmeta/:projectKey/issuetypes", (_req, res) => {
    res.json(ISSUE_TYPES);
  });

  app.get("/rest/api/3/issuetype/project", (_req, res) => {
    res.json(ISSUE_TYPES.values);
  });

  app.get("/rest/api/3/issuetype", (_req, res) => {
    res.json(ISSUE_TYPES.values);
  });

  // ---------------------------------------------------------------------------
  // Issue CRUD endpoints
  // ---------------------------------------------------------------------------

  // POST /issue  — create (existing)
  app.post("/rest/api/3/issue", (req, res) => {
    const { fields } = req.body ?? {};
    const projectKey = fields?.project?.key ?? "PROJ";
    const id = "10000";
    const key = `${projectKey}-123`;
    res.status(201).json({
      id,
      key,
      self: `https://mock.atlassian.net/rest/api/3/issue/${id}`,
    });
  });

  // GET /issue/:issueKey  — fetch details (used by edit tool after PUT)
  app.get("/rest/api/3/issue/:issueKey", (req, res) => {
    const key = req.params.issueKey;
    res.json({
      id: "10000",
      key,
      self: `https://mock.atlassian.net/rest/api/3/issue/10000`,
      fields: {
        summary: "Mock issue",
        status: { id: "10001", name: "In Progress" },
        issuetype: { id: "10001", name: "Bug" },
      },
    });
  });

  // PUT /issue/:issueKey  — edit (Jira returns 204 No Content on success)
  app.put("/rest/api/3/issue/:issueKey", (_req, res) => {
    res.status(204).send();
  });

  // DELETE /issue/:issueKey  — delete (Jira returns 204 No Content on success)
  app.delete("/rest/api/3/issue/:issueKey", (_req, res) => {
    res.status(204).send();
  });

  // GET /issue/:issueKey/transitions  — available transitions
  app.get("/rest/api/3/issue/:issueKey/transitions", (_req, res) => {
    res.json(TRANSITIONS);
  });

  // POST /issue/:issueKey/transitions  — apply transition (Jira returns 204)
  app.post("/rest/api/3/issue/:issueKey/transitions", (_req, res) => {
    res.status(204).send();
  });

  return app;
}

export function startMockJiraServer(): Promise<{ server: Server; port: number; url: string }> {
  return new Promise((resolve) => {
    const app = createMockJiraServer();
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        server,
        port,
        url: `http://localhost:${port}`,
      });
    });
  });
}
