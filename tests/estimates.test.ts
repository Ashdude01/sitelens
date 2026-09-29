import { describe, expect, it } from "vitest";
import { computeEstimates, estimateCountryShares, fromRange, mul, toRange, classifySite } from "@/lib/estimates";
import { computeScores } from "@/lib/estimates/scores";
import { summarize } from "@/lib/estimates/summary";
import type { Report } from "@/lib/types";

const tech = (name: string, categories: string[]) => ({ name, categories, confidence: 100, priority: 2, implied: false, version: null, saas: false, oss: false, pricing: [], evidence: [] });

function report(over: Partial<Report> & { visits?: number; sigma?: number; countries?: { country: string; rank: number }[] } = {}): Report {
  const { visits, sigma = 0.35, countries = [], ...rest } = over;
  return {
    version: 1, domain: "example.com", registrableDomain: "example.com", scannedAt: new Date().toISOString(), scanMs: 1, mode: "http",
    fetch: { ok: true, status: 200, finalUrl: "https://example.com/", redirects: 0, hops: [], responseMs: 300, bytes: 40_000, truncated: false, contentType: "text/html" },
    robots: { found: true, allowed: true, sitemaps: ["https://example.com/sitemap.xml"] },
    technologies: [],
    site: { title: "Example Domain — a good title", description: "A description that is long enough to count as a proper meta description.", language: "en", canonical: "https://example.com/", ogImage: null, siteName: null, generator: null, robotsMeta: null, favicon: null, links: { internal: 3, external: 1 }, social: {}, structuredData: [], headings: { h1: 1, h2: 2 }, images: { total: 0, missingAlt: 0 } },
    hosting: { ip: null, ipv6: false, asn: null, nameservers: [], mx: [], spf: "v=spf1 -all", dmarc: null, verificationTxt: [] },
    security: { https: true, hsts: true, csp: false, xFrameOptions: false, referrerPolicy: true, compression: "br" },
    cert: null, registration: null, notes: [],
    traffic: {
      verdict: visits ? "estimated" : "unknown", verified: null,
      estimate: visits ? { monthlyVisits: { low: visits / 10 ** sigma, mid: visits, high: visits * 10 ** sigma }, sigmaLog10: sigma, confidence: "Medium", calibrated: false, signalsUsed: [] } : null,
      ranks: [], countries, crux: null, organic: null,
    },
    ...rest,
  } as Report;
}

describe("range algebra", () => {
  it("multiplies medians and adds spreads in quadrature", () => {
    const a = fromRange([10, 1000]); // mid 100, sigma 1
    const b = fromRange([1, 100]); // mid 10, sigma 1
    const c = mul(a, b);
    expect(c.mid).toBeCloseTo(1000);
    expect(c.sigma).toBeCloseTo(Math.SQRT2);
    const r = toRange(c);
    expect(r.low).toBeLessThan(r.mid);
    expect(r.high / r.mid).toBeCloseTo(r.mid / r.low);
  });
});

describe("computeEstimates", () => {
  it("returns only benchmarks when traffic is unknown", () => {
    const e = computeEstimates(report());
    expect(e.visits).toBeNull();
    expect(e.earnings).toBeNull();
    expect(e.engagement.pagesPerVisit.mid).toBeGreaterThan(1);
  });

  it("derives daily visitors, pageviews, revenue and worth from monthly visits", () => {
    const e = computeEstimates(report({ visits: 3_000_000 }));
    expect(e.visits!.daily.mid).toBeCloseTo(3_000_000 / 30.4, -2);
    expect(e.pageviews!.monthly.mid).toBeGreaterThan(3_000_000);
    expect(e.earnings!.kind).toBe("potential");
    expect(e.earnings!.yearly.mid).toBeCloseTo(e.earnings!.monthly.mid * 12);
    expect(e.worth!.mid).toBeGreaterThan(e.earnings!.monthly.mid * 24);
    expect(e.worth!.mid).toBeLessThan(e.earnings!.monthly.mid * 40);
  });

  it("says 'estimated' only when an ad network is detected", () => {
    const e = computeEstimates(report({ visits: 50_000, technologies: [tech("Google AdSense", ["Advertising"])] as never }));
    expect(e.earnings!.kind).toBe("estimated");
    expect(e.earnings!.adNetworks).toEqual(["Google AdSense"]);
  });

  it("India-heavy audiences earn less per pageview than US-heavy ones", () => {
    const india = computeEstimates(report({ visits: 1e6, countries: [{ country: "IN", rank: 1000 }] }));
    const us = computeEstimates(report({ visits: 1e6, countries: [{ country: "US", rank: 1000 }] }));
    expect(us.earnings!.rpm.mid).toBeGreaterThan(india.earnings!.rpm.mid * 3);
  });

  it("uses the ccTLD as a weak hint when countries are unknown", () => {
    const e = computeEstimates(report({ visits: 1e6, registrableDomain: "shop.in" }));
    expect(e.earnings!.rpmBasis).toMatch(/\.in domain/);
  });

  it("uses verified traffic exactly", () => {
    const r = report({ visits: 1e6 });
    r.traffic.verified = { monthlyVisits: 120_000, period: "2026-08" };
    const e = computeEstimates(r);
    expect(e.verified).toBe(true);
    expect(e.visits!.monthly.low).toBe(120_000);
    expect(e.visits!.monthly.high).toBe(120_000);
  });
});

describe("country shares", () => {
  it("weights per-country popularity by internet population", () => {
    const s = estimateCountryShares([{ country: "IN", rank: 10000 }, { country: "US", rank: 10000 }, { country: "SG", rank: 1000 }]);
    expect(s.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1);
    expect(s[0].code).toBe("IN");
    expect(s.find((x) => x.code === "US")!.share).toBeGreaterThan(s.find((x) => x.code === "SG")!.share / 2);
  });
});

describe("classification, scores, summary", () => {
  it("classifies from the tech stack", () => {
    expect(classifySite(report({ technologies: [tech("Shopify", ["Ecommerce"])] as never })).id).toBe("ecommerce");
    expect(classifySite(report({ technologies: [tech("WordPress", ["CMS", "Blogs"])] as never })).id).toBe("blog");
    expect(classifySite(report()).id).toBe("website");
  });

  it("scores security, SEO and performance with explainable checks", () => {
    const scores = computeScores(report())!;
    expect(scores.map((s) => s.id)).toEqual(["security", "seo", "performance"]);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.checks.length).toBeGreaterThan(0);
    }
    expect(scores.find((s) => s.id === "performance")!.grade).toBe("A");
  });

  it("writes a readable summary", () => {
    const txt = summarize(report({ visits: 2e6, technologies: [tech("WordPress", ["CMS", "Blogs"])] as never }), computeEstimates(report({ visits: 2e6, technologies: [tech("WordPress", ["CMS", "Blogs"])] as never })));
    expect(txt).toMatch(/example\.com looks like a blog/);
    expect(txt).toMatch(/visits a month/);
  });
});
