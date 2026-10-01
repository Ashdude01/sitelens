import { getTranslations } from "next-intl/server";
import { BadgeDollarSign, CircleCheck, CircleDashed, Gem } from "lucide-react";
import type { Estimates } from "@/lib/estimates";
import { WORTH_MONTHS_OF_REVENUE } from "@/lib/estimates/assumptions";
import { approx, money, span } from "@/lib/estimates/format";
import { compact } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Section } from "./section-nav";

export async function EarningsSection({ est: e }: { est: Estimates }) {
  const t = await getTranslations("earnings");
  const sections = await getTranslations("sections");
  const earn = e.earnings;
  if (!earn || !e.pageviews || !e.worth) {
    return (
      <Section id="earnings" title={sections("earnings")}>
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">{t("needs")}</p>
      </Section>
    );
  }
  const potential = earn.kind === "potential";
  return (
    <Section id="earnings" title={sections("earnings")}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="text-muted-foreground size-4" />
              {potential ? t("potential") : t("revenue")}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {earn.adNetworks.length ? (
                <span className="flex items-center gap-1">
                  <CircleCheck className="text-success size-3.5" /> {t("ads", { names: earn.adNetworks.join(", ") })}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <CircleDashed className="size-3.5" /> {t("noAds")}
                </span>
              )}
              {earn.affiliate.length > 0 && (
                <span className="flex items-center gap-1">
                  <CircleCheck className="text-success size-3.5" /> {t("affiliate", { names: earn.affiliate.join(", ") })}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  [t("day"), earn.daily],
                  [t("month"), earn.monthly],
                  [t("year"), earn.yearly],
                ] as const
              ).map(([k, r]) => (
                <div key={k} className="bg-muted/50 rounded-lg p-3">
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd className="text-2xl font-semibold">{approx(r, money)}</dd>
                  <dd className="text-muted-foreground text-xs tabular-nums">{span(r, money)}</dd>
                </div>
              ))}
            </dl>
            {/* <div className="rounded-lg border p-3 text-sm">
              <p className="mb-2 font-medium">How we calculate it</p>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                <li>
                  Monthly pageviews ≈ {span(e.pageviews.monthly)} (visits × {e.engagement.pagesPerVisit.mid.toFixed(1)} pages per visit)
                </li>
                <li>
                  × ad revenue per 1,000 pageviews of {span(earn.rpm, money)}, based on {earn.rpmBasis}
                </li>
                <li>
                  × {Math.round((1 - earn.adblock[1]) * 100)}–{Math.round((1 - earn.adblock[0]) * 100)}% of pageviews that aren&apos;t ad-blocked
                </li>
              </ol>
              <p className="text-muted-foreground mt-2 text-xs">
                Ranges combine the uncertainty of each step. Real revenue depends on niche, ad density and the ad network.
              </p>
            </div> */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gem className="text-muted-foreground size-4" /> {t("worth")}
            </CardTitle>
            <CardDescription>{t("worthNote", { low: WORTH_MONTHS_OF_REVENUE[0], high: WORTH_MONTHS_OF_REVENUE[1] })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-semibold tracking-tight">{approx(e.worth, money)}</p>
              <p className="text-muted-foreground text-sm tabular-nums">{span(e.worth, money)}</p>
            </div>
            {(e.siteType.id === "ecommerce" || e.siteType.id === "saas") && (
              <Alert>
                <AlertTitle>{t("storeTitle")}</AlertTitle>
                <AlertDescription>{e.siteType.id === "ecommerce" ? t("store") : t("saas")}</AlertDescription>
              </Alert>
            )}
            <p className="text-muted-foreground text-xs">
              {t("basis", { n: compact(e.visits?.monthly.mid ?? 0) })}
            </p>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
