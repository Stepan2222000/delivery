import { proxyToApi } from "@/lib/api/proxy";

export async function POST(req: Request) {
  const fd = await req.formData();
  const force = new URL(req.url).searchParams.get("force") === "1";
  const res = await proxyToApi(`/import/preview${force ? "?force=true" : ""}`, { method: "POST", body: fd });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
