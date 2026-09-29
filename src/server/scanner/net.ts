// Network layer: input normalisation, SSRF-safe fetching, robots.txt, DNS, TLS and RDAP.
import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";
import { Agent, fetch as ufetch } from "undici";
import { parse as parseDomain } from "tldts";
import { config } from "../config";
import type { CertInfo } from "@/lib/types";

// ---------- input normalisation ----------

export class InputError extends Error {}

export interface Target {
  /** Hostname as entered, e.g. www.example.com */
  host: string;
  /** Canonical cache key: host without leading "www." (+ port in dev). */
  key: string;
  /** Registrable domain, e.g. example.com */
  domain: string;
  port: number | null;
  isIp: boolean;
}

export function normalizeTarget(input: unknown): Target {
  let raw = String(input ?? "").trim();
  if (!raw) throw new InputError("Please enter a domain.");
  if (raw.length > 300) throw new InputError("That input is too long.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `http://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new InputError("That does not look like a valid domain.");
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new InputError("Only http(s) sites can be scanned.");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const port = u.port ? Number(u.port) : null;

  if (net.isIP(host.replace(/^\[|\]$/g, ""))) {
    if (!config.allowPrivateNetwork) throw new InputError("Please enter a domain name, not an IP address.");
    return { host, key: port ? `${host}:${port}` : host, domain: host, port, isIp: true };
  }
  if (port && !config.allowPrivateNetwork) throw new InputError("Custom ports are not supported.");

  const p = parseDomain(host, { allowPrivateDomains: false });
  if (!config.allowPrivateNetwork && (!p.domain || !p.publicSuffix || !p.isIcann)) {
    throw new InputError("That does not look like a public domain name.");
  }
  const bare = host.replace(/^www\./, "");
  return { host, key: port ? `${bare}:${port}` : bare, domain: p.domain ?? host, port, isIp: false };
}

// ---------- SSRF protection ----------

const blockList = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockList.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2001:db8::", 32],
] as const) blockList.addSubnet(addr, prefix, "ipv6");

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return blockList.check(ip, "ipv4");
  if (net.isIPv6(ip)) {
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return blockList.check(mapped[1], "ipv4");
    return blockList.check(ip, "ipv6");
  }
  return true;
}

class PrivateAddressError extends Error {
  code = "EPRIVATE";
}

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;

/** dns.lookup replacement that refuses to resolve to private / internal addresses. */
function guardedLookup(hostname: string, options: dns.LookupOptions | LookupCb, callback?: LookupCb) {
  const opts: dns.LookupOptions = typeof options === "function" ? {} : options;
  const cb = (typeof options === "function" ? options : callback) as LookupCb;
  dns.lookup(hostname, { all: true, family: opts.family ?? 0 }, (err, addrs) => {
    if (err) return cb(err);
    const allowed = config.allowPrivateNetwork ? addrs : addrs.filter((a) => !isPrivateIp(a.address));
    if (!allowed.length) return cb(new PrivateAddressError(`Refusing to connect to private address for ${hostname}`));
    if (opts.all) return cb(null, allowed);
    cb(null, allowed[0].address, allowed[0].family);
  });
}

export function resolvePublicIps(hostname: string): Promise<dns.LookupAddress[]> {
  return new Promise((resolve, reject) => {
    guardedLookup(hostname, { all: true }, (err, addrs) => (err ? reject(err) : resolve(addrs as dns.LookupAddress[])));
  });
}

const agent = new Agent({
  connect: { lookup: guardedLookup as unknown as typeof dns.lookup, timeout: 8000, rejectUnauthorized: false },
  headersTimeout: 10_000,
  bodyTimeout: 10_000,
});

// ---------- fetching ----------

export interface FetchResult {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  body: string;
  bytes: number;
  truncated: boolean;
  hops: { url: string; status: number }[];
  ms: number;
}

async function readCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!body) return { buf: Buffer.alloc(0), truncated: false };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      chunks.push(value.subarray(0, value.length - (size - maxBytes)));
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  return { buf: Buffer.concat(chunks), truncated };
}

