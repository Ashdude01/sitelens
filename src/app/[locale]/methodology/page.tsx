import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageAlternates } from "@/i18n/alternates";
import { isLocale } from "@/i18n/locales";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { config } from "@/server/config";
import { listSources } from "@/server/repositories/ranks";
import { loadFingerprints } from "@/server/scanner/fingerprints";
import { loadCalibration } from "@/server/traffic/estimator";
import { fmt, isoDate } from "@/lib/format";
import { ADBLOCK_RATE, RPM_BY_TIER, RPM_UNKNOWN_MIX, SITE_TYPES, WORTH_MONTHS_OF_REVENUE } from "@/lib/estimates/assumptions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("methodology");
  return {
    title: t("title"),
    description: t("description"),
    alternates: isLocale(locale) ? pageAlternates("/methodology", locale) : undefined,
  };
}

export const revalidate = 3600;

export default async function MethodologyPage() {
  const t = await getTranslations("methodology");
  const types = await getTranslations("siteTypeLabel");
  const [lists, cal] = await Promise.all([listSources(), Promise.resolve(loadCalibration(config.dataDir))]);
  const techCount = loadFingerprints().techs.length;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <article className="prose-sm space-y-6 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
          <h1 className="text-3xl font-semibold tracking-tight">{t("h1", { site: config.siteName })}</h1>
          <p>{t("intro")}</p>

          <h2>{t("techH")}</h2>
          <p>{t("techP", { count: fmt(techCount) })}</p>

          <h2>{t("trafficH")}</h2>
          <p>{t("trafficP1")}</p>
          <p>{t("trafficP2")}</p>
          <div className="flex flex-wrap gap-2">
            {lists.length ? (
              lists.map((s) => (
                <Badge key={s.source} variant="secondary">
                  {s.updated ? t("listUpdated", { source: s.source, n: fmt(s.n), date: s.updated }) : t("listBadge", { source: s.source, n: fmt(s.n) })}
                </Badge>
              ))
            ) : (
              <Badge variant="warning">{t("noLists")}</Badge>
            )}
          </div>
          <p>
            {t("trafficP3")}{" "}
            <code className="bg-muted rounded px-1">log(visits) = a + b · log(rank)</code>
          </p>

          <h2>{t("calH")}</h2>
          <p>
            {cal.calibrated ? (
              t("calYes", { date: isoDate(cal.fittedAt ?? null), note: cal.note ?? "" })
            ) : (
              <strong className="text-foreground">{t("calNo")}</strong>
            )}
          </p>

          <h2>{t("modelH")}</h2>
          <p>{t("modelP")}</p>
          <div className="overflow-x-auto rounded-lg border text-sm">
            <table className="w-full">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">{t("colType")}</th>
                  <th className="p-2 font-medium">{t("colPages")}</th>
                  <th className="p-2 font-medium">{t("colDuration")}</th>
                  <th className="p-2 font-medium">{t("colBounce")}</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {Object.entries(SITE_TYPES).map(([id, row]) => (
                  <tr key={id} className="border-t">
                    <td className="text-foreground p-2">{types(id as "website")}</td>
                    <td className="p-2 tabular-nums">{row.pagesPerVisit.join("–")}</td>
                    <td className="p-2 tabular-nums">{row.durationSec.map((x) => `${Math.round((x / 60) * 10) / 10}m`).join("–")}</td>
                    <td className="p-2 tabular-nums">{row.bouncePct.join("–")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>{t("earnH")}</h2>
          <p>
            {t("earnP", {
              t1: RPM_BY_TIER.t1.join("–"),
              t2: RPM_BY_TIER.t2.join("–"),
              t3: RPM_BY_TIER.t3.join("–"),
              mix: RPM_UNKNOWN_MIX.join("–"),
              block: ADBLOCK_RATE.map((x) => Math.round(x * 100)).join("–"),
            })}
          </p>
          <p>{t("earnP2", { months: WORTH_MONTHS_OF_REVENUE.join("–") })}</p>
          <p>{t("earnP3")}</p>

          <h2>{t("verifiedH")}</h2>
          <p>{t("verifiedP")}</p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
