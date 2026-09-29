// Technology detection with the open Wappalyzer-format fingerprint database
// (https://github.com/enthec/webappanalyzer, GPL-3.0). Every detection keeps its evidence.
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { config } from "../config";
import type { CertInfo, Technology } from "@/lib/types";
import type { DnsInfo } from "./net";

const MAX_HTML = 600_000;

interface Pattern {
  raw: string;
  re: RegExp | null;
  version: string | null;
  confidence: number;
}

interface RawTech {
  cats?: number[];
  website?: string;
  description?: string;
  icon?: string;
  saas?: boolean;
  oss?: boolean;
  pricing?: string[];
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  meta?: Record<string, string | string[]>;
  js?: Record<string, string>;
  dns?: Record<string, string | string[]>;
  html?: string | string[];
  text?: string | string[];
  scriptSrc?: string | string[];
  scripts?: string | string[];
  url?: string | string[];
  certIssuer?: string | string[];
  dom?: string | string[] | Record<string, DomRule>;
  implies?: string | string[];
  excludes?: string | string[];
  requires?: string | string[];
  requiresCategory?: number | number[];
}

interface DomRule {
  exists?: string;
  attributes?: Record<string, string>;
  properties?: Record<string, string>;
  text?: string;
}

export interface CompiledTech {
  name: string;
  slug: string;
  cats: number[];
  website?: string;
  description?: string;
  icon?: string;
  saas: boolean;
  oss: boolean;
  pricing: string[];
  headers: Record<string, Pattern[]>;
  cookies: { name: string; re: RegExp | null; p: Pattern }[];
  meta: Record<string, Pattern[]>;
  js: Record<string, Pattern[]>;
  dns: Record<string, Pattern[]>;
  html: Pattern[];
  text: Pattern[];
  scriptSrc: Pattern[];
  scripts: Pattern[];
  url: Pattern[];
  certIssuer: Pattern[];
  dom: RawTech["dom"];
  implies: Pattern[];
  excludes: Pattern[];
  requires: Pattern[];
  requiresCategory: number[];
}

export interface FingerprintDb {
  categories: Record<string, { name: string; priority: number }>;
  techs: CompiledTech[];
  byName: Record<string, CompiledTech>;
  bySlug: Record<string, CompiledTech>;
  /** Icon file names that exist in the database (whitelist for the icon proxy). */
  icons: Set<string>;
  jsPaths: string[];
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\+/g, "-plus")
      .replace(/#/g, "-sharp")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tech"
  );
}

const arr = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function parsePattern(str: string): Pattern {
  const [regex, ...parts] = String(str).split("\\;");
  const p: Pattern = { raw: regex, re: null, version: null, confidence: 100 };
  for (const part of parts) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i);
    const v = part.slice(i + 1);
    if (k === "version") p.version = v;
    if (k === "confidence") p.confidence = Number.parseInt(v, 10) || 0;
  }
  if (regex !== "") {
    try {
      p.re = new RegExp(regex, "i");
    } catch {
      p.re = /(?!)/;
    }
  }
  return p;
}

function resolveVersion(tpl: string | null, match: RegExpExecArray | string[] | null): string | null {
  if (!tpl || !match) return null;
  let v = tpl.replace(/\\(\d)/g, (_, n) => match[Number(n)] ?? "");
  const t = v.match(/^(.*?)\?(.*?):(.*)$/);
  if (t) v = t[1] ? t[2] : t[3];
  v = v.trim();
  return v && v.length < 40 ? v : null;
}

interface Hit {
  match: RegExpExecArray | string[];
  p: Pattern;
}

function test(p: Pattern, value: unknown): Hit | null {
  if (value === undefined || value === null) return null;
  if (!p.re) return { match: [], p };
  const m = p.re.exec(String(value));
  return m ? { match: m, p } : null;
}

const mapPatterns = (obj: Record<string, string | string[]> | undefined, lower = true) => {
  const out: Record<string, Pattern[]> = {};
  for (const [k, v] of Object.entries(obj ?? {})) out[lower ? k.toLowerCase() : k] = arr(v).map(parsePattern);
  return out;
};

