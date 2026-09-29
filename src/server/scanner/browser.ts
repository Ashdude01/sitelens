// Optional headless-browser pass (USE_BROWSER=1): finds JS globals and scripts injected at runtime.
// Costs ~1-3 s CPU per site, so use it for important sites only.
import dns from "node:dns/promises";
import fs from "node:fs";
import type { Browser } from "playwright-core";
import { config } from "../config";
import { isPrivateIp } from "./net";
import type { BrowserData } from "./fingerprints";

let browserPromise: Promise<Browser> | null = null;

function findChromium(): string | undefined {
  if (config.chromiumPath) return config.chromiumPath;
  const candidates = [
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((c) => fs.existsSync(c));
}

async function getBrowser(): Promise<Browser> {
  browserPromise ??= (async () => {
    const { chromium } = await import("playwright-core");
    return chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  })().catch((e) => {
    browserPromise = null;
    throw e;
  });
  return browserPromise;
}

const hostCache = new Map<string, boolean>();
async function hostIsPublic(host: string): Promise<boolean> {
  if (config.allowPrivateNetwork) return true;
  const cached = hostCache.get(host);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    const addrs = await dns.lookup(host, { all: true });
    ok = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    ok = false;
  }
  hostCache.set(host, ok);
  return ok;
}

export async function renderPage(url: string, jsPaths: string[]): Promise<BrowserData> {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: config.userAgent, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const scriptSrc = new Set<string>();
  try {
    await page.route("**/*", async (route) => {
      const req = route.request();
      let u: URL;
      try {
        u = new URL(req.url());
      } catch {
        return route.abort();
      }
      if (!["http:", "https:", "data:", "blob:"].includes(u.protocol)) return route.abort();
      const type = req.resourceType();
      if (type === "script") scriptSrc.add(req.url()); // record even if blocked below
      if (u.protocol.startsWith("http") && !(await hostIsPublic(u.hostname))) return route.abort();
      if (["image", "media", "font"].includes(type)) return route.abort();
      return route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    const js = await page.evaluate((paths: string[]) => {
      const out: Record<string, string> = {};
      for (const p of paths) {
        try {
          let v: unknown = window;
          for (const part of p.split(".")) {
            if (v === undefined || v === null) break;
            v = (v as Record<string, unknown>)[part];
          }
          if (v === undefined || v === null) continue;
          out[p] = ["string", "number", "boolean"].includes(typeof v) ? String(v).slice(0, 100) : "";
        } catch {
          /* getter threw */
        }
      }
      return out;
    }, jsPaths);
    const html = await page.content();
    const cookies: Record<string, string> = {};
    for (const c of await context.cookies()) cookies[c.name] = c.value;
    return { html, js, scriptSrc: [...scriptSrc], cookies };
  } finally {
    await context.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  await b?.close();
  browserPromise = null;
}
