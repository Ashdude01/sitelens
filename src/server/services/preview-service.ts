import { fetch as ufetch } from "undici";
import { config } from "../config";
import { normalizeTarget } from "../scanner/net";
import { findPreview, savePreview } from "../repositories/latency";
import { createMemoryLimiter } from "./rate-limit";
import { RateLimitError } from "./report-service";

const g = globalThis as unknown as { __previewLimiter?: ReturnType<typeof createMemoryLimiter> };
const limiter = (g.__previewLimiter ??= createMemoryLimiter(30, 3_600_000));

async function capture(host: string): Promise<{ image: Buffer; contentType: string } | null> {
  const url = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(`https://${host}/`)}?w=720`;
  let last: { image: Buffer; contentType: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1200));
    const res = await ufetch(url, {
      redirect: "follow",
      headers: { "user-agent": config.userAgent, accept: "image/jpeg,image/png,image/*" },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() || "image/jpeg";
    if (!contentType.startsWith("image/")) continue;
    const image = Buffer.from(await res.arrayBuffer());
    if (image.length > 512 * 1024 || image.length < 400) continue;
    last = { image, contentType };
    if (image.length >= 8_000) return last;
  }
  return last;
}

/** Homepage screenshot, cached for a week. Uncached captures are rate limited per visitor. */
export async function getPreview(input: string, clientKey?: string): Promise<{ image: Buffer; contentType: string; cached: boolean }> {
  const target = normalizeTarget(input);
  const ttl = config.previewTtlHours * 3_600_000;
  const cached = await findPreview(target.key);
  if (cached && Date.now() - cached.fetchedAt < ttl && cached.image.length >= 8_000) {
    return { image: cached.image, contentType: cached.contentType, cached: true };
  }
  if (clientKey && !limiter.take(clientKey)) {
    if (cached) return { image: cached.image, contentType: cached.contentType, cached: true };
    throw new RateLimitError("Preview limit reached for now.");
  }
  const shot = await capture(target.host);
  if (!shot) {
    if (cached) return { image: cached.image, contentType: cached.contentType, cached: true };
    throw new Error("screenshot unavailable");
  }
  if (shot.image.length >= 8_000) await savePreview(target.key, shot.image, shot.contentType);
  return { ...shot, cached: false };
}
