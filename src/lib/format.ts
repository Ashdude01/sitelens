export const fmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const f = (v: number) => `${sign}${Math.round(v)}`;
  if (abs >= 1e9) return `${f(abs / 1e9)}B`;
  if (abs >= 1e6) return `${f(abs / 1e6)}M`;
  if (abs >= 1e3) return `${f(abs / 1e3)}K`;
  return `${sign}${Math.round(abs)}`;
}

export const isoDate = (v: string | number | null | undefined) => (v == null ? "—" : new Date(v).toISOString().slice(0, 10));

export function ago(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 48) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const yearsSince = (iso: string | null | undefined) =>
  iso ? ((Date.now() - new Date(iso).getTime()) / 3.156e10).toFixed(1) : null;
