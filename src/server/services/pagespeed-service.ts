import type { PsiResult, PsiStrategy } from "@/lib/pagespeed-types";
import { config } from "../config";
import { normalizeTarget } from "../scanner/net";
import { runPagespeed } from "../pagespeed/psi";
import { findPagespeed, savePagespeed } from "../repositories/pagespeed";
import { findReport } from "../repositories/reports";
import { createMemoryLimiter } from "./rate-limit";
import { RateLimitError } from "./report-service";

const g = globalThis as unknown as {
  __psiInflight?: Map<string, Promise<PsiResult>>;
  __psiLimiter?: ReturnType<typeof createMemoryLimiter>;
  __psiLimiterCap?: number;
};
const inflight = (g.__psiInflight ??= new Map());

function pagespeedLimits() {
  const ttl = Number(process.env.PAGESPEED_TTL_HOURS);
  const runs = Number(process.env.PAGESPEED_RUNS_PER_HOUR);
  return {
    ttlHours: Number.isFinite(ttl) && ttl > 0 ? ttl : config.pagespeedTtlHours,
    runsPerHour: Number.isFinite(runs) && runs > 0 ? runs : config.pagespeedRunsPerHour,
  };
}

function limiter() {
  const { runsPerHour } = pagespeedLimits();
  if (!g.__psiLimiter || g.__psiLimiterCap !== runsPerHour) {
    g.__psiLimiterCap = runsPerHour;
    g.__psiLimiter = createMemoryLimiter(runsPerHour, 3_600_000);
  }
  return g.__psiLimiter;
}

/** Cached PageSpeed result, running Lighthouse via Google only when missing or stale. */
export async function getPagespeed(
  input: string,
  strategy: PsiStrategy,
  { clientKey, force = false }: { clientKey?: string; force?: boolean } = {},
): Promise<{ result: PsiResult; cached: boolean }> {
  const target = normalizeTarget(input);
  const cached = await findPagespeed(target.key, strategy);
  const fresh = cached && Date.now() - cached.fetchedAt < pagespeedLimits().ttlHours * 3_600_000;
  if (cached && fresh && !force) return { result: cached.data as PsiResult, cached: true };

  const key = `${target.key}|${strategy}`;
  const running = inflight.get(key);
  if (running) return { result: await running, cached: false };
  if (clientKey && !limiter().take(clientKey)) {
    if (cached) return { result: cached.data as PsiResult, cached: true };
    throw new RateLimitError("PageSpeed limit reached for now. Please try again later.");
  }
  // Test the page we actually landed on during the scan (after redirects), else the https homepage.
  const report = await findReport(target.key);
  const url = report?.fetch.ok && report.fetch.finalUrl ? report.fetch.finalUrl : `https://${target.host}/`;
  const p = runPagespeed(url, strategy)
    .then(async (r) => {
      await savePagespeed(target.key, strategy, r);
      return r;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return { result: await p, cached: false };
}
