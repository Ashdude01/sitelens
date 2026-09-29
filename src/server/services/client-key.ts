import { config } from "../config";

/** Identify the caller for rate limiting. Only trusts proxy headers when TRUST_PROXY=1 (behind Cloudflare/nginx). */
export function clientKeyFromHeaders(h: Headers): string {
  if (config.trustProxy) {
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    if (ip) return ip;
  }
  // Without a trusted proxy, Server Components can't see the socket IP, so everyone shares one bucket.
  // In production run behind Cloudflare/nginx with TRUST_PROXY=1.
  return "anonymous";
}
