// The single entry point for getting a report. Routes, server actions, the API and CLI all go through here,
// so moving scans to a background queue later only changes this file.
import type { CachedReport, Report } from "@/lib/types";
import { config } from "../config";
import { InputError, normalizeTarget, type Target } from "../scanner/net";
import { runScan } from "../scanner/scan";
import { findReport, getTechHistory, saveReport } from "../repositories/reports";
import { lookupAsn } from "../repositories/ip2asn";
import { getTraffic } from "./traffic-service";
import { createMemoryLimiter } from "./rate-limit";

export { InputError, normalizeTarget };
export type { Target };

export class RateLimitError extends Error {}

const g = globalThis as unknown as {
  __sitelensInflight?: Map<string, Promise<CachedReport>>;
  __sitelensLimiter?: ReturnType<typeof createMemoryLimiter>;
};
const inflight = (g.__sitelensInflight ??= new Map());
const limiter = (g.__sitelensLimiter ??= createMemoryLimiter(config.freshScansPerHour, 3_600_000));

export function isFresh(r: CachedReport | null): r is CachedReport {
  return !!r && r.cache.ageHours < config.reportTtlHours;
}

/** Cached report only (never scans). */
export async function getReport(key: string): Promise<CachedReport | null> {
  return findReport(key);
}

function toCached(report: Report): CachedReport {
  return { ...report, cache: { scannedAt: report.scannedAt, ageHours: 0 } };
}

/** Scan now (deduplicated per domain) and persist. */
export async function scanAndSave(target: Target): Promise<CachedReport> {
  const running = inflight.get(target.key);
  if (running) return running;
  const p = (async () => {
    const report = await runScan(target, { getTraffic, lookupAsn });
    await saveReport(report);
    return toCached(report);
  })().finally(() => inflight.delete(target.key));
  inflight.set(target.key, p);
  return p;
}

/**
 * Get a fresh report, scanning if needed.
 * `clientKey` (usually the IP) is rate-limited for *new* scans only; cached reads are free.
 */
export async function getOrScanReport(
  input: string,
  { force = false, clientKey }: { force?: boolean; clientKey?: string } = {},
): Promise<{ report: CachedReport; fromCache: boolean; stale?: boolean }> {
  const target = normalizeTarget(input);
  const cached = await findReport(target.key);
  if (!force && isFresh(cached)) return { report: cached, fromCache: true };
  if (clientKey && !limiter.take(clientKey)) {
    if (cached) return { report: cached, fromCache: true, stale: true };
    throw new RateLimitError(`Rate limit reached: ${config.freshScansPerHour} new scans per hour. Please try again later.`);
  }
  return { report: await scanAndSave(target), fromCache: false };
}

export { getTechHistory };
