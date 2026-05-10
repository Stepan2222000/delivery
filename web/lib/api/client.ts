import { cookies } from "next/headers";

const API_BASE = process.env.DELIVERY_API_URL ?? "http://127.0.0.1:8002";
const COOKIE_NAME = process.env.DELIVERY_COOKIE_NAME ?? "delivery_session";

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`[${status}] ${detail}`);
  }
}

async function buildHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
  const c = await cookies();
  const sid = c.get(COOKIE_NAME)?.value;
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (sid) h["Cookie"] = `${COOKIE_NAME}=${sid}`;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail ?? detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: await buildHeaders(),
    cache: "no-store",
  });
  return handle<T>(res);
}

export async function apiSend<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const headers = await buildHeaders(body !== undefined ? { "Content-Type": "application/json" } : undefined);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, file: File | Blob, fieldName = "file"): Promise<T> {
  const fd = new FormData();
  fd.append(fieldName, file);
  const headers = await buildHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: fd,
    cache: "no-store",
  });
  return handle<T>(res);
}
