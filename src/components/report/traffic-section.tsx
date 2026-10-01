import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, Globe2, Info, MonitorSmartphone, Timer } from "lucide-react";
import type { Report } from "@/lib/types";
import type { Estimates } from "@/lib/estimates";
import { flag, countryName } from "@/lib/estimates";
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

export async function TrafficSection({ report: r, est: e }: { report: Report; est: Estimates }) {
  const t = await getTranslations("traffic");
  const sections = await getTranslations("sections");
  const locale = await getLocale();
  const tr = r.traffic;
  const sources: Record<string, string> = { crux: t("cruxSrc"), umbrella: t("umbrellaSrc"), majestic: t("majesticSrc") };

  // Signal agreement rows
  const rows: RangeRow[] = [];
  if (tr.verified) {
    rows.push({ label: t("verifiedOwner"), low: tr.verified.monthlyVisits, mid: tr.verified.monthlyVisits, high: tr.verified.monthlyVisits, emphasis: true });
  } else if (tr.estimate) {
    for (const s of tr.estimate.signalsUsed) {
      const sig = s.sigmaLog10 ?? 0.5;
      const rank = tr.ranks.find((x) => x.source === s.source);
      rows.push({
        label: sources[s.source] ?? s.source,
        sublabel: rank ? (s.source === "crux" ? t("bucket", { n: compact(rank.rank) }) : t("rank", { n: rank.rank.toLocaleString(locale) })) : undefined,
        low: s.pointEstimate / 10 ** sig,
        mid: s.pointEstimate,
        high: s.pointEstimate * 10 ** sig,
      });
    }
    rows.push({ label: t("combined"), sublabel: tr.estimate.confidence === "High" ? t("high") : undefined, ...tr.estimate.monthlyVisits, emphasis: true });
  }

  const device = tr.crux?.inCrux ? tr.crux.deviceSplit : null;
  const cwv = tr.crux?.inCrux ? tr.crux.coreWebVitals : null;

  return (
    <Section id="traffic" title={sections("traffic")}>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("monthly")}</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length ? (
              <>
                <RangePlot rows={rows} />
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  {tr.verified ? (
                    <Badge variant="success">
                      <BadgeCheck /> {t("verified")}
                    </Badge>
                  ) : tr.estimate?.confidence === "High" ? (
                    <Badge variant="success">{t("high")}</Badge>
                  ) : null}
                  {tr.estimate && !tr.estimate.calibrated && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="info" className="cursor-help">
                          <Info /> {t("uncalibrated")}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">{t("uncalibratedTip")}</TooltipContent>
                    </Tooltip>
                  )}
                  <Link href="/methodology" className="text-primary ml-auto hover:underline">
                    {t("methodology")}
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                {tr.verdict === "too-small" ? t("tooSmall") : t("notListed")}
              </p>
            )}
            {tr.organic && (
              <div className="mt-6">
                <SectionLabel>{t("google")}</SectionLabel>
                <KV
                  rows={[
                    [t("organic"), t("organicValue", { n: compact(tr.organic.monthlyOrganicVisits) })],
                    [t("keywords"), compact(tr.organic.keywords)],
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="text-muted-foreground size-4" /> {t("audience")}
            </CardTitle>
            <CardDescription>{e.countries.length ? t("countryShare") : t("noCountry")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {e.countries.length > 0 ? (
              <BarList
                items={e.countries.slice(0, 8).map((c) => {
                  const pct = c.share * 100;
                  // Never claim 100% when other countries are listed too.
                  const display = pct < 1 ? "<1%" : pct > 99 && e.countries.length > 1 ? ">99%" : `${Math.round(pct)}%`;
                  const rank = tr.countries.find((x) => x.country.toUpperCase() === c.code)?.rank;
                  const name = countryName(c.code, locale);
                  return {
                    key: c.code,
                    label: (
                      <span>
                        <span aria-hidden className="mr-1.5">{flag(c.code)}</span>
                        {name}
                      </span>
                    ),
                    value: c.share,
                    display,
                    tooltip: t("countryTip", { name, share: display, rank: compact(rank ?? 0) }),
                  };
                })}
              />
            ) : (
              <p className="text-muted-foreground text-sm">{t("noCountryYet")}</p>
            )}
            {device && (
              <div>
                <SectionLabel className="flex items-center gap-1.5">
                  <MonitorSmartphone className="size-3.5" /> {t("devices")}
                </SectionLabel>
                <SplitBar
                  parts={Object.entries(device).map(([label, value]) => ({
                    label: label === "phone" || label === "desktop" || label === "tablet" ? t(label) : label,
                    value,
                  }))}
                />
              </div>
            )}
            {cwv && (
              <div>
                <SectionLabel>{t("cwv")}</SectionLabel>
                <KV
                  rows={[
                    [t("lcp"), cwv.lcpMs != null ? `${(cwv.lcpMs / 1000).toFixed(2)} s` : "—"],
                    [t("inp"), cwv.inpMs != null ? `${cwv.inpMs} ms` : "—"],
                    [t("cls"), cwv.cls != null ? String(cwv.cls) : "—"],
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="text-muted-foreground size-4" /> {t("engagement")}
            </CardTitle>
            <CardDescription>{t("engagementNote")}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                [t("pages"), e.engagement.pagesPerVisit.mid.toFixed(1), span(e.engagement.pagesPerVisit, (n) => n.toFixed(1))],
                [t("duration"), duration(e.engagement.durationSec.mid), span(e.engagement.durationSec, duration)],
                [t("bounce"), `${Math.round(e.engagement.bouncePct.mid)}%`, span(e.engagement.bouncePct, (n) => `${Math.round(n)}%`)],
              ].map(([k, v, rng]) => (
                <div key={k} className="bg-muted/50 rounded-lg p-3">
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd className="text-xl font-semibold">{v}</dd>
                  <dd className="text-muted-foreground text-xs tabular-nums">{t("typical", { range: rng })}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
