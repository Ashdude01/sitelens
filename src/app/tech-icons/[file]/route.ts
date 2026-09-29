// Official technology logos. SVGs are rasterized to PNG because Chrome will not
// paint an SVG in an <img> when the response carries a Content-Security-Policy sandbox.
import fs from "node:fs/promises";
import path from "node:path";
import { fetch as ufetch } from "undici";
import { config } from "@/server/config";
import { loadFingerprints } from "@/server/scanner/fingerprints";

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const cacheDir = () => path.join(config.dataDir, "icon-cache");

function imageResponse(body: Buffer, type: string, cache = "public, max-age=2592000, immutable") {
  return new Response(new Uint8Array(body), {
    headers: { "content-type": type, "cache-control": cache, "x-content-type-options": "nosniff" },
  });
}

async function readCached(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(cacheDir(), file));
  } catch {
    return null;
  }
}

async function loadSource(file: string): Promise<Buffer | null> {
  const cached = await readCached(file);
  if (cached) return cached;
  const res = await ufetch(config.techIconUpstream + encodeURIComponent(file), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 512 * 1024) return null;
  await fs.mkdir(cacheDir(), { recursive: true });
  await fs.writeFile(path.join(cacheDir(), file), buf);
  return buf;
}

async function svgToPng(svg: Buffer): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: 64 } }).render().asPng());
}

export async function GET(_req: Request, ctx: RouteContext<"/tech-icons/[file]">) {
  const file = decodeURIComponent((await ctx.params).file);
  if (!loadFingerprints().icons.has(file) || file.includes("/") || file.includes("\\") || file.startsWith(".")) {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext];
  if (!type) return new Response("Not found", { status: 404 });

  let source: Buffer | null;
  try {
    source = await loadSource(file);
  } catch {
    return new Response("Unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  }
  if (!source) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=3600" } });

  if (ext !== ".svg") return imageResponse(source, type);

  const pngName = `${file}.png`;
  const cachedPng = await readCached(pngName);
  if (cachedPng) return imageResponse(cachedPng, "image/png");
  try {
    const png = await svgToPng(source);
    await fs.writeFile(path.join(cacheDir(), pngName), png);
    return imageResponse(png, "image/png");
  } catch (e) {
    console.error("tech icon png failed", file, e);
    return imageResponse(source, "image/svg+xml", "public, max-age=3600");
  }
}
