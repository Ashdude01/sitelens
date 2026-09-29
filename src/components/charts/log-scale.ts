/** Shared log10 scale for visit-count charts: 100 … 10B. */
export const LOG_MIN = 2;
export const LOG_MAX = 10;
export const LOG_TICKS = [
  { v: 2, label: "100" },
  { v: 4, label: "10K" },
  { v: 6, label: "1M" },
  { v: 8, label: "100M" },
  { v: 10, label: "10B" },
];

export function logPct(value: number, min = LOG_MIN, max = LOG_MAX): number {
  const v = Math.log10(Math.max(1, value));
  return Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
}

/** Fit the axis to the data (with 1 decade of air), snapped to even decades. */
export function fitDomain(values: number[]): { min: number; max: number } {
  const logs = values.filter((v) => v > 0).map((v) => Math.log10(v));
  if (!logs.length) return { min: LOG_MIN, max: LOG_MAX };
  let min = Math.floor(Math.min(...logs)) - 1;
  let max = Math.ceil(Math.max(...logs)) + 1;
  if (max - min < 4) max = min + 4;
  min = Math.max(0, min);
  return { min, max };
}

export function ticksFor({ min, max }: { min: number; max: number }) {
  const step = max - min > 6 ? 2 : 1;
  const out: { v: number; label: string }[] = [];
  for (let v = min; v <= max; v += step) {
    const n = 10 ** v;
    out.push({ v, label: n >= 1e9 ? `${n / 1e9}B` : n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}K` : String(n) });
  }
  return out;
}
