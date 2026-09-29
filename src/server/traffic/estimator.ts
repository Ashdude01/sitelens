// Pure traffic math. No I/O.
//
// Nobody except the site owner knows exact traffic. We turn public popularity ranks into visits with
//   log10(visits) = a + b * log10(rank)
// fitted per source on sites with known traffic (`npm run calibrate`), and always return a RANGE.
import fs from "node:fs";
import path from "node:path";
import type { Confidence, TrafficEstimate } from "@/lib/types";

export const CRUX_BUCKETS = [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000];

export const SOURCE_LABELS: Record<string, string> = {
  crux: "Chrome UX Report popularity (real Chrome users)",
  umbrella: "Cisco Umbrella top 1M (DNS query popularity)",
  majestic: "Majestic Million (referring subnets / links)",
};

export interface SourceModel {
  a: number;
  b: number;
  sigma: number;
  n?: number;
}

export interface Calibration {
  calibrated: boolean;
  note?: string;
  fittedAt?: string;
  sources: Record<string, SourceModel>;
}

export const DEFAULT_CALIBRATION: Calibration = {
  calibrated: false,
  sources: { default: { a: 10.9, b: -1.1, sigma: 0.7 } },
};

let cache: { mtime: number; cal: Calibration } | null = null;

export function calibrationPath(dataDir: string) {
  return path.join(dataDir, "calibration.json");
}

export function loadCalibration(dataDir: string): Calibration {
  try {
    const file = calibrationPath(dataDir);
    const st = fs.statSync(file);
    if (!cache || cache.mtime !== st.mtimeMs) cache = { mtime: st.mtimeMs, cal: JSON.parse(fs.readFileSync(file, "utf8")) };
    return cache.cal;
  } catch {
    return DEFAULT_CALIBRATION;
  }
}

/** CrUX gives buckets: rank R means "somewhere in (previous bucket, R]". */
export function rankInterval(source: string, rank: number): [number, number] {
  if (source !== "crux") return [rank, rank];
  const i = CRUX_BUCKETS.indexOf(rank);
  return [i > 0 ? CRUX_BUCKETS[i - 1] : 100, rank];
}

export function midRank(source: string, rank: number): number {
  const [lo, hi] = rankInterval(source, rank);
  return Math.sqrt(lo * hi);
}

/** Round to 2 significant figures. */
export function roundNice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

/**
 * Combine signals into a range. Each signal gives mu_i with sigma_i (model error + bucket width).
 * Inverse-variance weighting; disagreement between signals widens the range.
 */
export function estimateFromSignals(signals: { source: string; rank: number }[], cal: Calibration): TrafficEstimate | null {
  const parts: { source: string; rank: number; mu: number; sigma: number }[] = [];
  for (const s of signals) {
    const m = cal.sources[s.source] ?? cal.sources.default;
    if (!m) continue;
    const [lo, hi] = rankInterval(s.source, s.rank);
    const bucketSd = (Math.log10(hi / lo) * Math.abs(m.b)) / Math.sqrt(12);
    const sigma = Math.sqrt(m.sigma ** 2 + bucketSd ** 2);
    parts.push({ source: s.source, rank: s.rank, mu: m.a + m.b * Math.log10(Math.sqrt(lo * hi)), sigma });
  }
  if (!parts.length) return null;

  const w = parts.map((p) => 1 / p.sigma ** 2);
  const W = w.reduce((x, y) => x + y, 0);
  const mu = parts.reduce((acc, p, i) => acc + w[i] * p.mu, 0) / W;
  const sigmaStat = Math.sqrt(1 / W);
  const disagreement = parts.length > 1 ? Math.sqrt(parts.reduce((acc, p, i) => acc + w[i] * (p.mu - mu) ** 2, 0) / W) : 0;
  const sigma = Math.max(0.15, Math.sqrt(sigmaStat ** 2 + disagreement ** 2));

  let confidence: Confidence = sigma < 0.3 ? "High" : sigma < 0.5 ? "Medium" : "Low";
  if (!cal.calibrated && confidence === "High") confidence = "Medium";

  return {
    monthlyVisits: { low: roundNice(10 ** (mu - sigma)), mid: roundNice(10 ** mu), high: roundNice(10 ** (mu + sigma)) },
    sigmaLog10: Number(sigma.toFixed(3)),
    confidence,
    calibrated: cal.calibrated,
    signalsUsed: parts.map((p) => ({ source: p.source, rank: p.rank, pointEstimate: roundNice(10 ** p.mu), sigmaLog10: Number(p.sigma.toFixed(3)) })),
  };
}

/** Ordinary least squares on (log rank, log visits). */
export function fitSource(points: { x: number; y: number }[]): SourceModel {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const b = sxx ? sxy / sxx : -1.1;
  const a = my - b * mx;
  const rss = points.reduce((s, p) => s + (p.y - (a + b * p.x)) ** 2, 0);
  const sigma = Math.sqrt(rss / Math.max(1, n - 2));
  const r4 = (v: number) => Number(v.toFixed(4));
  return { a: r4(a), b: r4(b), sigma: r4(Math.max(0.15, sigma)), n };
}
