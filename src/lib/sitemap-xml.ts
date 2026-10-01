import { DEFAULT_LOCALE, LOCALES } from "@/i18n/locales";

/** Reports per sitemap file. Each report is listed once per language, under the 50,000 URL limit. */
export const SITEMAP_PAGE = Math.floor(40_000 / LOCALES.length);

type UrlEntry = {
  loc: string;
  lastmod?: Date | string;
  changefreq?: string;
  priority?: number;
  alternates?: { hreflang: string; href: string }[];
};

export function localizedEntries(
  base: string,
  items: { path: string; lastmod?: Date | string; changefreq?: string; priority?: number }[],
): UrlEntry[] {
  return items.flatMap((item) => {
    const suffix = item.path === "/" ? "" : item.path;
    const hrefs = LOCALES.map((locale) => ({
      hreflang: locale.intl,
      href: `${base}/${locale.code}${suffix}`,
    }));
    const alternates = [...hrefs, { hreflang: "x-default", href: `${base}/${DEFAULT_LOCALE}${suffix}` }];
    return hrefs.map((href) => ({
      loc: href.href,
      lastmod: item.lastmod,
      changefreq: item.changefreq,
      priority: item.priority,
      alternates,
    }));
  });
}

export function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function urlSet(entries: UrlEntry[]) {
  const body = entries
    .map((e) => {
      const last = e.lastmod ? `<lastmod>${e.lastmod instanceof Date ? e.lastmod.toISOString() : e.lastmod}</lastmod>` : "";
      const freq = e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : "";
      const pri = e.priority != null ? `<priority>${e.priority.toFixed(1)}</priority>` : "";
      const alts = (e.alternates ?? [])
        .map((a) => `<xhtml:link rel="alternate" hreflang="${xmlEscape(a.hreflang)}" href="${xmlEscape(a.href)}"/>`)
        .join("");
      return `  <url><loc>${xmlEscape(e.loc)}</loc>${last}${freq}${pri}${alts}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export function sitemapIndex(locs: string[]) {
  const body = locs.map((loc) => `  <sitemap><loc>${xmlEscape(loc)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function xmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
