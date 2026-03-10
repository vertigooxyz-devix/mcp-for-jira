import axios, { AxiosError, AxiosInstance } from "axios";
import { REQUEST_TIMEOUT_MS } from "../constants.js";

export interface JiraClientConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export function buildAuthHeader(email: string, apiToken: string): string {
  const credentials = `${email}:${apiToken}`;
  return `Basic ${Buffer.from(credentials, "utf-8").toString("base64")}`;
}

export function createJiraClient(config: JiraClientConfig): AxiosInstance {
  const baseURL = config.baseUrl.replace(/\/$/, "") + "/rest/api/3";
  const authHeader = buildAuthHeader(config.email, config.apiToken);

  return axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
  });
}

export function handleJiraError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as
        | { errorMessages?: string[]; errors?: Record<string, string> }
        | undefined;
      const messages = data?.errorMessages ?? [];
      const fieldErrors = data?.errors ?? {};
      const fieldErrorStr = Object.entries(fieldErrors)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");

      switch (status) {
        case 400:
          return (
            `Error: Bad request. ${messages.join(" ")} ${fieldErrorStr}`.trim() ||
            "Error: Invalid request. Check your parameters."
          );
        case 401:
          return "Error: Authentication failed. Check JIRA_EMAIL and JIRA_API_TOKEN in your environment. Ensure your API token is valid at https://id.atlassian.com/manage-profile/security/api-tokens.";
        case 403:
          return "Error: Permission denied. Your account does not have access to this resource. Check project permissions.";
        case 404:
          return "Error: Resource not found. Verify the project key or issue type exists.";
        case 422:
          return (
            `Error: Validation failed. ${messages.join(" ")} ${fieldErrorStr}`.trim() ||
            "Error: Invalid field values. Check required fields and field formats."
          );
        case 429:
          return "Error: Rate limit exceeded. Wait before making more requests.";
        default:
          return `Error: API request failed with status ${status}. ${messages.join(" ")}`.trim();
      }
    }
    if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    }
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return `Error: Cannot connect to Jira. Check JIRA_BASE_URL (${error.config?.baseURL ?? "unknown"}).`;
    }
  }
  return `Error: Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}
