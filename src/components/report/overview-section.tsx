import { getTranslations } from "next-intl/server";
import { CalendarClock, Coins, Eye, Gem, Sparkles, Trophy, Users } from "lucide-react";
import type { Report } from "@/lib/types";
import type { Estimates } from "@/lib/estimates";
import { approx, money, span } from "@/lib/estimates/format";
import { compact, fmt, yearsSince } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "./stat-tile";
import { Section } from "./section-nav";
import { SitePreview } from "./site-preview";

export async function OverviewSection({ report: r, est: e, summary }: { report: Report; est: Estimates; summary: string }) {
  const t = await getTranslations("overview");
  const sections = await getTranslations("sections");
  const types = await getTranslations("siteTypeLabel");
  const tr = r.traffic;
  const age = yearsSince(r.registration?.registered);
  const noData = t("noData");
  const siteType = types(e.siteType.id as "website");
  return (
    <Section id="overview" title={sections("overview")}>
      <div className="bg-accent/50 mb-3 flex gap-3 rounded-xl border p-4">
        <Sparkles className="text-accent-foreground mt-0.5 size-4 shrink-0" />
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-pretty">{summary}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{siteType}</Badge>
            {tr.verified ? (
              <Badge variant="success">{t("verified")}</Badge>
            ) : tr.estimate?.confidence === "High" ? (
              <Badge variant="success">{t("high")}</Badge>
            ) : !tr.estimate ? (
              <Badge variant="outline">{t("unknown")}</Badge>
            ) : null}
            {tr.estimate && !tr.estimate.calibrated && <Badge variant="info">{t("uncalibrated")}</Badge>}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <SitePreview domain={r.domain} />
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              icon={Users}
              label={t("monthly")}
              value={e.visits ? (e.verified ? compact(e.visits.monthly.mid) : approx(e.visits.monthly)) : noData}
              range={e.visits && !e.verified ? span(e.visits.monthly) : null}
              muted={!e.visits}
              note={e.verified ? t("verifiedShort") : e.visits ? t("estimated") : undefined}
            />
            <StatTile
              icon={Users}
              label={t("dailyUnique")}
              value={e.visits ? approx(e.visits.dailyUnique) : noData}
              range={e.visits ? span(e.visits.dailyUnique) : null}
              muted={!e.visits}
            />
            <StatTile
              icon={Eye}
              label={t("dailyPv")}
              value={e.pageviews ? approx(e.pageviews.daily) : noData}
              range={e.pageviews ? span(e.pageviews.daily) : null}
              muted={!e.pageviews}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile
              icon={Coins}
              label={e.earnings?.kind === "estimated" ? t("adRevenue") : t("adPotential")}
              value={e.earnings ? approx(e.earnings.monthly, money) : noData}
              range={e.earnings ? span(e.earnings.monthly, money) : null}
              muted={!e.earnings}
              note={e.earnings?.adNetworks[0]}
            />
            <StatTile
              icon={Gem}
              label={t("worth")}
              value={e.worth ? approx(e.worth, money) : noData}
              range={e.worth ? span(e.worth, money) : null}
              muted={!e.worth}
            />
            {e.bestRank ? (
              <StatTile
                icon={Trophy}
                label={t("rank")}
                value={e.bestRank.source === "crux" ? t("top", { n: compact(e.bestRank.rank) }) : `#${fmt(e.bestRank.rank)}`}
                note={e.bestRank.source === "crux" ? t("crux") : e.bestRank.source === "umbrella" ? t("umbrella") : e.bestRank.label}
              />
            ) : (
              <StatTile
                icon={CalendarClock}
                label={t("age")}
                value={age ? t("years", { n: age }) : t("ageUnknown")}
                muted={!age}
                note={r.registration?.registrar ?? undefined}
              />
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
