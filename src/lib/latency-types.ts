/** Probe locations that together cover the major parts of the world. */
export const LATENCY_REGIONS = [
  { code: "US", name: "United States" },
  { code: "JP", name: "Japan" },
  { code: "RU", name: "Russia" },
  { code: "GB", name: "United Kingdom" },
  { code: "SG", name: "Singapore" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AU", name: "Australia" },
] as const;

export type RegionCode = (typeof LATENCY_REGIONS)[number]["code"];

/** ok = HTTP reply, blocked = the site refused the probe, down = no reply, unavailable = no probe online. */
export type RegionStatus = "ok" | "blocked" | "down" | "unavailable";

export interface RegionLatency {
  code: string;
  name: string;
  status: RegionStatus;
  httpStatus: number | null;
  /** Time to first byte, in milliseconds, when the probe got a response. */
  ttfbMs: number | null;
}

export interface LatencyReport {
  domain: string;
  fetchedAt: string;
  regions: RegionLatency[];
  /** Regions that answered with any HTTP status, including blocks. */
  reachable: number;
  /** Regions where a probe actually ran. */
  checked: number;
}

interface RawProbe {
  probe?: { country?: string; location?: { country?: string } };
  result?: {
    status?: string;
    statusCode?: number;
    timings?: { firstByte?: number; total?: number };
  };
}

function classify(result: NonNullable<RawProbe["result"]>): Pick<RegionLatency, "status" | "httpStatus" | "ttfbMs"> {
  const httpStatus = typeof result.statusCode === "number" ? result.statusCode : null;
  const ttfb = result.timings?.firstByte ?? result.timings?.total ?? null;
  if (result.status === "failed" || httpStatus == null) {
    return { status: "down", httpStatus, ttfbMs: null };
  }
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 451) {
    return { status: "blocked", httpStatus, ttfbMs: ttfb };
  }
  if (httpStatus >= 500) return { status: "down", httpStatus, ttfbMs: ttfb };
  return { status: "ok", httpStatus, ttfbMs: ttfb };
}

/** Map a finished Globalping measurement onto the fixed country list. */
export function buildLatencyReport(domain: string, probes: RawProbe[], fetchedAt = new Date().toISOString()): LatencyReport {
  const byCountry = new Map<string, RawProbe>();
  for (const probe of probes) {
    const code = (probe.probe?.location?.country ?? probe.probe?.country)?.toUpperCase();
    if (code && !byCountry.has(code)) byCountry.set(code, probe);
  }
  const regions: RegionLatency[] = LATENCY_REGIONS.map((region) => {
    const hit = byCountry.get(region.code);
    if (!hit?.result || hit.result.status === "in-progress") {
      return { code: region.code, name: region.name, status: "unavailable", httpStatus: null, ttfbMs: null };
    }
    return { code: region.code, name: region.name, ...classify(hit.result) };
  });
  return {
    domain,
    fetchedAt,
    regions,
    reachable: regions.filter((r) => r.status === "ok" || r.status === "blocked").length,
    checked: regions.filter((r) => r.status !== "unavailable").length,
  };
}
