import type { CachedReport } from "@/lib/types";
import { computeEstimates } from "@/lib/estimates";
import { computeScores } from "@/lib/estimates/scores";
import { approx, money, span } from "@/lib/estimates/format";
import { compact } from "@/lib/format";
import { config } from "../config";

/** Everything the exported card / badge / PDF / HTML widget shows, computed once from a report. */
export interface CardData {
  domain: string;
  title: string | null;
  siteType: string;
  reportUrl: string;
  siteName: string;
  visits: { value: string; range: string | null; verified: boolean } | null;
  revenue: { value: string; range: string; label: string } | null;
  worth: { value: string; range: string } | null;
  rank: string | null;
  techs: string[];
  grades: { label: string; grade: string; score: number }[];
  confidence: string | null;
  scannedAt: string;
}

export function buildCardData(r: CachedReport): CardData {
  const e = computeEstimates(r);
  const scores = computeScores(r) ?? [];
  const best = e.bestRank;
  return {
    domain: r.domain,
    title: r.site?.title ?? null,
    siteType: e.siteType.label,
    reportUrl: `${config.publicUrl}/site/${encodeURIComponent(r.domain)}`,
    siteName: config.siteName,
    visits: e.visits
      ? { value: e.verified ? compact(e.visits.monthly.mid) : approx(e.visits.monthly), range: e.verified ? null : span(e.visits.monthly), verified: e.verified }
      : null,
    revenue: e.earnings
      ? { value: approx(e.earnings.monthly, money), range: span(e.earnings.monthly, money), label: e.earnings.kind === "estimated" ? "Ad revenue / mo" : "Ad potential / mo" }
      : null,
    worth: e.worth ? { value: approx(e.worth, money), range: span(e.worth, money) } : null,
    rank: best ? (best.source === "crux" ? `Top ${compact(best.rank)}` : `#${best.rank.toLocaleString("en-US")}`) : null,
    techs: r.technologies.filter((t) => t.confidence >= 50 && !t.implied).slice(0, 8).map((t) => t.name),
    grades: scores.map((s) => ({ label: s.label, grade: s.grade, score: s.score })),
    confidence: r.traffic.verified ? "Verified" : (r.traffic.estimate?.confidence ?? null),
    scannedAt: r.scannedAt,
  };
}
