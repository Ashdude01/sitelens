import { config } from "@/server/config";
import { countIndexableReports } from "@/server/repositories/reports";
import { SITEMAP_PAGE, sitemapIndex, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  const n = await countIndexableReports();
  const sitePages = Math.max(1, Math.ceil(n / SITEMAP_PAGE));
  const base = config.publicUrl.replace(/\/$/, "");
  const locs = [
    `${base}/sitemaps/pages.xml`,
    `${base}/sitemaps/technologies.xml`,
    ...Array.from({ length: sitePages }, (_, i) => `${base}/sitemaps/sites/${i}.xml`),
  ];
  return xmlResponse(sitemapIndex(locs));
}