function decode(buf: Buffer, contentType?: string): string {
  let charset = /charset=([^;]+)/i.exec(contentType ?? "")?.[1]?.trim().toLowerCase();
  if (!charset) charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 2048).toString("latin1"))?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

function checkUrlAllowed(u: URL) {
  if (!["http:", "https:"].includes(u.protocol)) throw new Error(`Blocked protocol ${u.protocol}`);
  if (!config.allowPrivateNetwork && u.port && !["80", "443"].includes(u.port)) throw new Error(`Blocked port ${u.port}`);
  // IP-literal URLs skip DNS lookup, so check them here (e.g. a redirect to 169.254.169.254).
  const h = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(h) && !config.allowPrivateNetwork && isPrivateIp(h)) {
    throw new PrivateAddressError(`Refusing to connect to private address ${h}`);
  }
}

/** Fetch following redirects manually so every hop is re-validated and cookies from every hop are kept. */
export async function safeFetch(
  url: string,
  { maxBytes = config.maxBodyBytes, accept = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" } = {},
): Promise<FetchResult> {
  const started = Date.now();
  const hops: FetchResult["hops"] = [];
  const cookies: Record<string, string> = {};
  let current = new URL(url);
  for (let i = 0; i <= config.maxRedirects; i++) {
    checkUrlAllowed(current);
    const res = await ufetch(current, {
      dispatcher: agent,
      redirect: "manual",
      headers: { "user-agent": config.userAgent, accept, "accept-language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
    hops.push({ url: current.href, status: res.status });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel().catch(() => {});
      current = new URL(loc, current);
      continue;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    const { buf, truncated } = await readCapped(res.body as ReadableStream<Uint8Array> | null, maxBytes);
    return {
      finalUrl: current.href,
      status: res.status,
      headers,
      cookies,
      body: decode(buf, headers["content-type"]),
      bytes: buf.length,
      truncated,
      hops,
      ms: Date.now() - started,
    };
  }
  throw new Error("Too many redirects");
}

function errCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.cause?.code ?? err?.code;
}

/** Try https:// first, then http:// */
export async function fetchHomepage(host: string, port: number | null): Promise<FetchResult> {
  const suffix = port ? `:${port}` : "";
  let firstErr: unknown;
  for (const scheme of ["https", "http"]) {
    try {
      return await safeFetch(`${scheme}://${host}${suffix}/`);
    } catch (e) {
      firstErr ??= e;
      if (errCode(e) === "EPRIVATE") throw e;
    }
  }
  throw firstErr;
}

export function describeFetchError(e: unknown): string {
  return errCode(e) ?? (e instanceof Error ? e.message : "unknown");
}

// ---------- robots.txt ----------

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const m = rawLine.replace(/#.*$/, "").trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (field === "allow" || field === "disallow")) cur.rules.push({ allow: field === "allow", path: value });
    }
  }
  return groups;
}

function ruleMatches(rulePath: string, path: string) {
  if (rulePath === "") return false;
  const re = new RegExp(
    "^" + rulePath.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
  );
  return re.test(path);
}

export function robotsAllows(text: string, botToken: string, path = "/"): boolean {
  const groups = parseRobots(text);
  const token = botToken.toLowerCase();
  const group =
    groups.find((g) => g.agents.some((a) => a !== "*" && token.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: RobotsGroup["rules"][number] | null = null;
  for (const r of group.rules) {
    if (ruleMatches(r.path, path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return best ? best.allow : true;
}

export async function checkRobots(host: string, port: number | null) {
  const suffix = port ? `:${port}` : "";
  for (const scheme of ["https", "http"]) {
    let res: FetchResult;
    try {
      res = await safeFetch(`${scheme}://${host}${suffix}/robots.txt`, { maxBytes: 512 * 1024, accept: "text/plain,*/*" });
    } catch {
      continue;
    }
    if (res.status >= 400) return { found: false, allowed: true };
    const text = res.body || "";
    const sitemaps = [...text.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 10);
    return { found: true, allowed: robotsAllows(text, config.botToken, "/"), sitemaps };
  }
  return { found: false, allowed: true };
}

// ---------- DNS ----------

export interface DnsInfo {
  MX: string[];
  NS: string[];
  TXT: string[];
  SOA: string[];
  CNAME: string[];
  A: string[];
  AAAA: string[];
  DMARC: string | null;
}

const resolver = new dns.promises.Resolver({ timeout: 3000, tries: 2 });
const soft = <T>(p: Promise<T>) => p.catch(() => null);

export async function getDnsInfo(host: string, domain: string): Promise<DnsInfo> {
  const [mx, ns, txt, soa, cname, a, aaaa, dmarc] = await Promise.all([
    soft(resolver.resolveMx(domain)),
    soft(resolver.resolveNs(domain)),
    soft(resolver.resolveTxt(domain)),
    soft(resolver.resolveSoa(domain)),
    soft(resolver.resolveCname(host)),
    soft(resolver.resolve4(host)),
    soft(resolver.resolve6(host)),
    soft(resolver.resolveTxt(`_dmarc.${domain}`)),
  ]);
  return {
    MX: (mx ?? []).sort((x, y) => x.priority - y.priority).map((r) => r.exchange.toLowerCase()),
    NS: (ns ?? []).map((s) => s.toLowerCase()),
    TXT: (txt ?? []).map((parts) => parts.join("")),
    SOA: soa ? [soa.nsname.toLowerCase(), soa.hostmaster.toLowerCase()] : [],
    CNAME: (cname ?? []).map((s) => s.toLowerCase()),
    A: a ?? [],
    AAAA: aaaa ?? [],
    DMARC: (dmarc ?? []).map((p) => p.join("")).find((t) => t.startsWith("v=DMARC1")) ?? null,
  };
}

// ---------- TLS ----------

export async function getTlsInfo(host: string, port: number | null): Promise<CertInfo | null> {
  let ip: string;
  try {
    ip = (await resolvePublicIps(host))[0].address;
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: ip,
      port: port ?? 443,
      servername: net.isIP(host) ? undefined : host,
      rejectUnauthorized: false,
      timeout: 6000,
    });
    const done = (v: CertInfo | null) => {
      socket.destroy();
      resolve(v);
    };
    socket.once("secureConnect", () => {
      const c = socket.getPeerCertificate();
      if (!c || !Object.keys(c).length) return done(null);
      const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
      done({
        issuerOrg: first(c.issuer?.O),
        issuerCN: first(c.issuer?.CN),
        subjectCN: first(c.subject?.CN),
        validFrom: c.valid_from ? new Date(c.valid_from).toISOString() : null,
        validTo: c.valid_to ? new Date(c.valid_to).toISOString() : null,
        sanCount: c.subjectaltname ? c.subjectaltname.split(",").length : 0,
        protocol: socket.getProtocol(),
        trusted: socket.authorized,
        error: socket.authorizationError ? String(socket.authorizationError) : null,
      });
    });
    socket.once("error", () => done(null));
    socket.once("timeout", () => done(null));
  });
}

// ---------- RDAP ----------

export async function getRdap(domain: string) {
  if (!config.rdapEnabled) return null;
  try {
    const res = await ufetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json", "user-agent": config.userAgent },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      events?: { eventAction: string; eventDate: string }[];
      entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] }[];
    };
    const ev = (name: string) => j.events?.find((e) => e.eventAction === name)?.eventDate ?? null;
    const registrar = j.entities?.find((e) => e.roles?.includes("registrar"));
    const registrarName = registrar?.vcardArray?.[1]?.find((f) => f[0] === "fn")?.[3] ?? null;
    return { registered: ev("registration"), expires: ev("expiration"), updated: ev("last changed"), registrar: registrarName };
  } catch {
    return null;
  }
}
