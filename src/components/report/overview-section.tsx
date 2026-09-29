import { CalendarClock, Coins, Eye, Gem, Trophy, Users, Sparkles } from "lucide-react";
import type { Report } from "@/lib/types";
import type { Estimates } from "@/lib/estimates";
import { approx, money, span } from "@/lib/estimates/format";
import { compact, fmt, yearsSince } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "./stat-tile";
import { Section } from "./section-nav";

const CONF_VARIANT = { High: "success", Medium: "warning", Low: "destructive" } as const;

export function OverviewSection({ report: r, est: e, summary }: { report: Report; est: Estimates; summary: string }) {
  const tr = r.traffic;
  const age = yearsSince(r.registration?.registered);
  const noData = "No data";
  return (
    <Section id="overview" title="Overview">
      <div className="bg-accent/50 mb-4 flex gap-3 rounded-xl border p-4">
        <Sparkles className="text-accent-foreground mt-0.5 size-4 shrink-0" />
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-pretty">{summary}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{e.siteType.label}</Badge>
            {tr.verified ? (
              <Badge variant="success">Verified traffic</Badge>
            ) : tr.estimate ? (
              <Badge variant={CONF_VARIANT[tr.estimate.confidence]}>{tr.estimate.confidence} confidence estimate</Badge>
            ) : (
              <Badge variant="outline">Traffic unknown</Badge>
            )}
            {tr.estimate && !tr.estimate.calibrated && <Badge variant="info">Uncalibrated model</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile
          icon={Users}
          label="Monthly visits"
          value={e.visits ? (e.verified ? compact(e.visits.monthly.mid) : approx(e.visits.monthly)) : noData}
          range={e.visits && !e.verified ? span(e.visits.monthly) : null}
          muted={!e.visits}
          note={e.verified ? "Verified by owner" : e.visits ? "Estimated" : "Not in popularity lists"}
        />
        <StatTile
          icon={Users}
          label="Daily unique visitors"
          value={e.visits ? approx(e.visits.dailyUnique) : noData}
          range={e.visits ? span(e.visits.dailyUnique) : null}
          muted={!e.visits}
          note={e.visits ? "Modeled from visits" : undefined}
        />
        <StatTile
          icon={Eye}
          label="Daily pageviews"
          value={e.pageviews ? approx(e.pageviews.daily) : noData}
          range={e.pageviews ? span(e.pageviews.daily) : null}
          muted={!e.pageviews}
          note={e.pageviews ? `× ${e.engagement.pagesPerVisit.mid.toFixed(1)} pages per visit` : undefined}
        />
        <StatTile
          icon={Coins}
          label={e.earnings?.kind === "estimated" ? "Ad revenue / month" : "Ad potential / month"}
          value={e.earnings ? approx(e.earnings.monthly, money) : noData}
          range={e.earnings ? span(e.earnings.monthly, money) : null}
          muted={!e.earnings}
          note={e.earnings ? (e.earnings.kind === "estimated" ? `${e.earnings.adNetworks[0]} detected` : "No ad network detected") : undefined}
        />
        <StatTile
          icon={Gem}
          label="Estimated worth"
          value={e.worth ? approx(e.worth, money) : noData}
          range={e.worth ? span(e.worth, money) : null}
          muted={!e.worth}
          note={e.worth ? "As an ad-funded site" : undefined}
        />
        {e.bestRank ? (
          <StatTile
            icon={Trophy}
            label="Popularity rank"
            value={e.bestRank.source === "crux" ? `Top ${compact(e.bestRank.rank)}` : `#${fmt(e.bestRank.rank)}`}
            note={e.bestRank.source === "crux" ? "Chrome UX Report, global" : e.bestRank.source === "umbrella" ? "Cisco Umbrella, global" : e.bestRank.label}
          />
        ) : (
          <StatTile icon={CalendarClock} label="Domain age" value={age ? `${age} yrs` : "Unknown"} muted={!age} note={r.registration?.registrar ?? undefined} />
        )}
      </div>
    </Section>
  );
}
