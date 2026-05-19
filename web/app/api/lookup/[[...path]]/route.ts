import { proxyToApi } from "@/lib/api/proxy";

// Optional catch-all: matches /api/lookup, /api/lookup/foo, /api/lookup/foo/bar.
// Streams response body unchanged so SSE on /ai/run keeps its chunks.
async function forward(
  req: Request,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const segs = (path ?? []).map(encodeURIComponent).join("/");
  const target = `/lookup${segs ? `/${segs}` : ""}${url.search}`;

  const init: RequestInit = { method: req.method };
  const ct = req.headers.get("content-type");
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    // @ts-expect-error -- Node fetch needs duplex for streaming request bodies
    init.duplex = "half";
  }
  if (ct) init.headers = { "Content-Type": ct };

  const res = await proxyToApi(target, init);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      ...(res.headers.get("x-vercel-ai-ui-message-stream")
        ? { "x-vercel-ai-ui-message-stream": "v1" }
        : {}),
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
