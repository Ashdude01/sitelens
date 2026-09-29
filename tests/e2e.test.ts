// End-to-end: real importer script -> database -> scanner -> report, against local fixture websites.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { startFixtures } from "./fixtures";
import { config } from "@/server/config";
import { getOrScanReport, getTechHistory } from "@/server/services/report-service";
import { indexableReports } from "@/server/repositories/reports";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "sitelens-e2e-"));
let stop: () => Promise<unknown>;

function importList(...args: string[]) {
  return execFileSync(process.execPath, ["--import", "tsx", "scripts/import-ranks.ts", ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
}

beforeAll(async () => {
  stop = await startFixtures(8080);
  fs.writeFileSync(path.join(TMP, "umbrella.zip"), zipSync({ "top-1m.csv": strToU8("1,google.com\n2,microsoft.com\n5000,127.0.0.2\n120000,127.0.0.3\n") }));
  fs.writeFileSync(
    path.join(TMP, "majestic.csv"),
    "GlobalRank,TldRank,Domain,TLD,RefSubNets,RefIPs,IDN_Domain,IDN_TLD,PrevGlobalRank,PrevTldRank,PrevRefSubNets,PrevRefIPs\n1,1,google.com,com,500000,900000,google.com,com,1,1,500000,900000\n8000,1,127.0.0.2,ip,2100,2500,127.0.0.2,ip,8100,1,2000,2400\n",
  );
  fs.writeFileSync(path.join(TMP, "crux.csv"), "origin,rank\nhttps://www.google.com,1000\nhttp://127.0.0.2,10000\n");
  fs.writeFileSync(path.join(TMP, "cc.csv"), "country_code,origin,rank\nin,http://127.0.0.2,1000\nus,http://127.0.0.2,50000\n");
  expect(importList("umbrella", "--file", path.join(TMP, "umbrella.zip"))).toMatch(/Imported 4 rows/);
  expect(importList("majestic", "--file", path.join(TMP, "majestic.csv"))).toMatch(/Imported 2 rows/);
  expect(importList("crux", "--file", path.join(TMP, "crux.csv"))).toMatch(/Imported 2 rows/);
  expect(importList("crux-country", "--file", path.join(TMP, "cc.csv"))).toMatch(/Imported 2 crux-country rows/);
});

afterAll(async () => {
  await stop?.();
});

describe("scanning fixture websites", () => {
  it("WordPress: stack, versions, redirect cookies, metadata, traffic range", async () => {
    const { report: r, fromCache } = await getOrScanReport("127.0.0.2:8080", { force: true });
    expect(fromCache).toBe(false);
    const t = Object.fromEntries(r.technologies.map((x) => [x.name, x]));
    expect(r.fetch.status).toBe(200);
    expect(r.fetch.ok && r.fetch.redirects).toBe(1);
    expect(t.WordPress.version).toBe("6.6.1");
    expect(t.PHP.version).toBe("8.2.12");
    for (const name of ["Nginx", "jQuery", "WooCommerce", "Google Analytics", "MySQL"]) expect(t[name], name).toBeDefined();
    expect(r.site?.title).toBe("Chai & Code — a WordPress blog");
    expect(r.site?.social).toHaveProperty("GitHub");
    expect(r.site?.structuredData).toEqual(["WebSite", "Organization"]);
    expect(r.security?.hsts).toBe(true);
    expect(r.robots.sitemaps).toEqual(["http://127.0.0.2:8080/sitemap.xml"]);

    const tr = r.traffic;
    expect(tr.verdict).toBe("estimated");
    expect(tr.ranks.map((s) => s.source).sort()).toEqual(["crux", "majestic", "umbrella"]);
    const v = tr.estimate!.monthlyVisits;
    expect(v.low).toBeLessThan(v.mid);
    expect(v.mid).toBeLessThan(v.high);
    expect(tr.estimate!.calibrated).toBe(false);
    expect(tr.countries.map((c) => c.country)).toEqual(["IN", "US"]);
  });

  it("Shopify store from headers, cookies and scripts", async () => {
    const { report: r } = await getOrScanReport("127.0.0.3:8080", { force: true });
    const names = r.technologies.map((t) => t.name);
    expect(names).toContain("Shopify");
    expect(names).toContain("Facebook Pixel");
    expect(r.robots.found).toBe(false);
  });

  it("respects robots.txt Disallow", async () => {
    const { report: r } = await getOrScanReport("127.0.0.5:8080", { force: true });
    expect(r.robots.allowed).toBe(false);
    expect(r.fetch.ok).toBe(false);
    expect(r.notes[0]).toMatch(/robots\.txt/);
  });

  it("serves fresh reports from cache and records tech history", async () => {
    const { fromCache } = await getOrScanReport("127.0.0.3:8080");
    expect(fromCache).toBe(true);
    const history = await getTechHistory("127.0.0.3:8080");
    expect(history.map((h) => h.tech)).toContain("Shopify");
  });

  it("only data-rich reports are indexable", async () => {
    const domains = (await indexableReports()).map((r) => r.domain);
    expect(domains).toContain("127.0.0.2:8080");
    expect(domains).not.toContain("127.0.0.5:8080");
  });

  const hasChromium = fs.existsSync("/opt/pw-browsers") || !!process.env.CHROMIUM_PATH;
  it.skipIf(!hasChromium)("headless browser finds runtime-only technologies", async () => {
    const raw = (await getOrScanReport("127.0.0.4:8080", { force: true })).report;
    config.useBrowser = true;
    try {
      const { report: r } = await getOrScanReport("127.0.0.4:8080", { force: true });
      const t = Object.fromEntries(r.technologies.map((x) => [x.name, x]));
      expect(r.mode).toBe("browser");
      expect(t["Next.js"]).toBeDefined();
      expect(t.jQuery?.version).toBe("3.6.4");
      expect(t.HubSpot).toBeDefined();
      expect(raw.technologies.some((x) => x.name === "HubSpot")).toBe(false);
    } finally {
      config.useBrowser = false;
      const { closeBrowser } = await import("@/server/scanner/browser");
      await closeBrowser();
    }
  });
});
