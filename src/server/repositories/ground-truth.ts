import { inArray, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import type { Target } from "../scanner/net";
import { domainVariants } from "./ranks";

export async function findGroundTruth(target: Pick<Target, "key" | "host" | "domain">) {
  const db = await getDb();
  const [row] = await db.select().from(schema.groundTruth).where(inArray(schema.groundTruth.domain, domainVariants(target))).limit(1);
  return row ?? null;
}

export async function allGroundTruth() {
  const db = await getDb();
  return db.select().from(schema.groundTruth);
}

export async function upsertGroundTruth(rows: { domain: string; monthlyVisits: number; source: string; period: string | null }[]) {
  if (!rows.length) return;
  const db = await getDb();
  const now = Date.now();
  const byDomain = new Map(rows.map((r) => [r.domain, r]));
  await db
    .insert(schema.groundTruth)
    .values([...byDomain.values()].map((r) => ({ ...r, updatedAt: now })))
    .onConflictDoUpdate({
      target: schema.groundTruth.domain,
      set: {
        monthlyVisits: sql`excluded.monthly_visits`,
        source: sql`excluded.source`,
        period: sql`excluded.period`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}