const wildcardRe = (name: string) =>
  new RegExp("^" + name.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");

let DB: FingerprintDb | null = null;

export function loadFingerprints(dir = path.join(config.dataDir, "fingerprints")): FingerprintDb {
  if (DB) return DB;
  const categories = JSON.parse(fs.readFileSync(path.join(dir, "categories.json"), "utf8"));
  const raw: Record<string, RawTech> = {};
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith("technologies_") && f.endsWith(".json")) Object.assign(raw, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
  const techs: CompiledTech[] = [];
  const byName: Record<string, CompiledTech> = {};
  const jsPaths = new Set<string>();
  const bySlug: Record<string, CompiledTech> = {};
  const icons = new Set<string>();
  for (const [name, t] of Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))) {
    let slug = slugify(name);
    for (let i = 2; bySlug[slug]; i++) slug = `${slugify(name)}-${i}`;
    const c: CompiledTech = {
      name,
      slug,
      cats: t.cats ?? [],
      website: t.website,
      description: t.description,
      icon: t.icon,
      saas: !!t.saas,
      oss: !!t.oss,
      pricing: t.pricing ?? [],
      headers: mapPatterns(t.headers),
      cookies: Object.entries(t.cookies ?? {}).map(([k, v]) => ({ name: k, re: k.includes("*") ? wildcardRe(k) : null, p: parsePattern(v) })),
      meta: mapPatterns(t.meta),
      js: mapPatterns(t.js, false),
      dns: mapPatterns(t.dns, false),
      html: arr(t.html).map(parsePattern),
      text: arr(t.text).map(parsePattern),
      scriptSrc: arr(t.scriptSrc).map(parsePattern),
      scripts: arr(t.scripts).map(parsePattern),
      url: arr(t.url).map(parsePattern),
      certIssuer: arr(t.certIssuer).map(parsePattern),
      dom: t.dom,
      implies: arr(t.implies).map(parsePattern),
      excludes: arr(t.excludes).map(parsePattern),
      requires: arr(t.requires).map(parsePattern),
      requiresCategory: arr(t.requiresCategory),
    };
    for (const k of Object.keys(c.js)) jsPaths.add(k);
    techs.push(c);
    byName[name] = c;
    bySlug[slug] = c;
    if (t.icon) icons.add(t.icon);
  }
  DB = { categories, techs, byName, bySlug, icons, jsPaths: [...jsPaths] };
  return DB;
}

export interface BrowserData {
  html: string;
  js: Record<string, string>;
  scriptSrc: string[];
  cookies: Record<string, string>;
}

export interface PageData {
  url: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  html: string;
  text: string;
  scriptSrc: string[];
  scripts: string;
  meta: Record<string, string[]>;
  dns: DnsInfo | null;
  cert: CertInfo | null;
  js: Record<string, string>;
  $: CheerioAPI;
}

/** Collect everything observable about the page into one object. */
export function extractPageData(input: {
  url: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  html?: string;
  dns?: DnsInfo | null;
  cert?: CertInfo | null;
  browser?: BrowserData | null;
}): PageData {
  const html = input.html ?? "";
  const $ = cheerio.load(html.slice(0, 2_000_000));
  const scriptSrc = new Set<string>();
  $("script[src]").each((_, el) => {
    const s = $(el).attr("src");
    if (s) scriptSrc.add(s);
  });
  const inline: string[] = [];
  $("script:not([src])").each((_, el) => {
    const s = $(el).html();
    if (s) inline.push(s);
  });
  const meta: Record<string, string[]> = {};
  $("meta").each((_, el) => {
    const key = ($(el).attr("name") ?? $(el).attr("property") ?? $(el).attr("http-equiv") ?? "").toLowerCase();
    const content = $(el).attr("content");
    if (key && content !== undefined) (meta[key] ??= []).push(content);
  });
  for (const s of input.browser?.scriptSrc ?? []) scriptSrc.add(s);
  return {
    url: input.url,
    headers: input.headers ?? {},
    cookies: { ...(input.cookies ?? {}), ...(input.browser?.cookies ?? {}) },
    html: html.slice(0, MAX_HTML),
    text: $("body").text().replace(/\s+/g, " ").slice(0, 100_000),
    scriptSrc: [...scriptSrc],
    scripts: inline.join("\n").slice(0, MAX_HTML),
    meta,
    dns: input.dns ?? null,
    cert: input.cert ?? null,
    js: input.browser?.js ?? {},
    $,
  };
}

