// Official technology logos, served from our own domain.
// Fetched once from the open fingerprint repo, cached on disk, then served with long cache headers.
import fs from "node:fs/promises";
import path from "node:path";
import { fetch as ufetch } from "undici";
import { config } from "@/server/config";
import { loadFingerprints } from "@/server/scanner/fingerprints";

const TYPES: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon" };

// Third-party SVGs can contain scripts; this CSP makes them inert even if opened directly.
const SAFE_HEADERS = {
  "cache-control": "public, max-age=2592000, immutable",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
  "x-content-type-options": "nosniff",
};

const cacheDir = () => path.join(config.dataDir, "icon-cache");

export async function GET(_req: Request, ctx: RouteContext<"/tech-icons/[file]">) {
  const file = decodeURIComponent((await ctx.params).file);
  // Whitelist: only icon names that exist in the fingerprint database (blocks path tricks and arbitrary fetches).
  if (!loadFingerprints().icons.has(file) || file.includes("/") || file.includes("\\") || file.startsWith(".")) {
    return new Response("Not found", { status: 404 });
  }
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  const cached = path.join(cacheDir(), file);
  try {
    const buf = await fs.readFile(cached);
    return new Response(new Uint8Array(buf), { headers: { "content-type": type, ...SAFE_HEADERS } });
  } catch {
    /* not cached yet */
  }
  try {
    const res = await ufetch(config.techIconUpstream + encodeURIComponent(file), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=3600" } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 512 * 1024) return new Response("Too large", { status: 404 });
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(cached, buf);
    return new Response(new Uint8Array(buf), { headers: { "content-type": type, ...SAFE_HEADERS } });
  } catch {
    return new Response("Unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  }
}
