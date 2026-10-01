// PageSpeed, technology pages data, exports and embeds.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFixtures } from "./fixtures";
import { psiFixture } from "./psi-fixture";
import { normalizePsi } from "@/server/pagespeed/psi";
import { getPagespeed } from "@/server/services/pagespeed-service";
import { getOrScanReport, getReport } from "@/server/services/report-service";
import { popularSiteCards, recentSiteCards, sitesUsingTech, techUsageCounts } from "@/server/repositories/reports";
import { buildCardData } from "@/server/export/card-data";
import { renderCardImage } from "@/server/export/card-image";
import { renderPdf } from "@/server/export/pdf";
import { renderBadge } from "@/server/export/badge";
import { badgeSnippet, htmlCardSnippet, imageCardSnippet } from "@/lib/embed-snippets";
import { loadFingerprints } from "@/server/scanner/fingerprints";
import { replaceSource } from "@/server/repositories/ranks";

let stop: () => Promise<unknown>;
beforeAll(async () => {
  stop = await startFixtures(8080);
  // Own traffic data so this file doesn't depend on other test files.
  await replaceSource("umbrella", (async function* () {
    yield { domain: "127.0.0.2", rank: 5000 };
    yield { domain: "127.0.0.3", rank: 120000 };
  })());
  await getOrScanReport("127.0.0.2:8080", { force: true });
  await getOrScanReport("127.0.0.3:8080", { force: true });
});
afterAll(async () => {
  await stop?.();
});

describe("PageSpeed Insights", () => {
  it("normalizes scores, field data, lab metrics and opportunities", () => {
    const r = normalizePsi(psiFixture("mobile"), "mobile");
    expect(r.scores.map((s) => s.score)).toEqual([64, 88, 96, 100]);
    expect(r.field?.scope).toBe("url");
    expect(r.field?.passed).toBe(false); // LCP is only "needs improvement"
    const cls = r.field!.metrics.find((m) => m.id === "CLS")!;
    expect(cls.p75).toBeCloseTo(0.05);
    expect(cls.distribution.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(r.lab.find((m) => m.id === "largest-contentful-paint")?.rating).toBe("poor");
    expect(r.opportunities.map((o) => o.title)).toEqual(["Eliminate render-blocking resources", "Reduce unused JavaScript"]);
    expect(r.screenshot).toMatch(/^data:image\/jpeg/);
    expect(normalizePsi(psiFixture("desktop"), "desktop").field?.passed).toBe(true);
  });

  it("fetches through the API once, then serves the cache", async () => {
    const first = await getPagespeed("127.0.0.2:8080", "desktop", { force: true });
    expect(first.cached).toBe(false);
    expect(first.result.scores[0].score).toBe(93);
    expect(first.result.testedUrl).toContain("127.0.0.2");
    const second = await getPagespeed("127.0.0.2:8080", "desktop");
    expect(second.cached).toBe(true);
  });
});

describe("technology pages data", () => {
  it("slugs resolve and usage counts come from the latest scans", async () => {
    const fp = loadFingerprints();
    expect(fp.bySlug["wordpress"].name).toBe("WordPress");
    expect(fp.icons.has("WordPress.svg")).toBe(true);
    const usage = await techUsageCounts();
    expect(usage.get("WordPress")).toBeGreaterThanOrEqual(1);
    const { total, sites } = await sitesUsingTech("Shopify");
    expect(total).toBe(1);
    expect(sites[0].domain).toBe("127.0.0.3:8080");
    const report = await getReport("127.0.0.2:8080");
    expect(report!.technologies.find((t) => t.name === "WordPress")?.slug).toBe("wordpress");
  });

  it("lists recent and popular sites", async () => {
    const recent = await recentSiteCards(5);
    expect(recent.length).toBeGreaterThanOrEqual(2);
    const popular = await popularSiteCards(5);
    expect(popular[0].domain).toBe("127.0.0.2:8080"); // highest estimated traffic
    expect(popular[0].techs.length).toBeGreaterThan(0);
  });
});

describe("exports and embeds", () => {
  it("renders a PNG card and a PDF report with a backlink", async () => {
    const report = (await getReport("127.0.0.2:8080"))!;
    const card = buildCardData(report);
    expect(card.reportUrl).toBe("https://sitelens.test/en/site/127.0.0.2%3A8080");
    const png = new Uint8Array(await (await renderCardImage(card)).arrayBuffer());
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
    const small = new Uint8Array(await (await renderCardImage(card, { width: 600, height: 315 })).arrayBuffer());
    expect(small.length).toBeGreaterThan(1000);
    const pdf = await renderPdf(report, card, png.buffer as ArrayBuffer);
    const head = new TextDecoder().decode(pdf.slice(0, 5));
    expect(head).toBe("%PDF-");
    expect(Buffer.from(pdf).toString("latin1")).toContain("/URI (https://sitelens.test/en/site/127.0.0.2%3A8080)");
  }, 60_000);

  it("badge SVG escapes text and snippets always link back", async () => {
    const svg = renderBadge("a<b", "~5M visits/mo");
    expect(svg).toContain("a&lt;b");
    expect(svg).not.toContain("a<b");
    const card = buildCardData((await getReport("127.0.0.2:8080"))!);
    for (const s of [badgeSnippet("https://sitelens.test", card), imageCardSnippet("https://sitelens.test", card), htmlCardSnippet(card)]) {
      expect(s).toContain('href="https://sitelens.test/en/site/127.0.0.2%3A8080"');
      expect(s).not.toMatch(/<script/i);
    }
  });
});
