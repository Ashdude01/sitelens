import { inArray, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { withRetry } from "../db/bulk";
import type { Target } from "../scanner/net";
import { domainVariants } from "./ranks";

/** One drizzle INSERT of tens of thousands of rows recurses until the call stack overflows. */
const UPSERT_BATCH = 400;

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
  const values = [...new Map(rows.map((r) => [r.domain, r])).values()].map((r) => ({ ...r, updatedAt: now }));
  for (let i = 0; i < values.length; i += UPSERT_BATCH) {
    const batch = values.slice(i, i + UPSERT_BATCH);
    await withRetry(`ground truth ${i + 1}-${i + batch.length}`, () =>
      db
        .insert(schema.groundTruth)
        .values(batch)
        .onConflictDoUpdate({
          target: schema.groundTruth.domain,
          set: {
            monthlyVisits: sql`excluded.monthly_visits`,
            source: sql`excluded.source`,
            period: sql`excluded.period`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    );
  }
}
