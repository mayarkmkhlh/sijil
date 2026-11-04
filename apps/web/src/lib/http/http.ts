import { apiBaseUrl } from "../config/config.js";

export class HttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Request failed (${status})`);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

export async function getJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { credentials: "include" });
  } catch {
    throw new HttpError(0, null);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status, payload);
  return payload;
}

export async function patchJson(path: string, body: unknown): Promise<unknown> {
  return sendJson(path, "PATCH", body);
}

export async function postJson(path: string, body: unknown): Promise<unknown> {
  return sendJson(path, "POST", body);
}

async function sendJson(path: string, method: "POST" | "PATCH", body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new HttpError(0, null);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status, payload);
  return payload;
}

export function errorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { error?: unknown; issues?: { message?: unknown }[] };
  if (typeof record.error === "string") return record.error;
  const message = record.issues?.find((issue) => typeof issue.message === "string")?.message;
  return typeof message === "string" ? message : null;
}
