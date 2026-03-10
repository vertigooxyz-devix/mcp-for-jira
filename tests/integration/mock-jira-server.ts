import type { Server } from "http";
import express, { type Express } from "express";

const ISSUE_TYPES = {
  values: [
    { id: "10001", name: "Bug", description: "A bug" },
    { id: "10002", name: "Task", description: "A task" },
    { id: "10003", name: "Story", description: "A user story" },
  ],
};

export function createMockJiraServer(): Express {
  const app = express();
  app.use(express.json());

  app.get("/rest/api/3/issue/createmeta/:projectKey/issuetypes", (_req, res) => {
    res.json(ISSUE_TYPES);
  });

  app.get("/rest/api/3/issuetype/project", (_req, res) => {
    res.json(ISSUE_TYPES.values);
  });

  app.get("/rest/api/3/issuetype", (_req, res) => {
    res.json(ISSUE_TYPES.values);
  });

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
