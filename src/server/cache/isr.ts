import { revalidateTag, unstable_cache } from "next/cache";
import { after } from "next/server";

/** Data-cache windows. Page ISR windows are inlined on each route; Next.js does not follow imports. */
const DATA_REPORT_SECONDS = 3600;
const DATA_CATALOG_SECONDS = 3600;

/**
 * Tags for on-demand revalidation.
 * A report page is tagged with its domain only. Directory and technology counts
 * refresh on the page timer, so one rescan does not rebuild every cached page.
 */
export function reportTag(domain: string) {
  const tag = `report:${domain}`;
  return tag.length <= 256 ? tag : `report:${domain.slice(0, 248)}`;
}

export const catalogTags = {
  directory: "directory",
  techUsage: "tech-usage",
  sitemap: "sitemap",
} as const;

type CacheOptions = { revalidate: number; tags: string[] };

/**
 * Cache a database read across requests. Outside a Next.js render (tests, scripts)
 * there is no incremental cache, so the query runs directly.
 */
export async function readCached<T>(keyParts: string[], options: CacheOptions, query: () => Promise<T>): Promise<T> {
  try {
    return await unstable_cache(query, keyParts, options)();
  } catch (err) {
    if (err instanceof Error && err.message.includes("incrementalCache missing")) return query();
    throw err;
  }
}

export function cacheReport<T>(domain: string, key: string, query: () => Promise<T>): Promise<T> {
  return readCached([key, domain], { revalidate: DATA_REPORT_SECONDS, tags: [reportTag(domain)] }, query);
}

export function cacheCatalog<T>(keyParts: string[], tag: string, query: () => Promise<T>): Promise<T> {
  return readCached(keyParts, { revalidate: DATA_CATALOG_SECONDS, tags: [tag] }, query);
}

/** Drop the cached report. Safe to call from a scan that is not inside a render. */
export function revalidateReport(domain: string) {
  const run = () => {
    try {
      revalidateTag(reportTag(domain), "max");
    } catch (err) {
      if (err instanceof Error && err.message.includes("static generation store missing")) return;
      console.error("revalidate report tag failed", domain, err);
    }
  };
  try {
    // During a page render, Next.js rejects revalidateTag. Run it after the response.
    after(run);
  } catch {
    run();
  }
}
