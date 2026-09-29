import Link from "next/link";
import { BadgeCheck, Globe2, Info, MonitorSmartphone, Timer } from "lucide-react";
import type { Report } from "@/lib/types";
import type { Estimates } from "@/lib/estimates";
import { flag } from "@/lib/estimates";
import { duration, span } from "@/lib/estimates/format";
import { compact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RangePlot, type RangeRow } from "@/components/charts/range-plot";
import { BarList } from "@/components/charts/bar-list";
import { SplitBar } from "@/components/charts/split-bar";
import { KV, SectionLabel } from "./kv";
import { Section } from "./section-nav";

const SHORT: Record<string, string> = { crux: "Chrome UX Report", umbrella: "Cisco Umbrella", majestic: "Majestic Million" };
const CONF_VARIANT = { High: "success", Medium: "warning", Low: "destructive" } as const;

export function TrafficSection({ report: r, est: e }: { report: Report; est: Estimates }) {
  const tr = r.traffic;

  // Signal agreement rows
  const rows: RangeRow[] = [];
  if (tr.verified) {
    rows.push({ label: "Verified (owner analytics)", low: tr.verified.monthlyVisits, mid: tr.verified.monthlyVisits, high: tr.verified.monthlyVisits, emphasis: true });
  } else if (tr.estimate) {
    for (const s of tr.estimate.signalsUsed) {
      const sig = s.sigmaLog10 ?? 0.5;
      const rank = tr.ranks.find((x) => x.source === s.source);
      rows.push({
        label: SHORT[s.source] ?? s.source,
        sublabel: rank ? (s.source === "crux" ? `top ${compact(rank.rank)} bucket` : `rank #${rank.rank.toLocaleString("en-US")}`) : undefined,
        low: s.pointEstimate / 10 ** sig,
        mid: s.pointEstimate,
        high: s.pointEstimate * 10 ** sig,
      });
    }
    rows.push({ label: "Combined estimate", sublabel: `${tr.estimate.confidence} confidence`, ...tr.estimate.monthlyVisits, emphasis: true });
  }

  const device = tr.crux?.inCrux ? tr.crux.deviceSplit : null;
  const cwv = tr.crux?.inCrux ? tr.crux.coreWebVitals : null;

  return (
    <Section id="traffic" title="Traffic" description="Where the numbers come from, who visits, and how they typically behave.">
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>How we estimate monthly visits</CardTitle>
            <CardDescription>
              Each public signal gives its own estimate. When they agree, the combined range is narrow and confidence is higher.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length ? (
              <>
                <RangePlot rows={rows} />
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  {tr.verified ? (
                    <Badge variant="success">
                      <BadgeCheck /> Verified
                    </Badge>
                  ) : tr.estimate ? (
                    <>
                      <Badge variant={CONF_VARIANT[tr.estimate.confidence]}>{tr.estimate.confidence} confidence</Badge>
                      {!tr.estimate.calibrated && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="info" className="cursor-help">
                              <Info /> Uncalibrated model
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64">Not yet fitted on sites with known traffic. Treat the range as an order of magnitude.</TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  ) : null}
                  <Link href="/methodology" className="text-primary ml-auto hover:underline">
                    Methodology
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                {tr.verdict === "too-small"
                  ? "Not in the Chrome UX Report, so Chrome has too few visitors to publish data. Likely a few thousand visits a month or less."
                  : "This domain is not in any popularity list we track. It is probably small or new. We would rather say so than invent a number."}
              </p>
            )}
            {tr.organic && (
              <div className="mt-6">
                <SectionLabel>Google search</SectionLabel>
                <KV
                  rows={[
                    ["Organic visits (est.)", `~${compact(tr.organic.monthlyOrganicVisits)} / month`],
                    ["Ranking keywords", compact(tr.organic.keywords)],
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="text-muted-foreground size-4" /> Audience
            </CardTitle>
            <CardDescription>{e.countries.length ? "Estimated share of visits by country (from Chrome popularity per country)." : "Country and device data appear when the site is in the Chrome UX Report."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {e.countries.length > 0 ? (
              <BarList
                items={e.countries.slice(0, 8).map((c) => {
                  const pct = c.share * 100;
                  // Never claim 100% when other countries are listed too.
                  const display = pct < 1 ? "<1%" : pct > 99 && e.countries.length > 1 ? ">99%" : `${Math.round(pct)}%`;
                  const rank = tr.countries.find((x) => x.country.toUpperCase() === c.code)?.rank;
                  return {
                    key: c.code,
                    label: (
                      <span>
                        <span aria-hidden className="mr-1.5">{flag(c.code)}</span>
                        {c.name}
                      </span>
                    ),
                    value: c.share,
                    display,
                    tooltip: `${c.name}: ~${display} of visits · top ${compact(rank ?? 0)} in the country`,
                  };
                })}
              />
            ) : (
              <p className="text-muted-foreground text-sm">No country data yet.</p>
            )}
            {device && (
              <div>
                <SectionLabel className="flex items-center gap-1.5">
                  <MonitorSmartphone className="size-3.5" /> Devices (real Chrome users)
                </SectionLabel>
                <SplitBar parts={Object.entries(device).map(([label, value]) => ({ label, value }))} />
              </div>
            )}
            {cwv && (
              <div>
                <SectionLabel>Core Web Vitals (p75, real users)</SectionLabel>
                <KV
                  rows={[
                    ["Largest Contentful Paint", cwv.lcpMs != null ? `${(cwv.lcpMs / 1000).toFixed(2)} s` : "—"],
                    ["Interaction to Next Paint", cwv.inpMs != null ? `${cwv.inpMs} ms` : "—"],
                    ["Cumulative Layout Shift", cwv.cls != null ? String(cwv.cls) : "—"],
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="text-muted-foreground size-4" /> Engagement
            </CardTitle>
            <CardDescription>
              Typical for {/^[aeiou]/i.test(e.siteType.label) ? "an" : "a"} {e.siteType.label.toLowerCase()}. These are industry benchmarks, not measured for this site. {e.siteType.reason}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ["Pages per visit", e.engagement.pagesPerVisit.mid.toFixed(1), span(e.engagement.pagesPerVisit, (n) => n.toFixed(1))],
                ["Avg. visit duration", duration(e.engagement.durationSec.mid), span(e.engagement.durationSec, duration)],
                ["Bounce rate", `${Math.round(e.engagement.bouncePct.mid)}%`, span(e.engagement.bouncePct, (n) => `${Math.round(n)}%`)],
              ].map(([k, v, rng]) => (
                <div key={k} className="bg-muted/50 rounded-lg p-3">
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd className="text-xl font-semibold">{v}</dd>
                  <dd className="text-muted-foreground text-xs tabular-nums">typical {rng}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
