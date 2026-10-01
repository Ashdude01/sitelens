"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, RefreshCw } from "lucide-react";
import { LATENCY_REGIONS, type LatencyReport, type RegionLatency, type RegionStatus } from "@/lib/latency-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

function Flag({ code }: { code: string }) {
  const iso = code.toLowerCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small country flag in webp
    <img src={`https://flagcdn.com/w40/${iso}.webp`} alt="" width={20} height={15} className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover" />
  );
}
function timing(region: RegionLatency, label: (status: RegionStatus) => string) {
  if (region.status === "ok" && region.ttfbMs != null) return `${Math.round(region.ttfbMs)} ms`;
  if (region.status === "blocked" && region.ttfbMs != null) return label("blocked") + ` · ${Math.round(region.ttfbMs)} ms`;
  return label(region.status);
}

export function ReachabilityPanel({ domain }: { domain: string }) {
  const t = useTranslations("latency");
  const locale = useLocale();
  const regionName = (code: string, fallback: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const statusLabel = (status: RegionStatus) => t(status === "ok" ? "open" : status);
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
      ? t("none")
      : t("summary", { ok: data.reachable, n: data.checked })
    : null;

  return (
    <section aria-labelledby="reach-title" className="bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="reach-title" className="flex items-center gap-2 font-semibold">
          <Globe className="text-muted-foreground size-4" /> {t("title")}
        </h2>
        {data && (
          <button className="text-muted-foreground hover:text-foreground" onClick={() => load(true)} aria-label={t("again")} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        )}
      </div>

      {data ? (
        <>
          <p className="mb-3 text-sm">{summary}</p>
          <ul className="space-y-1.5">
            {data.regions.map((region) => (
              <li key={region.code} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Flag code={region.code} />
                  <span className="truncate">{regionName(region.code, region.name)}</span>
                </span>
                <span className={cn("shrink-0 text-xs font-medium tabular-nums", tone(region.status, region.ttfbMs))}>{timing(region, statusLabel)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-[11px]">{t("note")}</p>
        </>
      ) : error ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw /> {t("retry")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2" aria-busy="true">
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" /> {t("checking", { n: LATENCY_REGIONS.length })}
          </p>
          {Array.from({ length: LATENCY_REGIONS.length }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      )}
    </section>
  );
}
