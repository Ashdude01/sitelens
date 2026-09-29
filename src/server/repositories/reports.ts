import { and, desc, eq, gte, isNotNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import type { CachedReport, Report, TechChange } from "@/lib/types";

export async function findReport(domain: string): Promise<CachedReport | null> {
  const db = await getDb();
  const row = await db.select().from(schema.reports).where(eq(schema.reports.domain, domain)).get();
  if (!row) return null;
  const report = JSON.parse(row.json) as Report;
  return {
    ...report,
    cache: { scannedAt: new Date(row.scannedAt).toISOString(), ageHours: Number(((Date.now() - row.scannedAt) / 3.6e6).toFixed(1)) },
  };
}

/** Save report + update tech history in one go. */
export async function saveReport(report: Report) {
  const db = await getDb();
  const now = Date.now();
  const values = {
    domain: report.domain,
    json: JSON.stringify(report),
    scannedAt: now,
    fetchOk: report.fetch.ok,
    hasTraffic: !!(report.traffic.estimate || report.traffic.verified),
    techCount: report.technologies.length,
    trafficMid: report.traffic.verified?.monthlyVisits ?? (report.traffic.estimate ? Math.round(report.traffic.estimate.monthlyVisits.mid) : null),
  };
  const techs = report.technologies.filter((t) => t.confidence >= 50);
  await db.batch([
    db.insert(schema.reports).values(values).onConflictDoUpdate({ target: schema.reports.domain, set: values }),
    ...techs.map((t) =>
      db
        .insert(schema.techHistory)
        .values({ domain: report.domain, tech: t.name, firstSeen: now, lastSeen: now })
        .onConflictDoUpdate({ target: [schema.techHistory.domain, schema.techHistory.tech], set: { lastSeen: now } }),
    ),
  ] as unknown as Parameters<typeof db.batch>[0]);
}

export async function getTechHistory(domain: string): Promise<TechChange[]> {
  const db = await getDb();
  return db
    .select({ tech: schema.techHistory.tech, firstSeen: schema.techHistory.firstSeen, lastSeen: schema.techHistory.lastSeen })
    .from(schema.techHistory)
    .where(eq(schema.techHistory.domain, domain))
    .orderBy(desc(schema.techHistory.lastSeen), schema.techHistory.tech);
}

export async function recentReports(limit = 12) {
  const db = await getDb();
  return db
    .select({ domain: schema.reports.domain, scannedAt: schema.reports.scannedAt })
    .from(schema.reports)
    .where(eq(schema.reports.fetchOk, true))
    .orderBy(desc(schema.reports.scannedAt))
    .limit(limit);
}

/** Compact card data for site lists (recent / popular / sites using a technology). */
export interface SiteCard {
  domain: string;
  title: string | null;
  favicon: string | null;
  monthlyVisits: number | null;
  verified: boolean;
  scannedAt: number;
  techs: { name: string; icon?: string }[];
}

function toCard(row: { domain: string; json: string; scannedAt: number }): SiteCard {
  const r = JSON.parse(row.json) as Report;
  return {
    domain: row.domain,
    title: r.site?.title ?? null,
    favicon: r.site?.favicon ?? null,
    monthlyVisits: r.traffic.verified?.monthlyVisits ?? r.traffic.estimate?.monthlyVisits.mid ?? null,
    verified: !!r.traffic.verified,
    scannedAt: row.scannedAt,
    techs: r.technologies
      .filter((t) => t.confidence >= 50 && !t.implied)
      .slice(0, 4)
      .map((t) => ({ name: t.name, icon: t.icon })),
  };
}

const cardCols = { domain: schema.reports.domain, json: schema.reports.json, scannedAt: schema.reports.scannedAt };

export async function recentSiteCards(limit = 8): Promise<SiteCard[]> {
  const db = await getDb();
  const rows = await db.select(cardCols).from(schema.reports).where(eq(schema.reports.fetchOk, true)).orderBy(desc(schema.reports.scannedAt)).limit(limit);
  return rows.map(toCard);
}

export async function popularSiteCards(limit = 8): Promise<SiteCard[]> {
  const db = await getDb();
  const rows = await db
    .select(cardCols)
    .from(schema.reports)
    .where(and(eq(schema.reports.fetchOk, true), isNotNull(schema.reports.trafficMid)))
    .orderBy(desc(schema.reports.trafficMid))
    .limit(limit);
  return rows.map(toCard);
}

// ---------- technology usage ----------
// A site "currently uses" a tech when the tech was seen in its latest scan (same timestamp as the report).
const currentUse = and(
  eq(schema.techHistory.domain, schema.reports.domain),
  eq(schema.techHistory.lastSeen, schema.reports.scannedAt),
);

export async function sitesUsingTech(tech: string, limit = 24): Promise<{ total: number; sites: SiteCard[] }> {
  const db = await getDb();
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.techHistory)
    .innerJoin(schema.reports, currentUse)
    .where(eq(schema.techHistory.tech, tech));
  const rows = await db
    .select(cardCols)
    .from(schema.techHistory)
    .innerJoin(schema.reports, currentUse)
    .where(eq(schema.techHistory.tech, tech))
    .orderBy(sql`${schema.reports.trafficMid} IS NULL`, desc(schema.reports.trafficMid), desc(schema.reports.scannedAt))
    .limit(limit);
  return { total: Number(total), sites: rows.map(toCard) };
}

/** Number of scanned sites currently using each technology. */
export async function techUsageCounts(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ tech: schema.techHistory.tech, n: sql<number>`count(*)` })
    .from(schema.techHistory)
    .innerJoin(schema.reports, currentUse)
    .groupBy(schema.techHistory.tech);
  return new Map(rows.map((r) => [r.tech, Number(r.n)]));
}

/** Reports rich enough to be worth indexing (avoids thin programmatic pages). */
export async function indexableReports(limit = 50_000, offset = 0) {
  const db = await getDb();
  return db
    .select({ domain: schema.reports.domain, scannedAt: schema.reports.scannedAt })
    .from(schema.reports)
    .where(and(eq(schema.reports.fetchOk, true), or(eq(schema.reports.hasTraffic, true), gte(schema.reports.techCount, 5))))
    .orderBy(desc(schema.reports.scannedAt))
    .limit(limit)
    .offset(offset);
}
