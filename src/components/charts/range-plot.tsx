"use client";

import { compact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fitDomain, ticksFor } from "./log-scale";

export interface RangeRow {
  label: string;
  sublabel?: string;
  low: number;
  mid: number;
  high: number;
  /** The combined/headline row is drawn stronger. */
  emphasis?: boolean;
}

/**
 * Horizontal range plot on a log axis: one row per signal, a band for the range and a dot for the
 * point estimate. Shows how independent signals agree, which is what the confidence level summarises.
 */
export function RangePlot({ rows, unit = "visits / month" }: { rows: RangeRow[]; unit?: string }) {
  const domain = fitDomain(rows.flatMap((r) => [r.low, r.high]));
  const pct = (v: number) => ((Math.log10(Math.max(1, v)) - domain.min) / (domain.max - domain.min)) * 100;
  const ticks = ticksFor(domain);
  return (
    <figure className="w-full">
      <div className="relative">
        {/* gridlines */}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[38%] sm:left-[30%]" aria-hidden>
          {ticks.map((t) => (
            <div key={t.v} className="bg-border absolute inset-y-0 w-px" style={{ left: `${((t.v - domain.min) / (domain.max - domain.min)) * 100}%` }} />
          ))}
        </div>
        <ul className="relative space-y-1">
          {rows.map((r) => (
            <li key={r.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hover:bg-muted/60 grid cursor-default grid-cols-[38%_1fr] items-center rounded-md py-1.5 sm:grid-cols-[30%_1fr]">
                    <div className="min-w-0 pr-3">
                      <p className={cn("truncate text-sm", r.emphasis && "font-semibold")}>{r.label}</p>
                      {r.sublabel && <p className="text-muted-foreground truncate text-xs">{r.sublabel}</p>}
                    </div>
                    <div className="relative h-5">
                      <div
                        className={cn("absolute top-1/2 h-2 -translate-y-1/2 rounded-full", r.emphasis ? "bg-chart-1/35" : "bg-chart-1/15")}
                        style={{ left: `${pct(r.low)}%`, width: `${Math.max(1.5, pct(r.high) - pct(r.low))}%` }}
                      />
                      <div
                        className={cn("bg-chart-1 ring-card absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2", r.emphasis ? "size-3.5" : "size-2.5")}
                        style={{ left: `${pct(r.mid)}%` }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="font-medium">{r.label}</p>
                  <p>
                    ~{compact(r.mid)} {unit}
                    {r.low !== r.high && ` (range ${compact(r.low)}–${compact(r.high)})`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-muted-foreground mt-1 grid grid-cols-[38%_1fr] text-[11px] tabular-nums sm:grid-cols-[30%_1fr]">
        <span />
        <div className="relative h-4">
          {ticks.map((t) => (
            <span key={t.v} className="absolute -translate-x-1/2" style={{ left: `${((t.v - domain.min) / (domain.max - domain.min)) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">
        {rows.map((r) => `${r.label}: about ${compact(r.mid)} ${unit}, range ${compact(r.low)} to ${compact(r.high)}.`).join(" ")}
      </figcaption>
    </figure>
  );
}
