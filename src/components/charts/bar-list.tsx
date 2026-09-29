"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface BarItem {
  key: string;
  label: React.ReactNode;
  /** 0–1 share, drives bar length. */
  value: number;
  display: string;
  tooltip?: string;
}

/** Single-series horizontal bars: thin marks, rounded data end, value at the tip, whole row is the hover target. */
export function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.key}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hover:bg-muted/60 grid cursor-default grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-md px-1 py-1.5 sm:grid-cols-[minmax(0,11rem)_1fr]">
                <span className="truncate text-sm">{i.label}</span>
                <div className="flex items-center gap-2">
                  <div className="bg-chart-1 h-2.5 rounded-r-[4px]" style={{ width: `${Math.max(1.5, (i.value / max) * 85)}%` }} />
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{i.display}</span>
                </div>
              </div>
            </TooltipTrigger>
            {i.tooltip && <TooltipContent side="top">{i.tooltip}</TooltipContent>}
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}
