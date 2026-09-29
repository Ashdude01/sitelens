import { InputError, getReport, normalizeTarget } from "@/server/services/report-service";
import { buildCardData } from "@/server/export/card-data";
import { renderCardImage } from "@/server/export/card-image";
import { renderPdf } from "@/server/export/pdf";

/** GET /api/v1/export/example.com?format=pdf — downloadable one-page PDF report (analyzed sites only). */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/export/[domain]">) {
  let key: string;
  try {
    key = normalizeTarget(decodeURIComponent((await ctx.params).domain)).key;
  } catch (e) {
    return new Response(e instanceof InputError ? e.message : "Bad domain", { status: 400 });
  }
  const format = new URL(req.url).searchParams.get("format") ?? "pdf";
  if (format !== "pdf") return new Response("Unsupported format", { status: 400 });
  const report = await getReport(key);
  if (!report) return new Response("Not analyzed yet", { status: 404 });
  const card = buildCardData(report);
  const png = await (await renderCardImage(card)).arrayBuffer();
  const bytes = await renderPdf(report, card, png);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${key.replace(/[^a-z0-9.-]/gi, "_")}-sitelens-report.pdf"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
