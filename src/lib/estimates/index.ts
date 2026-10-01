// Turns a scan report into HypeStat-style metrics (visits, pageviews, engagement, earnings, worth),
// but honestly: every number is a range, and every modeled number says what it is based on.
//
// Uncertainty is propagated in log space: a product of independent log-normal factors is log-normal,
// and its spread is the root-sum-square of the factors' spreads. That keeps ranges realistic instead of
// multiplying worst cases together (which would make every range ~20x wide).
import type { Report, Technology } from "@/lib/types";
import {
  ADBLOCK_RATE,
  AD_CATEGORIES,
  AFFILIATE_CATEGORIES,
  CCTLD,
  DAYS_PER_MONTH,
  DEFAULT_INTERNET_USERS_M,
  INTERNET_USERS_M,
  RPM_BY_TIER,
  RPM_UNKNOWN_MIX,
  SITE_TYPES,
  VISITS_PER_DAILY_UNIQUE,
  VISITS_PER_MONTHLY_UNIQUE,
  WORTH_MONTHS_OF_REVENUE,
  tierOf,
  type Range2,
  type SiteTypeId,
  type Tier,
} from "./assumptions";

// ---------- log-normal range algebra ----------

/** A positive quantity with a median and a spread (σ of log10). low/high ≈ 16th/84th percentile. */
export interface Est {
  mid: number;
  sigma: number;
}
export interface Range3 {
  low: number;
  mid: number;
  high: number;
}

export const est = (mid: number, sigma = 0): Est => ({ mid, sigma });
export const fromRange = ([low, high]: Range2): Est => ({ mid: Math.sqrt(low * high), sigma: Math.log10(high / low) / 2 });
export const mul = (...xs: Est[]): Est => ({
  mid: xs.reduce((p, x) => p * x.mid, 1),
  sigma: Math.sqrt(xs.reduce((s, x) => s + x.sigma ** 2, 0)),
});
export const scale = (x: Est, k: number): Est => ({ mid: x.mid * k, sigma: x.sigma });
export const toRange = (x: Est): Range3 => ({ low: x.mid / 10 ** x.sigma, mid: x.mid, high: x.mid * 10 ** x.sigma });

// ---------- site type ----------

const has = (techs: Technology[], cat: string) => techs.some((t) => t.confidence >= 50 && t.categories.includes(cat));
const hasName = (techs: Technology[], names: string[]) => techs.some((t) => t.confidence >= 50 && names.includes(t.name));

export function classifySite(r: Report): { id: SiteTypeId; label: string; reason: string } {
  const t = r.technologies;
  const sd = r.site?.structuredData ?? [];
  const pick = (id: SiteTypeId, reason: string) => ({ id, label: SITE_TYPES[id].label, reason });
  if (has(t, "Ecommerce") || sd.includes("Product") || sd.includes("Offer")) return pick("ecommerce", "An ecommerce platform or product markup was detected.");
  if (sd.some((x) => /NewsArticle|NewsMediaOrganization/.test(x))) return pick("news", "News article markup was detected.");
  if (has(t, "Message boards")) return pick("forum", "Forum software was detected.");
  if (has(t, "Documentation") || hasName(t, ["Docusaurus", "GitBook", "Read the Docs", "MkDocs", "VuePress", "Mintlify"]))
    return pick("docs", "A documentation platform was detected.");
  if (has(t, "Blogs") || (has(t, "CMS") && hasName(t, ["WordPress", "Ghost", "Blogger", "Substack", "Medium"])))
    return pick("blog", "A blogging CMS was detected.");
  if ((has(t, "JavaScript frameworks") || has(t, "Web frameworks")) && (has(t, "Payment processors") || has(t, "Live chat") || has(t, "CRM") || has(t, "Customer data platform")))
    return pick("saas", "An app framework plus payments, live chat or CRM tools were detected.");
  return pick("website", "No strong signal for a specific site type.");
}

// ---------- countries ----------

