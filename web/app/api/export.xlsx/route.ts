import { proxyToApi } from "@/lib/api/proxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get("ids") ?? "";
  const path = `/export.xlsx${ids ? `?ids=${encodeURIComponent(ids)}` : ""}`;
  const res = await proxyToApi(path);
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
