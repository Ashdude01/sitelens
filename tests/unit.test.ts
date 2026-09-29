import { describe, expect, it } from "vitest";
import { config } from "@/server/config";
import { InputError, isPrivateIp, normalizeTarget, resolvePublicIps, robotsAllows, safeFetch } from "@/server/scanner/net";
import { estimateFromSignals, fitSource, type Calibration } from "@/server/traffic/estimator";
import { extractPageData, detectTechnologies } from "@/server/scanner/fingerprints";

function withProductionNetwork<T>(fn: () => T): T {
  config.allowPrivateNetwork = false;
  try {
    return fn();
  } finally {
    config.allowPrivateNetwork = true;
  }
}

describe("normalizeTarget", () => {
  it("canonicalises domains and rejects non-public input", () =>
    withProductionNetwork(() => {
      expect(normalizeTarget("https://www.Example.co.uk/path?q=1").key).toBe("example.co.uk");
      expect(normalizeTarget("blog.example.com")).toMatchObject({ key: "blog.example.com", domain: "example.com" });
      for (const bad of ["localhost", "10.0.0.1", "example.com:8443", "ftp://example.com", "", "not a domain"]) {
        expect(() => normalizeTarget(bad), bad).toThrow(InputError);
      }
    }));
});

describe("SSRF guard", () => {
  it("classifies private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "::1", "::ffff:127.0.0.1", "fd00::1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("refuses private, metadata and odd-port targets", async () => {
    config.allowPrivateNetwork = false;
    try {
      await expect(safeFetch("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/private/);
      await expect(safeFetch("http://127.0.0.2/")).rejects.toThrow(/private/);
      await expect(resolvePublicIps("localhost")).rejects.toThrow(/private/);
      await expect(safeFetch("http://127.0.0.2:8080/")).rejects.toThrow(/port/);
    } finally {
      config.allowPrivateNetwork = true;
    }
  });
});

describe("robots.txt", () => {
  it("follows the most specific group and longest rule", () => {
    const txt = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/ok\n";
    expect(robotsAllows(txt, "SiteLensBot", "/")).toBe(true);
    expect(robotsAllows(txt, "SiteLensBot", "/private/x")).toBe(false);
    expect(robotsAllows(txt, "SiteLensBot", "/private/ok/1")).toBe(true);
    expect(robotsAllows(txt, "Googlebot", "/")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /\n\nUser-agent: SiteLensBot\nAllow: /\n", "SiteLensBot", "/")).toBe(true);
  });
});

describe("fingerprints", () => {
  it("detects from headers, meta, scripts, DNS and SSL with evidence and versions", () => {
    const page = extractPageData({
      url: "https://ex.com/",
      headers: { server: "cloudflare", "cf-ray": "x", "x-powered-by": "PHP/8.2.1" },
      cookies: { _ga: "1" },
      html: `<html><head><meta name="generator" content="WordPress 6.5.2"><script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head><body></body></html>`,
      dns: { MX: ["aspmx.l.google.com"], NS: ["a.ns.cloudflare.com"], TXT: [], SOA: [], CNAME: [], A: [], AAAA: [], DMARC: null },
      cert: { issuerOrg: "Let's Encrypt", issuerCN: "R11", subjectCN: null, validFrom: null, validTo: null, sanCount: 0, protocol: null, trusted: true, error: null },
    });
    const byName = Object.fromEntries(detectTechnologies(page).map((t) => [t.name, t]));
    expect(byName.WordPress.version).toBe("6.5.2");
    expect(byName.PHP.version).toBe("8.2.1");
    expect(byName.MySQL.implied).toBe(true);
    expect(byName["Google Workspace"].evidence[0]).toMatch(/DNS MX/);
    expect(byName.Cloudflare).toBeDefined();
    expect(byName["Let's Encrypt"]).toBeDefined();
  });
});

describe("estimator", () => {
  const cal: Calibration = { calibrated: true, sources: { default: { a: 10.9, b: -1.1, sigma: 0.3, n: 50 } } };

  it("widens the range when signals disagree and counts CrUX bucket width", () => {
    const agree = estimateFromSignals([{ source: "umbrella", rank: 10000 }, { source: "majestic", rank: 11000 }], cal)!;
    const disagree = estimateFromSignals([{ source: "umbrella", rank: 1000 }, { source: "majestic", rank: 1000000 }], cal)!;
    expect(disagree.sigmaLog10).toBeGreaterThan(agree.sigmaLog10 * 2);
    expect(disagree.confidence).toBe("Low");
    const crux = estimateFromSignals([{ source: "crux", rank: 500000 }], cal)!;
    const exact = estimateFromSignals([{ source: "umbrella", rank: 300000 }], cal)!;
    expect(crux.sigmaLog10).toBeGreaterThan(exact.sigmaLog10);
    expect(estimateFromSignals([], cal)).toBeNull();
  });

  it("never claims High confidence while uncalibrated", () => {
    const e = estimateFromSignals([{ source: "umbrella", rank: 5000 }], { calibrated: false, sources: { default: { a: 10, b: -1, sigma: 0.1 } } })!;
    expect(e.confidence).toBe("Medium");
  });

  it("fitSource recovers a known power law", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
    const gauss = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
    const pts = Array.from({ length: 200 }, () => {
      const x = 2 + rand() * 4;
      return { x, y: 10.2 - 1.05 * x + 0.2 * gauss() };
    });
    const f = fitSource(pts);
    expect(f.b).toBeCloseTo(-1.05, 1);
    expect(f.a).toBeCloseTo(10.2, 0);
    expect(f.sigma).toBeGreaterThan(0.15);
    expect(f.sigma).toBeLessThan(0.26);
  });
});
