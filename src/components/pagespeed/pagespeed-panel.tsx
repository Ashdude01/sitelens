"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Gauge, Loader2, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { formatMetric, scoreRating, type PsiResult, type PsiStrategy, type Rating } from "@/lib/pagespeed-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Status colors always come with a shape + label (never color alone), like PageSpeed Insights.
const TONE: Record<Rating, { text: string; bg: string; label: string }> = {
  good: { text: "text-success", bg: "bg-success", label: "Good" },
  "needs-improvement": { text: "text-warning", bg: "bg-warning", label: "Needs improvement" },
  poor: { text: "text-destructive", bg: "bg-destructive", label: "Poor" },
};

function RatingShape({ rating, className }: { rating: Rating; className?: string }) {
  const c = cn("inline-block shrink-0", TONE[rating].text, className);
  if (rating === "good") return <svg viewBox="0 0 10 10" className={cn("size-2.5", c)} aria-hidden><circle cx="5" cy="5" r="5" fill="currentColor" /></svg>;
  if (rating === "needs-improvement") return <svg viewBox="0 0 10 10" className={cn("size-2.5", c)} aria-hidden><rect width="10" height="10" fill="currentColor" /></svg>;
  return <svg viewBox="0 0 10 10" className={cn("size-2.5", c)} aria-hidden><path d="M5 0 10 10H0z" fill="currentColor" /></svg>;
}

function ScoreGauge({ score, label, size }: { score: number | null; label: string; size: number }) {
  const rating = scoreRating(score);
  const stroke = size > 80 ? 8 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className={cn("relative", TONE[rating].text)} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score ?? "n/a"} of 100, ${TONE[rating].label}`}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${((score ?? 0) / 100) * c} ${c}`} />
        </svg>
        <span className={cn("absolute inset-0 grid place-items-center font-semibold", size > 80 ? "text-3xl" : "text-base")}>{score ?? "–"}</span>
      </div>
      <span className={cn("leading-tight", size > 80 ? "text-sm font-medium" : "text-muted-foreground text-[11px]")}>{label}</span>
    </div>
  );
}

function DistributionBar({ dist }: { dist: [number, number, number] }) {
  const parts: [Rating, number][] = [
    ["good", dist[0]],
    ["needs-improvement", dist[1]],
    ["poor", dist[2]],
  ];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-1.5 w-full cursor-default gap-0.5 overflow-hidden rounded-full">
          {parts.map(([r, v]) => (v > 0 ? <div key={r} className={TONE[r].bg} style={{ width: `${v * 100}%` }} /> : null))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {parts.map(([r, v]) => `${TONE[r].label} ${Math.round(v * 100)}%`).join(" · ")}
      </TooltipContent>
    </Tooltip>
  );
}

