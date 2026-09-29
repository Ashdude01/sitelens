import type { SiteInfo } from "@/lib/types";
import type { PageData } from "./fingerprints";

const SOCIAL_HOSTS: Record<string, string> = {
  "x.com": "X / Twitter",
  "twitter.com": "X / Twitter",
  "facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "linkedin.com": "LinkedIn",
  "youtube.com": "YouTube",
  "github.com": "GitHub",
  "tiktok.com": "TikTok",
  "pinterest.com": "Pinterest",
};

/** Page metadata for the report: title, description, language, social profiles, structured data… */
export function extractSiteInfo(page: PageData, finalUrl: string): SiteInfo {
  const $ = page.$;
  const m = (k: string) => page.meta[k]?.[0] ?? null;
  const origin = new URL(finalUrl);
  const bare = (h: string) => h.replace(/^www\./, "");
  const social: Record<string, string> = {};
  let internal = 0;
  let external = 0;

  $("a[href]").each((_, el) => {
    let u: URL;
    try {
      u = new URL($(el).attr("href")!, origin);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    if (bare(u.hostname) === bare(origin.hostname)) {
      internal++;
      return;
    }
    external++;
    const label = SOCIAL_HOSTS[bare(u.hostname)];
    const isProfile = u.pathname.split("/").filter(Boolean).length >= 1 && !/share|intent|sharer/.test(u.pathname);
    if (label && isProfile && !social[label]) social[label] = u.href;
  });

  const jsonLdTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).html() ?? "");
      for (const item of [].concat(j["@graph"] ?? j) as Record<string, unknown>[]) {
        const t = item?.["@type"];
        if (t) ([] as string[]).concat(t as string | string[]).forEach((x) => jsonLdTypes.add(x));
      }
    } catch {
      /* invalid JSON-LD */
    }
  });

  const iconHref = $('link[rel~="icon"]').attr("href");
  let favicon: string | null = null;
  try {
    favicon = new URL(iconHref ?? "/favicon.ico", origin).href;
  } catch {
    favicon = null;
  }

  return {
    title: $("title").first().text().trim().slice(0, 200) || null,
    description: (m("description") ?? m("og:description") ?? "").slice(0, 400) || null,
    language: $("html").attr("lang") ?? null,
    canonical: $('link[rel="canonical"]').attr("href") ?? null,
    ogImage: m("og:image"),
    siteName: m("og:site_name"),
    generator: m("generator"),
    robotsMeta: m("robots"),
    favicon,
    links: { internal, external },
    social,
    structuredData: [...jsonLdTypes].slice(0, 12),
    headings: { h1: $("h1").length, h2: $("h2").length },
    images: { total: $("img").length, missingAlt: $("img:not([alt])").length },
  };
}