const regionNames = new Map<string, Intl.DisplayNames>();
export const countryName = (code: string, locale = "en") => {
  try {
    let names = regionNames.get(locale);
    if (!names) {
      names = new Intl.DisplayNames([locale], { type: "region" });
      regionNames.set(locale, names);
    }
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};
export const flag = (code: string) =>
  /^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐";

const CRUX_BUCKETS = [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000];
const midBucket = (rank: number) => {
  const i = CRUX_BUCKETS.indexOf(rank);
  return i >= 0 ? Math.sqrt((i > 0 ? CRUX_BUCKETS[i - 1] : 100) * rank) : rank;
};

/**
 * Estimated share of visits per country from CrUX per-country popularity ranks.
 * A rank r in a country with U internet users suggests visits ∝ U × r^b (same power law as the traffic model).
 */
export function estimateCountryShares(countries: { country: string; rank: number }[], b = -1.1) {
  if (!countries.length) return [];
  const w = countries.map((c) => ({
    code: c.country.toUpperCase(),
    weight: (INTERNET_USERS_M[c.country.toUpperCase()] ?? DEFAULT_INTERNET_USERS_M) * midBucket(c.rank) ** b,
  }));
  const total = w.reduce((s, x) => s + x.weight, 0);
  return w
    .map((x) => ({ code: x.code, name: countryName(x.code), share: x.weight / total }))
    .sort((a, b2) => b2.share - a.share);
}

// ---------- earnings ----------

function blendedRpm(shares: { code: string; share: number }[], tldCountry: string | null): { rpm: Est; basis: string } {
  if (shares.length) {
    // Share-weighted average in log space of each tier's range.
    const byTier: Record<Tier, number> = { t1: 0, t2: 0, t3: 0 };
    for (const s of shares) byTier[tierOf(s.code)] += s.share;
    let logMid = 0;
    let sigma2 = 0;
    for (const tier of ["t1", "t2", "t3"] as Tier[]) {
      const e = fromRange(RPM_BY_TIER[tier]);
      logMid += byTier[tier] * Math.log10(e.mid);
      sigma2 += byTier[tier] * e.sigma ** 2;
    }
    // Arithmetic mix of tiers is higher than the log mix; correct toward the arithmetic mean.
    const arith = (["t1", "t2", "t3"] as Tier[]).reduce((s, t) => s + byTier[t] * fromRange(RPM_BY_TIER[t]).mid, 0);
    return { rpm: { mid: Math.max(10 ** logMid, arith * 0.85), sigma: Math.sqrt(sigma2) }, basis: "estimated visitor countries" };
  }
  if (tldCountry) {
    const t = fromRange(RPM_BY_TIER[tierOf(tldCountry)]);
    const g = fromRange(RPM_UNKNOWN_MIX);
    return { rpm: { mid: 10 ** (0.6 * Math.log10(t.mid) + 0.4 * Math.log10(g.mid)), sigma: Math.max(t.sigma, g.sigma) }, basis: `the .${tldCountry.toLowerCase()} domain` };
  }
  return { rpm: fromRange(RPM_UNKNOWN_MIX), basis: "a global audience mix (visitor countries unknown)" };
}

// ---------- main ----------

export interface Estimates {
  siteType: ReturnType<typeof classifySite>;
  verified: boolean;
  visits: { monthly: Range3; daily: Range3; dailyUnique: Range3; monthlyUnique: Range3 } | null;
  pageviews: { daily: Range3; monthly: Range3 } | null;
  engagement: { pagesPerVisit: Range3; durationSec: Range3; bouncePct: Range3 };
  countries: { code: string; name: string; share: number }[];
  earnings: {
    kind: "estimated" | "potential";
    adNetworks: string[];
    affiliate: string[];
    rpm: Range3;
    rpmBasis: string;
    adblock: Range2;
    daily: Range3;
    monthly: Range3;
    yearly: Range3;
  } | null;
  worth: Range3 | null;
  bestRank: { source: string; rank: number; label: string } | null;
}

export function computeEstimates(r: Report): Estimates {
  const siteType = classifySite(r);
  const profile = SITE_TYPES[siteType.id];
  const tr = r.traffic;

  let monthlyVisits: Est | null = null;
  if (tr.verified) monthlyVisits = est(tr.verified.monthlyVisits, 0);
  else if (tr.estimate) monthlyVisits = { mid: tr.estimate.monthlyVisits.mid, sigma: tr.estimate.sigmaLog10 };

  const ppv = fromRange(profile.pagesPerVisit);
  const engagement = {
    pagesPerVisit: toRange(ppv),
    durationSec: toRange(fromRange(profile.durationSec)),
    bouncePct: toRange(fromRange(profile.bouncePct)),
  };

  const countries = estimateCountryShares(tr.countries);
  const tld = r.registrableDomain.split(".").pop() ?? "";
  const tldCountry = CCTLD[tld] ?? null;

  const bestRank = tr.ranks.length
    ? [...tr.ranks].sort((a, b) => a.rank - b.rank).map((s) => ({ source: s.source, rank: s.rank, label: s.label }))[0]
    : null;

  if (!monthlyVisits) {
    return { siteType, verified: false, visits: null, pageviews: null, engagement, countries, earnings: null, worth: null, bestRank };
  }

  const daily = scale(monthlyVisits, 1 / DAYS_PER_MONTH);
  const monthlyPv = mul(monthlyVisits, ppv);
  const dailyPv = scale(monthlyPv, 1 / DAYS_PER_MONTH);
  const vpu = fromRange(VISITS_PER_MONTHLY_UNIQUE);

  const adNetworks = r.technologies.filter((t) => t.confidence >= 50 && t.categories.some((c) => AD_CATEGORIES.includes(c))).map((t) => t.name);
  const affiliate = r.technologies.filter((t) => t.confidence >= 50 && t.categories.some((c) => AFFILIATE_CATEGORIES.includes(c))).map((t) => t.name);
  const { rpm, basis } = blendedRpm(countries, tldCountry);
  const notBlocked = fromRange([1 - ADBLOCK_RATE[1], 1 - ADBLOCK_RATE[0]]);
  const monthlyRevenue = mul(monthlyPv, scale(rpm, 1 / 1000), notBlocked);
  const worth = mul(monthlyRevenue, fromRange(WORTH_MONTHS_OF_REVENUE));

  return {
    siteType,
    verified: !!tr.verified,
    visits: {
      monthly: toRange(monthlyVisits),
      daily: toRange(daily),
      dailyUnique: toRange(scale(daily, 1 / VISITS_PER_DAILY_UNIQUE)),
      monthlyUnique: toRange(mul(monthlyVisits, { mid: 1 / vpu.mid, sigma: vpu.sigma })),
    },
    pageviews: { daily: toRange(dailyPv), monthly: toRange(monthlyPv) },
    engagement,
    countries,
    earnings: {
      kind: adNetworks.length ? "estimated" : "potential",
      adNetworks,
      affiliate,
      rpm: toRange(rpm),
      rpmBasis: basis,
      adblock: ADBLOCK_RATE,
      daily: toRange(scale(monthlyRevenue, 1 / DAYS_PER_MONTH)),
      monthly: toRange(monthlyRevenue),
      yearly: toRange(scale(monthlyRevenue, 12)),
    },
    worth: toRange(worth),
    bestRank,
  };
}