function PanelBody({ data }: { data: PsiResult }) {
  const perf = data.scores.find((s) => s.id === "performance");
  const others = data.scores.filter((s) => s.id !== "performance");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ScoreGauge score={perf?.score ?? null} label="Performance" size={96} />
        <div className="grid flex-1 grid-cols-3 gap-1">
          {others.map((s) => (
            <ScoreGauge key={s.id} score={s.score} label={s.label} size={46} />
          ))}
        </div>
      </div>
      <div className="text-muted-foreground flex items-center justify-center gap-3 text-[11px]">
        <span className="flex items-center gap-1"><RatingShape rating="poor" /> 0–49</span>
        <span className="flex items-center gap-1"><RatingShape rating="needs-improvement" /> 50–89</span>
        <span className="flex items-center gap-1"><RatingShape rating="good" /> 90–100</span>
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Core Web Vitals</p>
          {data.field?.passed != null ? (
            <span className={cn("flex items-center gap-1.5 text-xs font-semibold", data.field.passed ? "text-success" : "text-destructive")}>
              <RatingShape rating={data.field.passed ? "good" : "poor"} />
              {data.field.passed ? "Passed" : "Failed"}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">No assessment</span>
          )}
        </div>
        {data.field ? (
          <ul className="space-y-3">
            {data.field.metrics.map((m) => (
              <li key={m.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {m.label} {m.core && <span className="text-foreground font-medium">({m.id})</span>}
                  </span>
                  <span className={cn("flex items-center gap-1 font-semibold tabular-nums", TONE[m.rating].text)}>
                    <RatingShape rating={m.rating} />
                    {formatMetric(m.id, m.p75)}
                  </span>
                </div>
                <DistributionBar dist={m.distribution} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Not enough real Chrome users visit this site for Google to publish field data. Lab results are shown below.
          </p>
        )}
        {data.field && (
          <p className="text-muted-foreground mt-3 text-[11px]">
            Real users over the last 28 days, 75th percentile{data.field.scope === "origin" ? " (whole site)" : ""}.
          </p>
        )}
      </div>

      {data.lab.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Lab test (Lighthouse)</p>
          <dl className="grid grid-cols-2 gap-2">
            {data.lab.map((m) => (
              <div key={m.id} className="bg-muted/50 rounded-md p-2">
                <dt className="text-muted-foreground truncate text-[11px]">{m.label}</dt>
                <dd className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                  <RatingShape rating={m.rating} />
                  {m.display}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {data.opportunities.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Top fixes</p>
          <ul className="space-y-1.5 text-xs">
            {data.opportunities.map((o) => (
              <li key={o.title} className="flex items-start justify-between gap-3">
                <span>{o.title}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">−{o.savings}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.screenshot && (
        // eslint-disable-next-line @next/next/no-img-element -- base64 screenshot from Lighthouse
        <img
          src={data.screenshot}
          alt={`How the page looked on ${data.strategy}`}
          className="mx-auto max-h-56 rounded-md border"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
    </div>
  );
}

export function PageSpeedPanel({ domain }: { domain: string }) {
  const [strategy, setStrategy] = useState<PsiStrategy>("mobile");
  const [state, setState] = useState<Record<PsiStrategy, { data?: PsiResult; error?: string; loading?: boolean }>>({ mobile: {}, desktop: {} });

  const load = useCallback(
    async (s: PsiStrategy, refresh = false) => {
      setState((p) => ({ ...p, [s]: { ...p[s], loading: true, error: undefined } }));
      try {
        const res = await fetch(`/api/v1/pagespeed?domain=${encodeURIComponent(domain)}&strategy=${s}${refresh ? "&refresh=1" : ""}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "PageSpeed failed");
        setState((p) => ({ ...p, [s]: { data: json } }));
      } catch (e) {
        setState((p) => ({ ...p, [s]: { ...p[s], loading: false, error: (e as Error).message } }));
      }
    },
    [domain],
  );

  useEffect(() => {
    const cur = state[strategy];
    if (!cur.data && !cur.loading && !cur.error) void load(strategy);
  }, [strategy, state, load]);

  const cur = state[strategy];
  return (
    <section aria-labelledby="psi-title" className="bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="psi-title" className="flex items-center gap-2 font-semibold">
          <Gauge className="text-muted-foreground size-4" /> PageSpeed
        </h2>
        <div role="tablist" aria-label="Device" className="bg-muted flex rounded-md p-0.5">
          {(["mobile", "desktop"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={strategy === s}
              onClick={() => setStrategy(s)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs capitalize transition-colors",
                strategy === s ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "mobile" ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {cur.data && !cur.loading ? (
        <PanelBody data={cur.data} />
      ) : cur.error ? (
        <div className="space-y-3 py-6 text-center">
          <p className="text-muted-foreground text-sm">{cur.error}</p>
          <Button variant="outline" size="sm" onClick={() => load(strategy)}>
            <RefreshCw /> Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-4" aria-busy="true">
          <div className="flex items-center gap-4">
            <Skeleton className="size-24 rounded-full" />
            <div className="grid flex-1 grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="mx-auto size-11 rounded-full" />
              ))}
            </div>
          </div>
          <p className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" /> Running Google Lighthouse ({strategy}), this can take up to 30 s…
          </p>
          <Skeleton className="h-40" />
        </div>
      )}

      <div className="text-muted-foreground mt-4 flex items-center justify-between gap-2 border-t pt-3 text-[11px]">
        <span>{cur.data ? `Tested ${new Date(cur.data.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} via Google` : "Data from Google PageSpeed Insights"}</span>
        <div className="flex items-center gap-2">
          {cur.data && (
            <button className="hover:text-foreground" onClick={() => load(strategy, true)} aria-label="Re-run PageSpeed test" title="Re-run test">
              <RefreshCw className="size-3.5" />
            </button>
          )}
          <a
            href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`https://${domain}/`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground flex items-center gap-1"
          >
            Full report <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
