import { config } from "@/server/config";
import { techUsageCounts } from "@/server/repositories/reports";
import { loadFingerprints, slugify } from "@/server/scanner/fingerprints";
import { localizedEntries, urlSet, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET() {
  const base = config.publicUrl.replace(/\/$/, "");
  const [usage, fp] = [await techUsageCounts(), loadFingerprints()];
  const cats = new Set<string>();
  const techs = [...usage.entries()]
    .filter(([, n]) => n >= 3)
    .map(([name]) => fp.byName[name])
    .filter(Boolean);
  for (const t of techs) {
    const cat = t.cats[0] != null ? fp.categories[t.cats[0]]?.name : undefined;
    if (cat) cats.add(cat);
  }
  return xmlResponse(
    urlSet(
      localizedEntries(base, [
        ...[...cats].map((name) => ({ path: `/technologies/${slugify(name)}`, changefreq: "weekly" as const, priority: 0.4 })),
        ...techs.map((t) => ({ path: `/technology/${t.slug}`, changefreq: "weekly" as const, priority: 0.5 })),
      ]),
    ),
  );
}
