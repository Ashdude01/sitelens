// The single entry point for getting a report. Routes, server actions, the API and CLI all go through here,
// so moving scans to a background queue later only changes this file.
import type { CachedReport, Report } from "@/lib/types";
import { config } from "../config";
import { InputError, normalizeTarget, type Target } from "../scanner/net";
import { runScan } from "../scanner/scan";
import { revalidateReport } from "../cache/isr";
import { findReport, getTechHistory, saveReport } from "../repositories/reports";
import { estimateFromSignals, loadCalibration } from "../traffic/estimator";
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

/**
 * Rank lists are stored on the report, but the visit numbers were computed with whatever calibration
 * existed at scan time. Recompute from the current fit so a calibration update shows up without a rescan.
 */
function withCurrentEstimate(report: CachedReport): CachedReport {
  const { traffic } = report;
  if (traffic.verified || !traffic.ranks.length) return report;
  const estimate = estimateFromSignals(traffic.ranks, loadCalibration(config.dataDir));
  if (!estimate) return report;
  return { ...report, traffic: { ...traffic, estimate, verdict: "estimated" } };
}

/** Cached report only (never scans). */
export async function getReport(key: string): Promise<CachedReport | null> {
  const report = await findReport(key);
  return report ? withCurrentEstimate(report) : null;
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
    revalidateReport(target.key);
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
  const fresh = cached ? withCurrentEstimate(cached) : null;
  if (!force && isFresh(fresh)) return { report: fresh, fromCache: true };
  if (clientKey && !limiter.take(clientKey)) {
    if (fresh) return { report: fresh, fromCache: true, stale: true };
    throw new RateLimitError(`Rate limit reached: ${config.freshScansPerHour} new scans per hour. Please try again later.`);
  }
  return { report: await scanAndSave(target), fromCache: false };
}

export { getTechHistory };
