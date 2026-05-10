import { proxyToApi } from "@/lib/api/proxy";

// Route Handler instead of Server Action: Server Actions silently truncate
// multipart bodies at 1MB (vercel/next.js#59277), iPhone photos are 3-10MB.
export async function POST(req: Request, ctx: { params: Promise<{ tn: string }> }) {
  const { tn } = await ctx.params;
  const fd = await req.formData();
  const res = await proxyToApi(`/parcels/${encodeURIComponent(tn)}/photos`, {
    method: "POST",
    body: fd,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
