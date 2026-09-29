import type { Report, TrafficInfo } from "@/lib/types";
import { config } from "../config";
import {
  checkRobots,
  describeFetchError,
  fetchHomepage,
  getDnsInfo,
  getRdap,
  getTlsInfo,
  type FetchResult,
  type Target,
} from "./net";
import { detectTechnologies, extractPageData, loadFingerprints, type BrowserData } from "./fingerprints";
import { extractSiteInfo } from "./site-info";

/** Things the scanner needs from the outside world, injected so the engine stays storage-agnostic. */
export interface ScanDeps {
  getTraffic: (target: Target, finalOrigin: string) => Promise<TrafficInfo>;
  lookupAsn: (ip: string) => Promise<Report["hosting"]["asn"]>;
}

export async function runScan(target: Target, deps: ScanDeps): Promise<Report> {
  const started = Date.now();
  const notes: string[] = [];
  const origin = `https://${target.host}${target.port ? `:${target.port}` : ""}`;

  const [robots, dnsInfo, cert, rdap] = await Promise.all([
    config.respectRobots ? checkRobots(target.host, target.port) : Promise.resolve({ found: false, allowed: true }),
    target.isIp ? Promise.resolve(null) : getDnsInfo(target.host, target.domain),
    getTlsInfo(target.host, target.port),
    target.isIp ? Promise.resolve(null) : getRdap(target.domain),
  ]);

  let res: FetchResult | null = null;
  let fetchError: string | null = null;
  if (robots.allowed) {
    try {
      res = await fetchHomepage(target.host, target.port);
    } catch (e) {
      fetchError = describeFetchError(e);
    }
  } else {
    notes.push("This site's robots.txt asks bots not to crawl it, so we did not fetch the homepage. Only DNS and SSL data were used.");
  }

  let browser: BrowserData | null = null;
  if (res && config.useBrowser && /html/i.test(res.headers["content-type"] ?? "")) {
    try {
      const { renderPage } = await import("./browser");
      browser = await renderPage(res.finalUrl, loadFingerprints().jsPaths);
    } catch (e) {
      notes.push(`Headless browser pass failed (${String((e as Error).message).split("\n")[0]}). Results are from raw HTML only.`);
    }
  }

  const page = extractPageData({
    url: res?.finalUrl ?? `${origin}/`,
    headers: res?.headers,
    cookies: res?.cookies,
    html: browser?.html ?? res?.body ?? "",
    dns: dnsInfo,
    cert,
    browser,
  });
  const technologies = detectTechnologies(page);
  const site = res ? extractSiteInfo(page, res.finalUrl) : null;

  const finalOrigin = res ? new URL(res.finalUrl).origin : origin;
  const ip = dnsInfo?.A[0] ?? null;
  const [traffic, asn] = await Promise.all([deps.getTraffic(target, finalOrigin), ip ? deps.lookupAsn(ip) : Promise.resolve(null)]);

  const h = res?.headers ?? {};
  return {
    version: 1,
    domain: target.key,
    registrableDomain: target.domain,
    scannedAt: new Date().toISOString(),
    scanMs: Date.now() - started,
    mode: browser ? "browser" : "http",
    fetch: res
      ? {
          ok: res.status < 400,
          status: res.status,
          finalUrl: res.finalUrl,
          redirects: res.hops.length - 1,
          hops: res.hops,
          responseMs: res.ms,
          bytes: res.bytes,
          truncated: res.truncated,
          contentType: h["content-type"] ?? null,
        }
      : { ok: false, error: fetchError ?? (robots.allowed ? "unknown" : "blocked-by-robots") },
    robots,
    technologies,
    site,
    hosting: {
      ip,
      ipv6: !!dnsInfo?.AAAA.length,
      asn,
      nameservers: dnsInfo?.NS ?? [],
      mx: dnsInfo?.MX ?? [],
      spf: dnsInfo?.TXT.find((t) => t.startsWith("v=spf1")) ?? null,
      dmarc: dnsInfo?.DMARC ?? null,
      verificationTxt: (dnsInfo?.TXT ?? [])
        .map((t) => t.split("=")[0])
        .filter((k) => /verification|verify|site-verification|domain-verification/i.test(k))
        .slice(0, 12),
    },
    security: res
      ? {
          https: res.finalUrl.startsWith("https:"),
          hsts: !!h["strict-transport-security"],
          csp: !!h["content-security-policy"],
          xFrameOptions: !!h["x-frame-options"],
          referrerPolicy: !!h["referrer-policy"],
          compression: h["content-encoding"] ?? null,
        }
      : null,
    cert,
    registration: rdap,
    traffic,
    notes,
  };
}
