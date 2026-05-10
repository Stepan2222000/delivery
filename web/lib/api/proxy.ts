import { cookies } from "next/headers";

const API_BASE = process.env.DELIVERY_API_URL ?? "http://127.0.0.1:8002";
const COOKIE_NAME = process.env.DELIVERY_COOKIE_NAME ?? "delivery_session";

export async function proxyToApi(path: string, init: RequestInit = {}): Promise<Response> {
  const sid = (await cookies()).get(COOKIE_NAME)?.value;
  const headers = new Headers(init.headers);
  if (sid) headers.set("Cookie", `${COOKIE_NAME}=${sid}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
}