const short = (s: unknown, n = 90) => {
  const str = String(s);
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
};

interface Found {
  confidence: number;
  version: string | null;
  evidence: string[];
  implied?: boolean;
}

/** Run every fingerprint against the page data. */
export function detectTechnologies(page: PageData, db: FingerprintDb = loadFingerprints()): Technology[] {
  const found = new Map<string, Found>();

  const add = (tech: CompiledTech, hit: Hit, evidence: string) => {
    let r = found.get(tech.name);
    if (!r) {
      r = { confidence: 0, version: null, evidence: [] };
      found.set(tech.name, r);
    }
    r.confidence = Math.min(100, r.confidence + hit.p.confidence);
    const v = resolveVersion(hit.p.version, hit.match);
    if (v && (!r.version || v.length > r.version.length)) r.version = v;
    if (r.evidence.length < 4 && !r.evidence.includes(evidence)) r.evidence.push(evidence);
  };

  for (const t of db.techs) {
    for (const p of t.url) {
      const h = test(p, page.url);
      if (h) add(t, h, `URL matches ${short(p.raw, 40)}`);
    }
    for (const [name, pats] of Object.entries(t.headers)) {
      const v = page.headers[name];
      if (v === undefined) continue;
      for (const p of pats) {
        const h = test(p, v);
        if (h) {
          add(t, h, `Header ${name}: ${short(v, 60)}`);
          break;
        }
      }
    }
    for (const c of t.cookies) {
      const names = c.re ? Object.keys(page.cookies).filter((n) => c.re!.test(n)) : c.name in page.cookies ? [c.name] : [];
      for (const n of names) {
        const h = test(c.p, page.cookies[n]);
        if (h) {
          add(t, h, `Cookie ${n}`);
          break;
        }
      }
    }
    for (const [name, pats] of Object.entries(t.meta)) {
      for (const v of page.meta[name] ?? []) {
        for (const p of pats) {
          const h = test(p, v);
          if (h) {
            add(t, h, `<meta ${name}="${short(v, 50)}">`);
            break;
          }
        }
      }
    }
    if (t.scriptSrc.length) {
      outer: for (const src of page.scriptSrc) {
        for (const p of t.scriptSrc) {
          const h = test(p, src);
          if (h) {
            add(t, h, `Script ${short(src)}`);
            break outer;
          }
        }
      }
    }
    for (const p of t.scripts) {
      const h = test(p, page.scripts);
      if (h) {
        add(t, h, `Inline script matches /${short(p.raw, 40)}/`);
        break;
      }
    }
    for (const p of t.html) {
      const h = test(p, page.html);
      if (h) {
        add(t, h, `HTML contains ${short(h.match[0], 60)}`);
        break;
      }
    }
    for (const p of t.text) {
      const h = test(p, page.text);
      if (h) {
        add(t, h, `Page text matches /${short(p.raw, 40)}/`);
        break;
      }
    }
    if (page.dns) {
      for (const [type, pats] of Object.entries(t.dns)) {
        const records = (page.dns as unknown as Record<string, string[] | string | null>)[type];
        for (const rec of arr(records)) {
          for (const p of pats) {
            const h = test(p, rec);
            if (h) {
              add(t, h, `DNS ${type} ${short(rec, 60)}`);
              break;
            }
          }
        }
      }
    }
    if (page.cert) {
      const issuer = [page.cert.issuerOrg, page.cert.issuerCN].filter(Boolean).join(" ");
      for (const p of t.certIssuer) {
        const h = test(p, issuer);
        if (h) add(t, h, `SSL issued by ${short(issuer, 50)}`);
      }
    }
    for (const [jsPath, pats] of Object.entries(t.js)) {
      if (!(jsPath in page.js)) continue;
      for (const p of pats) {
        const h = test(p, page.js[jsPath]);
        if (h) {
          add(t, h, `JS global ${jsPath}`);
          break;
        }
      }
    }
    if (t.dom) detectDom(t, page.$, add);
  }

  // requires / requiresCategory
  const catOf = (name: string) => db.byName[name]?.cats ?? [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of [...found.keys()]) {
      const t = db.byName[name];
      const missingReq = t.requires.some((p) => !found.has(p.raw));
      const missingCat =
        t.requiresCategory.length > 0 &&
        ![...found.keys()].some((n) => n !== name && catOf(n).some((c) => t.requiresCategory.includes(c)));
      if (missingReq || missingCat) {
        found.delete(name);
        changed = true;
      }
    }
  }
  // excludes
  for (const name of [...found.keys()]) {
    for (const ex of db.byName[name]?.excludes ?? []) found.delete(ex.raw);
  }
  // implies
  const queue = [...found.keys()];
  while (queue.length) {
    const name = queue.shift()!;
    for (const imp of db.byName[name]?.implies ?? []) {
      if (!db.byName[imp.raw] || found.has(imp.raw)) continue;
      found.set(imp.raw, { confidence: imp.confidence, version: null, evidence: [`Implied by ${name}`], implied: true });
      queue.push(imp.raw);
    }
  }

  const results: Technology[] = [];
  for (const [name, r] of found) {
    const t = db.byName[name];
    const cats = t.cats.map((id) => ({ name: db.categories[id]?.name ?? "Other", priority: db.categories[id]?.priority ?? 9 }));
    results.push({
      name,
      slug: t.slug,
      version: r.version,
      confidence: r.confidence,
      implied: !!r.implied,
      categories: cats.map((c) => c.name),
      priority: Math.min(9, ...cats.map((c) => c.priority)),
      website: t.website,
      description: t.description,
      icon: t.icon,
      saas: t.saas,
      oss: t.oss,
      pricing: t.pricing,
      evidence: r.evidence,
    });
  }
  results.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence || a.name.localeCompare(b.name));
  return results;
}

