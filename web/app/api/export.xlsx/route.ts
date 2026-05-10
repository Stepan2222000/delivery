import { cookies } from "next/headers";

const API_BASE = process.env.DELIVERY_API_URL ?? "http://127.0.0.1:8002";
const COOKIE_NAME = process.env.DELIVERY_COOKIE_NAME ?? "delivery_session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get("ids") ?? "";
  const c = await cookies();
  const sid = c.get(COOKIE_NAME)?.value;
  const apiUrl = `${API_BASE}/export.xlsx${ids ? `?ids=${encodeURIComponent(ids)}` : ""}`;
  const res = await fetch(apiUrl, {
    headers: sid ? { Cookie: `${COOKIE_NAME}=${sid}` } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    return new Response(`export failed: ${res.status}`, { status: res.status });
  }
  return new Response(await res.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type":
        res.headers.get("content-type") ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        res.headers.get("content-disposition") ?? `attachment; filename="delivery.xlsx"`,
    },
  });
}
