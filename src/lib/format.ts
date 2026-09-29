export const fmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

export function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  const f = (v: number, big: boolean) => v.toFixed(big ? 0 : 1).replace(/\.0$/, "");
  if (n >= 1e9) return `${f(n / 1e9, n >= 1e10)}B`;
  if (n >= 1e6) return `${f(n / 1e6, n >= 1e7)}M`;
  if (n >= 1e3) return `${f(n / 1e3, n >= 1e4)}K`;
  return String(n);
}

export const isoDate = (v: string | number | null | undefined) => (v == null ? "—" : new Date(v).toISOString().slice(0, 10));

export function ago(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 48) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const yearsSince = (iso: string | null | undefined) =>
  iso ? ((Date.now() - new Date(iso).getTime()) / 3.156e10).toFixed(1) : null;