function detectDom(t: CompiledTech, $: CheerioAPI, add: (t: CompiledTech, h: Hit, e: string) => void) {
  const select = (sel: string) => {
    try {
      return $(sel);
    } catch {
      return null;
    }
  };
  if (Array.isArray(t.dom) || typeof t.dom === "string") {
    for (const sel of arr(t.dom)) {
      const p = parsePattern(sel);
      const els = select(p.raw);
      if (els && els.length) {
        add(t, { match: [], p: { ...p, re: null, version: null } }, `DOM element ${short(p.raw, 60)}`);
        return;
      }
    }
    return;
  }
  for (const [sel, rules] of Object.entries(t.dom ?? {})) {
    const els = select(sel);
    if (!els || !els.length) continue;
    if (rules.exists !== undefined) {
      add(t, { match: [], p: parsePattern(rules.exists) }, `DOM element ${short(sel, 60)}`);
      return;
    }
    for (const [attr, pat] of Object.entries(rules.attributes ?? {})) {
      const p = parsePattern(pat);
      let hit: Hit | null = null;
      els.each((_, el) => {
        hit ??= test(p, $(el).attr(attr));
      });
      if (hit) {
        add(t, hit, `DOM ${short(sel, 40)} [${attr}]`);
        return;
      }
    }
    if (rules.text !== undefined) {
      const p = parsePattern(rules.text);
      let hit: Hit | null = null;
      els.each((_, el) => {
        hit ??= test(p, $(el).text());
      });
      if (hit) {
        add(t, hit, `DOM ${short(sel, 40)} text`);
        return;
      }
    }
  }
}
