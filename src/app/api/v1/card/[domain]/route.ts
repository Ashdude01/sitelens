import { InputError, getReport, normalizeTarget } from "@/server/services/report-service";
import { buildCardData } from "@/server/export/card-data";
import { renderCardImage } from "@/server/export/card-image";

/**
 * GET /api/v1/card/example.com[?size=small][&download=1] — PNG share card with a backlink.
 * Only renders already-analyzed sites (never triggers a scan).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/card/[domain]">) {
  let key: string;
  try {
    key = normalizeTarget(decodeURIComponent((await ctx.params).domain).replace(/\.png$/i, "")).key;
  } catch (e) {
    return new Response(e instanceof InputError ? e.message : "Bad domain", { status: 400 });
  }
  const report = await getReport(key);
  if (!report) return new Response("Not analyzed yet", { status: 404 });
  const url = new URL(req.url);
  const small = url.searchParams.get("size") === "small";
  const img = await renderCardImage(buildCardData(report), small ? { width: 600, height: 315 } : undefined);
  const headers = new Headers(img.headers);
  headers.set("cache-control", "public, max-age=3600, s-maxage=86400");
  if (url.searchParams.get("download") === "1") headers.set("content-disposition", `attachment; filename="${key.replace(/[^a-z0-9.-]/gi, "_")}-sitelens.png"`);
  return new Response(img.body, { status: 200, headers });
}
