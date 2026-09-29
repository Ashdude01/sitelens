// Every assumption behind modeled metrics lives here, so it is easy to review, tune and publish.
// These are rough industry-typical ranges, NOT measurements. Tune them as you collect verified data.
// Each [low, high] pair is treated as roughly the 16th–84th percentile (±1σ in log space).

export type Range2 = readonly [low: number, high: number];

export type SiteTypeId = "ecommerce" | "blog" | "news" | "saas" | "docs" | "forum" | "website";

export interface SiteTypeProfile {
  label: string;
  /** Pages viewed per visit. */
  pagesPerVisit: Range2;
  /** Average visit duration, seconds. */
  durationSec: Range2;
  /** Share of single-page visits, %. */
  bouncePct: Range2;
  /** How typical display-ad monetization is for this kind of site (used for the "potential" wording). */
  adsTypical: boolean;
}

export const SITE_TYPES: Record<SiteTypeId, SiteTypeProfile> = {
  ecommerce: { label: "Online store", pagesPerVisit: [3.5, 6], durationSec: [180, 360], bouncePct: [35, 50], adsTypical: false },
  blog: { label: "Blog / content site", pagesPerVisit: [1.4, 2.2], durationSec: [60, 150], bouncePct: [55, 75], adsTypical: true },
  news: { label: "News / media", pagesPerVisit: [1.8, 3], durationSec: [90, 200], bouncePct: [50, 70], adsTypical: true },
  saas: { label: "Web app / SaaS", pagesPerVisit: [2.5, 5], durationSec: [180, 480], bouncePct: [30, 50], adsTypical: false },
  docs: { label: "Documentation", pagesPerVisit: [2, 4], durationSec: [120, 300], bouncePct: [40, 60], adsTypical: false },
  forum: { label: "Forum / community", pagesPerVisit: [3, 6], durationSec: [240, 600], bouncePct: [30, 50], adsTypical: true },
  website: { label: "Website", pagesPerVisit: [1.8, 3], durationSec: [60, 150], bouncePct: [45, 65], adsTypical: false },
};

/** Visits per unique visitor within a month. */
export const VISITS_PER_MONTHLY_UNIQUE: Range2 = [1.3, 2.0];
/** Visits per unique visitor within a day. */
export const VISITS_PER_DAILY_UNIQUE = 1.1;
export const DAYS_PER_MONTH = 30.4;

// ---- Display-ad earnings -------------------------------------------------------------------
// Page RPM = publisher revenue per 1,000 pageviews from display ads, USD, by visitor country.
// Cross-check: HypeStat's published numbers imply ~$3.5 for a global mix (wordpress.org) and ~$0.6 for
// an India-heavy audience (zerodha.com), which sits inside these tiers.
export type Tier = "t1" | "t2" | "t3";
export const RPM_BY_TIER: Record<Tier, Range2> = {
  t1: [3, 8], // US, UK, CA, AU, Nordics, DACH, Benelux…
  t2: [1.2, 3.5], // rest of Europe, Japan, Korea, Gulf, Singapore, Israel…
  t3: [0.3, 1.2], // India, South/South-East Asia, Africa, most of Latin America…
};
/** When we know nothing about where visitors come from. */
export const RPM_UNKNOWN_MIX: Range2 = [0.8, 4];
/** Share of pageviews that show no ads because of ad blockers. */
export const ADBLOCK_RATE: Range2 = [0.08, 0.25];

// ---- Valuation ------------------------------------------------------------------------------
/** Content sites commonly sell for this many months of (ad) revenue on marketplaces. */
export const WORTH_MONTHS_OF_REVENUE: Range2 = [24, 40];

// ---- Countries ------------------------------------------------------------------------------
const T1 = ["US", "GB", "CA", "AU", "NZ", "IE", "CH", "NO", "DK", "SE", "FI", "NL", "BE", "DE", "AT", "LU", "IS"];
const T2 = ["FR", "IT", "ES", "PT", "JP", "KR", "SG", "HK", "TW", "AE", "SA", "QA", "KW", "IL", "PL", "CZ", "SK", "SI", "EE", "LV", "LT", "GR", "HU", "HR", "CL", "UY", "CY", "MT"];
export function tierOf(country: string): Tier {
  const c = country.toUpperCase();
  if (T1.includes(c)) return "t1";
  if (T2.includes(c)) return "t2";
  return "t3";
}

/** Approximate internet users, millions (rounded). Used only to weight per-country popularity ranks. */
export const INTERNET_USERS_M: Record<string, number> = {
  CN: 1090, IN: 900, US: 320, ID: 220, BR: 180, RU: 130, NG: 120, PK: 110, JP: 100, MX: 100, PH: 85, BD: 80, EG: 80,
  VN: 80, DE: 78, TR: 75, IR: 70, GB: 66, FR: 60, TH: 60, IT: 51, KR: 50, ES: 45, AR: 40, CO: 38, CA: 36, SA: 34,
  PL: 33, UA: 30, MY: 30, ZA: 30, KE: 25, AU: 25, PE: 25, DZ: 25, MA: 30, NL: 17, TW: 21, UZ: 25, IQ: 30, VE: 20,
  RO: 17, CL: 18, NP: 15, LK: 12, KZ: 18, BE: 11, SE: 10, CZ: 10, PT: 9, GR: 8, HU: 8, AE: 10, IL: 9, CH: 8, AT: 8,
  HK: 7, SG: 5.5, DK: 5.8, FI: 5.3, NO: 5.4, NZ: 4.7, IE: 4.8,
};
export const DEFAULT_INTERNET_USERS_M = 5;

/** ccTLD → country, used as a weak hint when we have no country data. */
export const CCTLD: Record<string, string> = {
  in: "IN", uk: "GB", us: "US", ca: "CA", au: "AU", de: "DE", fr: "FR", jp: "JP", br: "BR", es: "ES", it: "IT", nl: "NL",
  pk: "PK", bd: "BD", id: "ID", ph: "PH", vn: "VN", ng: "NG", ru: "RU", mx: "MX", kr: "KR", sg: "SG", ae: "AE", za: "ZA",
  tr: "TR", pl: "PL", se: "SE", ch: "CH", nz: "NZ", ie: "IE", my: "MY", th: "TH", eg: "EG", sa: "SA", np: "NP", lk: "LK",
};

/** Tech categories (Wappalyzer names) that mean the site shows ads or earns from affiliate links. */
export const AD_CATEGORIES = ["Advertising"];
export const AFFILIATE_CATEGORIES = ["Affiliate programs"];
