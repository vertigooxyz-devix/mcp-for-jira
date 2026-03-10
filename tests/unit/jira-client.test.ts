import { describe, it, expect } from "vitest";
import {
  buildAuthHeader,
  createJiraClient,
  handleJiraError,
} from "../../src/services/jira-client.js";
import { AxiosError } from "axios";

describe("buildAuthHeader", () => {
  it("should produce valid Base64 Basic auth header", () => {
    const header = buildAuthHeader("user@example.com", "token123");
    expect(header).toMatch(/^Basic /);
    const decoded = Buffer.from(header.replace("Basic ", ""), "base64").toString("utf-8");
    expect(decoded).toBe("user@example.com:token123");
  });
});

describe("createJiraClient", () => {
  it("should create client with correct base URL", () => {
    const client = createJiraClient({
      baseUrl: "https://example.atlassian.net",
      email: "user@test.com",
      apiToken: "token",
    });
    expect(client.defaults.baseURL).toBe("https://example.atlassian.net/rest/api/3");
  });

  it("should strip trailing slash from base URL", () => {
    const client = createJiraClient({
      baseUrl: "https://example.atlassian.net/",
      email: "u@t.com",
      apiToken: "t",
    });
    expect(client.defaults.baseURL).toBe("https://example.atlassian.net/rest/api/3");
  });

  it("should set Authorization header", () => {
    const client = createJiraClient({
      baseUrl: "https://x.atlassian.net",
      email: "a@b.com",
      apiToken: "secret",
    });
    expect(client.defaults.headers.Authorization).toMatch(/^Basic /);
  });
});

describe("handleJiraError", () => {
  it("should handle 401", () => {
    const err = new AxiosError("Unauthorized");
    err.response = {
      status: 401,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Unauthorized",
    };
    expect(handleJiraError(err)).toContain("Authentication failed");
    expect(handleJiraError(err)).toContain("JIRA_EMAIL");
  });

  it("should handle 403", () => {
    const err = new AxiosError("Forbidden");
    err.response = {
      status: 403,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Forbidden",
    };
    expect(handleJiraError(err)).toContain("Permission denied");
  });

  it("should handle 404", () => {
    const err = new AxiosError("Not Found");
    err.response = {
      status: 404,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Not Found",
    };
    expect(handleJiraError(err)).toContain("not found");
  });

  it("should handle 400", () => {
    const err = new AxiosError("Bad Request");
    err.response = {
      status: 400,
      data: { errorMessages: ["Invalid project"], errors: {} },
      headers: {},
      config: {} as never,
      statusText: "Bad Request",
    };
    const msg = handleJiraError(err);
    expect(msg).toContain("Bad request");
    expect(msg).toContain("Invalid project");
  });

  it("should handle 422 with error messages", () => {
    const err = new AxiosError("Unprocessable");
    err.response = {
      status: 422,
      data: { errorMessages: ["Summary is required"], errors: { summary: "Summary is required" } },
      headers: {},
      config: {} as never,
      statusText: "Unprocessable",
    };
    const msg = handleJiraError(err);
    expect(msg).toContain("Validation failed");
    expect(msg).toContain("Summary is required");
  });

  it("should handle 500 with default message", () => {
    const err = new AxiosError("Internal Server Error");
    err.response = {
      status: 500,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Internal Server Error",
    };
    expect(handleJiraError(err)).toContain("status 500");
  });

  it("should handle ENOTFOUND", () => {
    const err = new AxiosError("getaddrinfo ENOTFOUND");
    err.code = "ENOTFOUND";
    err.config = { baseURL: "https://bad.atlassian.net/rest/api/3" } as never;
    const msg = handleJiraError(err);
    expect(msg).toContain("Cannot connect to Jira");
    expect(msg).toContain("JIRA_BASE_URL");
    expect(msg).toContain("bad.atlassian.net");
  });

  it("should handle ECONNREFUSED with unknown baseURL", () => {
    const err = new AxiosError("Connection refused");
    err.code = "ECONNREFUSED";
    err.config = {} as never;
    const msg = handleJiraError(err);
    expect(msg).toContain("Cannot connect to Jira");
    expect(msg).toContain("unknown");
  });

  it("should handle 429", () => {
    const err = new AxiosError("Too Many Requests");
    err.response = {
      status: 429,
      data: {},
      headers: {},
      config: {} as never,
      statusText: "Too Many Requests",
    };
    expect(handleJiraError(err)).toContain("Rate limit");
  });

  it("should handle ECONNABORTED", () => {
    const err = new AxiosError("timeout");
    err.code = "ECONNABORTED";
    expect(handleJiraError(err)).toContain("timed out");
  });

  it("should handle generic Error", () => {
    expect(handleJiraError(new Error("Something broke"))).toContain("Something broke");
  });
});
