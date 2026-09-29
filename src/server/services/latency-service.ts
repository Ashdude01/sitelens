import type { LatencyReport } from "@/lib/latency-types";
import { config } from "../config";
import { measureRegions } from "../latency/globalping";
import { normalizeTarget } from "../scanner/net";
import { findLatency, saveLatency } from "../repositories/latency";
import { createMemoryLimiter } from "./rate-limit";
import { RateLimitError } from "./report-service";

const g = globalThis as unknown as {
  __latencyInflight?: Map<string, Promise<LatencyReport>>;
  __latencyLimiter?: ReturnType<typeof createMemoryLimiter>;
  __latencyLimiterCap?: number;
};
const inflight = (g.__latencyInflight ??= new Map());

function limits() {
  const ttl = Number(process.env.GLOBALPING_TTL_HOURS);
  const runs = Number(process.env.GLOBALPING_RUNS_PER_HOUR);
  return {
    ttlHours: Number.isFinite(ttl) && ttl > 0 ? ttl : config.globalpingTtlHours,
    runsPerHour: Number.isFinite(runs) && runs > 0 ? runs : config.globalpingRunsPerHour,
  };
}

function limiter() {
  const { runsPerHour } = limits();
  if (!g.__latencyLimiter || g.__latencyLimiterCap !== runsPerHour) {
    g.__latencyLimiterCap = runsPerHour;
    g.__latencyLimiter = createMemoryLimiter(runsPerHour, 3_600_000);
  }
  return g.__latencyLimiter;
}

/** Cached worldwide timings. A fresh Globalping measurement runs only when missing, stale, or forced. */
export async function getLatency(input: string, { clientKey, force = false }: { clientKey?: string; force?: boolean } = {}): Promise<{ result: LatencyReport; cached: boolean }> {
  const target = normalizeTarget(input);
  const cached = await findLatency(target.key);
  const fresh = cached && Date.now() - cached.fetchedAt < limits().ttlHours * 3_600_000;
  if (cached && fresh && !force) return { result: cached.data, cached: true };

  const running = inflight.get(target.key);
  if (running) return { result: await running, cached: false };
  if (clientKey && !limiter().take(clientKey)) {
    if (cached) return { result: cached.data, cached: true };
    throw new RateLimitError("Worldwide check limit reached for now. Please try again later.");
  }

  const p = measureRegions(target.host)
    .then(async (report) => {
      const saved = { ...report, domain: target.key };
      await saveLatency(target.key, saved);
      return saved;
    })
    .finally(() => inflight.delete(target.key));
  inflight.set(target.key, p);
  return { result: await p, cached: false };
}
