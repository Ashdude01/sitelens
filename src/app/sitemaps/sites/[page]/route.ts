import { config } from "@/server/config";
import { indexableReports } from "@/server/repositories/reports";
import { localizedEntries, SITEMAP_PAGE, urlSet, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const page = Number((await ctx.params).page.replace(/\.xml$/, ""));
  if (!Number.isInteger(page) || page < 0) return new Response("Not found", { status: 404 });
  const rows = await indexableReports(SITEMAP_PAGE, page * SITEMAP_PAGE);
  if (!rows.length && page > 0) return new Response("Not found", { status: 404 });
  const base = config.publicUrl.replace(/\/$/, "");
  return xmlResponse(
    urlSet(
      localizedEntries(
        base,
        rows.map((r) => ({
          path: `/site/${encodeURIComponent(r.domain)}`,
          lastmod: new Date(r.scannedAt),
          changefreq: "weekly",
          priority: 0.6,
        })),
      ),
    ),
  );
}
