import { and, asc, eq, inArray, min, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import type { Target } from "../scanner/net";
import type { RankSignal } from "@/lib/types";
import { SOURCE_LABELS } from "../traffic/estimator";
import { getMeta, setMeta } from "./meta";

/** Hostname variants a list might use for the same site. */
export function domainVariants(t: Pick<Target, "key" | "host" | "domain">): string[] {
  return [...new Set([t.key, t.host, t.domain, `www.${t.domain}`])].filter(Boolean);
}

export async function getRankSignals(target: Pick<Target, "key" | "host" | "domain">): Promise<RankSignal[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.ranks).where(inArray(schema.ranks.domain, domainVariants(target)));
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = best.get(r.source);
    if (!cur || r.rank < cur.rank) best.set(r.source, r);
  }
  return [...best.values()].map((r) => ({
    source: r.source,
    label: SOURCE_LABELS[r.source] ?? r.source,
    rank: r.rank,
    matched: r.domain,
    extra: r.extra ? JSON.parse(r.extra) : null,
  }));
}

export async function getCountryPopularity(target: Pick<Target, "key" | "host" | "domain">) {
  const db = await getDb();
  const rank = min(schema.cruxCountry.rank);
  const rows = await db
    .select({ country: schema.cruxCountry.country, rank })
    .from(schema.cruxCountry)
    .where(inArray(schema.cruxCountry.domain, domainVariants(target)))
    .groupBy(schema.cruxCountry.country)
    .orderBy(asc(rank), asc(schema.cruxCountry.country))
    .limit(10);
  return rows.map((r) => ({ country: r.country, rank: Number(r.rank) }));
}

export async function listSources() {
  const db = await getDb();
  const rows = await db
    .select({ source: schema.ranks.source, n: sql<number>`count(*)` })
    .from(schema.ranks)
    .groupBy(schema.ranks.source);
  return Promise.all(rows.map(async (r) => ({ ...r, updated: ((await getMeta(`import:${r.source}`)) ?? "").slice(0, 10) })));
}

export async function getRanksForDomain(source: string, domain: string) {
  const db = await getDb();
  return db.select().from(schema.ranks).where(and(eq(schema.ranks.source, source), eq(schema.ranks.domain, domain)));
}

type RankRow = { domain: string; rank: number; extra?: string | null };

function keepLowerRank<T extends { rank: number }>(rows: T[], key: (row: T) => string): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    const cur = best.get(id);
    if (!cur || row.rank < cur.rank) best.set(id, row);
  }
  return [...best.values()];
}

/** Replace a whole source with new rows. Streams in batches inside one write transaction. */
export async function replaceSource(source: string, rows: AsyncIterable<RankRow>, onProgress?: (n: number) => void) {
  const db = await getDb();
  let n = 0;
  await db.transaction(async (tx) => {
    await tx.delete(schema.ranks).where(eq(schema.ranks.source, source));
    let batch: RankRow[] = [];
    const flush = async () => {
      const rows = keepLowerRank(batch, (r) => r.domain);
      batch = [];
      if (!rows.length) return;
      await tx
        .insert(schema.ranks)
        .values(rows.map((r) => ({ source, domain: r.domain, rank: r.rank, extra: r.extra ?? null })))
        .onConflictDoUpdate({
          target: [schema.ranks.source, schema.ranks.domain],
          set: { rank: sql`LEAST(${schema.ranks.rank}, excluded.rank)` },
        });
      n += rows.length;
      onProgress?.(n);
    };
    for await (const r of rows) {
      batch.push(r);
      if (batch.length >= 2000) await flush();
    }
    await flush();
  });
  await setMeta(`import:${source}`, new Date().toISOString());
  return n;
}

export async function replaceCruxCountry(rows: AsyncIterable<{ domain: string; country: string; rank: number }>, onProgress?: (n: number) => void) {
  const db = await getDb();
  let n = 0;
  await db.transaction(async (tx) => {
    await tx.delete(schema.cruxCountry);
    let batch: { domain: string; country: string; rank: number }[] = [];
    const flush = async () => {
      const rows = keepLowerRank(batch, (r) => `${r.domain}\n${r.country}`);
      batch = [];
      if (!rows.length) return;
      await tx
        .insert(schema.cruxCountry)
        .values(rows)
        .onConflictDoUpdate({
          target: [schema.cruxCountry.domain, schema.cruxCountry.country],
          set: { rank: sql`LEAST(${schema.cruxCountry.rank}, excluded.rank)` },
        });
      n += rows.length;
      onProgress?.(n);
    };
    for await (const r of rows) {
      batch.push(r);
      if (batch.length >= 2000) await flush();
    }
    await flush();
  });
  await setMeta("import:crux-country", new Date().toISOString());
  return n;
}
