import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const API_BASE = process.env.DELIVERY_API_URL ?? "http://127.0.0.1:8002";
const COOKIE_NAME = process.env.DELIVERY_COOKIE_NAME ?? "delivery_session";

export async function POST(req: Request) {
  const body = await req.text();
  const c = await cookies();
  const sid = c.get(COOKIE_NAME)?.value;
  const res = await fetch(`${API_BASE}/import/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sid ? { Cookie: `${COOKIE_NAME}=${sid}` } : {}),
    },
    body,
    cache: "no-store",
  });
  if (res.ok) {
    revalidatePath("/admin");
    revalidatePath("/forwarder");
  }
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
