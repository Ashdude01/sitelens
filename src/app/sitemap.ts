import type { MetadataRoute } from "next";
import { config } from "@/server/config";
import { indexableReports, techUsageCounts } from "@/server/repositories/reports";
import { loadFingerprints } from "@/server/scanner/fingerprints";

// Rendered per request so new reports appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rows, usage] = await Promise.all([indexableReports(45_000), techUsageCounts()]);
  const fp = loadFingerprints();
  // Technology pages are only listed once they have real data behind them (3+ sites).
  const techPages = [...usage.entries()]
    .filter(([, n]) => n >= 3)
    .map(([name]) => fp.byName[name])
    .filter(Boolean)
    .map((t) => ({ url: `${config.publicUrl}/technology/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.5 }));
  return [
    { url: `${config.publicUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${config.publicUrl}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${config.publicUrl}/technologies`, changeFrequency: "weekly", priority: 0.6 },
    ...techPages,
    ...rows.map((r) => ({
      url: `${config.publicUrl}/site/${r.domain}`,
      lastModified: new Date(r.scannedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
