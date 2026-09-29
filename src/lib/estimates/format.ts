import { compact } from "@/lib/format";
import type { Range3 } from "./index";

export const money = (n: number) => {
  if (n >= 1000) return `$${compact(n)}`;
  if (n >= 10) return `$${Math.round(n)}`;
  if (n >= 1) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
};

/** "~5.2M" */
export const approx = (r: Range3, f: (n: number) => string = compact) => `~${f(r.mid)}`;
/** "2.3M – 12M" */
export const span = (r: Range3, f: (n: number) => string = compact) => (f(r.low) === f(r.high) ? f(r.mid) : `${f(r.low)} – ${f(r.high)}`);

export const duration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
};
