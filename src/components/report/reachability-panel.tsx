"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, RefreshCw } from "lucide-react";
import type { LatencyReport, RegionLatency, RegionStatus } from "@/lib/latency-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LABEL: Record<RegionStatus, string> = {
  ok: "Open",
  blocked: "Blocked",
  down: "No reply",
  unavailable: "No probe",
};

function tone(status: RegionStatus, ttfbMs: number | null) {
  if (status === "ok") {
    if (ttfbMs != null && ttfbMs <= 400) return "text-success";
    if (ttfbMs != null && ttfbMs <= 1000) return "text-warning";
    return "text-destructive";
  }
  if (status === "blocked") return "text-warning";
  if (status === "down") return "text-destructive";
  return "text-muted-foreground";
}

function timing(region: RegionLatency) {
  if (region.status === "ok" && region.ttfbMs != null) return `${Math.round(region.ttfbMs)} ms`;
  if (region.status === "blocked" && region.ttfbMs != null) return `Blocked · ${Math.round(region.ttfbMs)} ms`;
  return LABEL[region.status];
}

export function ReachabilityPanel({ domain }: { domain: string }) {
  const [data, setData] = useState<LatencyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/latency?domain=${encodeURIComponent(domain)}${refresh ? "&refresh=1" : ""}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Worldwide check failed");
        setData(json as LatencyReport);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [domain],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data
    ? data.checked === 0
      ? "No probes online right now."
      : `Replied from ${data.reachable} of ${data.checked} regions.`
    : null;

  return (
    <section aria-labelledby="reach-title" className="bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="reach-title" className="flex items-center gap-2 font-semibold">
          <Globe className="text-muted-foreground size-4" /> Worldwide
        </h2>
        {data && (
          <button className="text-muted-foreground hover:text-foreground" onClick={() => load(true)} aria-label="Check worldwide reach again" disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        )}
      </div>

      {data ? (
        <>
          <p className="mb-3 text-sm">{summary}</p>
          <ul className="space-y-1.5">
            {data.regions.map((region) => (
              <li key={region.code} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{region.name}</span>
                <span className={cn("shrink-0 text-xs font-medium tabular-nums", tone(region.status, region.ttfbMs))}>{timing(region)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-[11px]">Time to first byte over HTTPS, measured locally in each country.</p>
        </>
      ) : error ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw /> Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-2" aria-busy="true">
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" /> Checking seven regions…
          </p>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      )}
    </section>
  );
}
