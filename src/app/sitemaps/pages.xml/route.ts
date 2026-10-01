import { config } from "@/server/config";
import { localizedEntries, urlSet, xmlResponse } from "@/lib/sitemap-xml";

export const revalidate = 86400;

export function GET() {
  const base = config.publicUrl.replace(/\/$/, "");
  return xmlResponse(
    urlSet(
      localizedEntries(base, [
        { path: "/", changefreq: "daily", priority: 1 },
        { path: "/technologies", changefreq: "weekly", priority: 0.6 },
        { path: "/methodology", changefreq: "monthly", priority: 0.5 },
        { path: "/docs/api", changefreq: "monthly", priority: 0.4 },
      ]),
    ),
  );
}
