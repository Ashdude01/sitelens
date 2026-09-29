import { inArray } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import type { Target } from "../scanner/net";
import { domainVariants } from "./ranks";

export async function findGroundTruth(target: Pick<Target, "key" | "host" | "domain">) {
  const db = await getDb();
  return (await db.select().from(schema.groundTruth).where(inArray(schema.groundTruth.domain, domainVariants(target))).limit(1).get()) ?? null;
}

export async function allGroundTruth() {
  const db = await getDb();
  return db.select().from(schema.groundTruth);
}

export async function upsertGroundTruth(rows: { domain: string; monthlyVisits: number; source: string; period: string | null }[]) {
  if (!rows.length) return;
  const db = await getDb();
  const now = Date.now();
  await db.batch(
    rows.map((r) =>
      db
        .insert(schema.groundTruth)
        .values({ ...r, updatedAt: now })
        .onConflictDoUpdate({
          target: schema.groundTruth.domain,
          set: { monthlyVisits: r.monthlyVisits, source: r.source, period: r.period, updatedAt: now },
        }),
    ) as unknown as Parameters<typeof db.batch>[0],
  );
}
