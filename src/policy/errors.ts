import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  RateLimitError,
} from "@typesafe-ai/sdk";

type PolicyName = "jev" | "laya" | "heuristic";

export class PolicyNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyNotConfiguredError";
  }
}

function configured(name: string | undefined): boolean {
  return Boolean(name?.trim());
}

/** Null when this policy can be constructed. */
export function policyConfigError(name: PolicyName): string | null {
  if (name === "heuristic") return null;
  if (name === "jev" && !configured(process.env.TYPESAFE_API_KEY)) {
    return "Jev is not configured. Add TYPESAFE_API_KEY to .env, then restart the server.";
  }
  if (name === "laya" && (!configured(process.env.LAYA_BASE_URL) || !configured(process.env.LAYA_API_KEY))) {
    return "Laya is not configured. Add LAYA_BASE_URL and LAYA_API_KEY to .env, then restart the server.";
  }
  return null;
}

export function policyReady(): Record<PolicyName, boolean> {
  return {
    jev: policyConfigError("jev") === null,
    laya: policyConfigError("laya") === null,
    heuristic: true,
  };
}

function bodyText(body: unknown): string {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return JSON.stringify(body);
}

function outOfCredits(text: string): boolean {
  return /credit|quota|billing|payment required|insufficient/i.test(text);
}

/** A sentence safe to show in the page or the terminal. */
export function explainFailure(policy: string, caught: unknown): string {
  if (caught instanceof PolicyNotConfiguredError) return caught.message;
  const named = policy === "jev" || policy === "laya" || policy === "heuristic" ? policy : null;
  const configuredMessage = named ? policyConfigError(named) : null;
  if (configuredMessage && caught instanceof Error && /api key/i.test(caught.message)) {
    return configuredMessage;
  }

  const label = policy === "laya" ? "Laya" : policy === "jev" ? "Jev" : "The model";
  const text = caught instanceof APIError ? `${caught.message} ${bodyText(caught.body)}` : "";

  if (caught instanceof APIError && (caught.status === 402 || outOfCredits(text))) {
    return `${label} has no credits left. Add credits to that account, then try again.`;
  }
  if (caught instanceof RateLimitError || (caught instanceof APIError && caught.status === 429)) {
    if (outOfCredits(text)) {
      return `${label} has no credits left. Add credits to that account, then try again.`;
    }
    return `${label} is rate limited. Wait a moment, then try again.`;
  }
  if (caught instanceof APIError && caught.status === 401) {
    return `${label} rejected the API key. Check the key in .env, then restart the server.`;
  }
  if (caught instanceof APIError && caught.status === 403) {
    return `${label} refused this key. Check that the account is allowed to call the API.`;
  }
  if (caught instanceof APITimeoutError) {
    return `${label} did not answer in time. Try again.`;
  }
  if (caught instanceof APIConnectionError) {
    return policy === "laya"
      ? "Could not reach Laya. Check LAYA_BASE_URL and that the API is up."
      : "Could not reach Jev. Check the network and try again.";
  }
  if (caught instanceof Error && caught.message.trim()) return caught.message;
  return `${label} failed. Try again.`;
}
