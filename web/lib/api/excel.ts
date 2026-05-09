import { cookies } from "next/headers";

const API_BASE = process.env.DELIVERY_API_URL ?? "http://127.0.0.1:8002";
const COOKIE_NAME = process.env.DELIVERY_COOKIE_NAME ?? "delivery_session";

export interface ImportPreviewItem {
  tracking_number: string;
  action: "update" | "skip" | "error";
  changes: Record<string, unknown>;
  reason: string | null;
}

export interface ImportPreview {
  will_update: number;
  skipped: number;
  errors: number;
  items: ImportPreviewItem[];
}

async function authedHeaders(): Promise<HeadersInit> {
  const c = await cookies();
  const sid = c.get(COOKIE_NAME)?.value;
  return sid ? { Cookie: `${COOKIE_NAME}=${sid}` } : {};
}

export async function exportXlsxBlob(ids?: string[]): Promise<Response> {
  const qs = ids && ids.length ? `?ids=${ids.map(encodeURIComponent).join(",")}` : "";
  return fetch(`${API_BASE}/export.xlsx${qs}`, {
    method: "GET",
    headers: await authedHeaders(),
    cache: "no-store",
  });
}

export async function importPreview(file: File): Promise<ImportPreview> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/import/preview`, {
    method: "POST",
    headers: await authedHeaders(),
    body: fd,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`preview failed: ${res.status}`);
  return res.json() as Promise<ImportPreview>;
}

export async function importApply(items: ImportPreviewItem[]): Promise<{ applied: number }> {
  const res = await fetch(`${API_BASE}/import/apply`, {
    method: "POST",
    headers: { ...(await authedHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`apply failed: ${res.status}`);
  return res.json() as Promise<{ applied: number }>;
}
