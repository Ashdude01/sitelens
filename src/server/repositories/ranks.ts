import { and, asc, eq, inArray, min, sql } from "drizzle-orm";
import { cacheCatalog, catalogTags } from "../cache/isr";
import { getDb, schema } from "../db/client";
import { withRetry } from "../db/bulk";
import type { Target } from "../scanner/net";
import type { RankSignal } from "@/lib/types";
import { SOURCE_LABELS } from "../traffic/estimator";
import { getMeta, setMeta } from "./meta";

/** Hostname variants a list might use for the same site. */
export function domainVariants(t: Pick<Target, "key" | "host" | "domain">): string[] {
  return [...new Set([t.key, t.host, t.domain, `www.${t.domain}`])].filter(Boolean);
}

function toSignals(rows: { source: string; domain: string; rank: number; extra: string | null }[]): RankSignal[] {
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

export async function getRankSignals(target: Pick<Target, "key" | "host" | "domain">): Promise<RankSignal[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.ranks).where(inArray(schema.ranks.domain, domainVariants(target)));
  return toSignals(rows);
}

/** Best rank per source for many domains. One query per chunk, not one query per domain. */
export async function getRankSignalsForDomains(domains: string[]): Promise<Map<string, RankSignal[]>> {
  const db = await getDb();
  const out = new Map<string, RankSignal[]>();
  const unique = [...new Set(domains)];
  const CHUNK = 500;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const rows = await withRetry(`ranks ${i + 1}-${i + slice.length}`, () =>
      db.select().from(schema.ranks).where(inArray(schema.ranks.domain, slice)),
    );
    const byDomain = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byDomain.get(row.domain);
      if (list) list.push(row);
      else byDomain.set(row.domain, [row]);
    }
    for (const domain of slice) out.set(domain, toSignals(byDomain.get(domain) ?? []));
    if (i && i % 10_000 < CHUNK) console.log(`  ranks looked up for ${Math.min(i + slice.length, unique.length).toLocaleString()} / ${unique.length.toLocaleString()}`);
  }
  return out;
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

export function listSources() {
  return cacheCatalog(["rank-sources"], catalogTags.directory, querySources);
}

async function querySources() {
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

/** Rows per INSERT. 5000 rows x 4 columns stays well under Postgres' 65,535 parameter limit. */
const BATCH = 5000;

/**
 * Replace a whole source with new rows.
 *
 * Not one big transaction on purpose: a 1M-row import takes minutes over the internet, and a single
 * dropped connection would roll back everything (the "write CONNECTION_CLOSED" error on Neon).
 * Each batch is a short upsert that is retried on connection errors. While an import runs, reports
 * may see a partial list for this source; re-run the import if it stops midway.
 */
export async function replaceSource(source: string, rows: AsyncIterable<RankRow>, onProgress?: (n: number) => void) {
  const db = await getDb();
  await withRetry(`clearing "${source}"`, () => db.delete(schema.ranks).where(eq(schema.ranks.source, source)));
  let n = 0;
  let batch: RankRow[] = [];
  const flush = async () => {
    const rows = keepLowerRank(batch, (r) => r.domain);
    batch = [];
    if (!rows.length) return;
    await withRetry(`rows ${n + 1}-${n + rows.length}`, () =>
      db
        .insert(schema.ranks)
        .values(rows.map((r) => ({ source, domain: r.domain, rank: r.rank, extra: r.extra ?? null })))
        .onConflictDoUpdate({
          target: [schema.ranks.source, schema.ranks.domain],
          set: { rank: sql`LEAST(${schema.ranks.rank}, excluded.rank)` },
        }),
    );
    n += rows.length;
    onProgress?.(n);
  };
  for await (const r of rows) {
    batch.push(r);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  await withRetry("saving import date", () => setMeta(`import:${source}`, new Date().toISOString()));
  return n;
}

/** Replace all per-country CrUX ranks. Batched and retried like replaceSource. */
export async function replaceCruxCountry(rows: AsyncIterable<{ domain: string; country: string; rank: number }>, onProgress?: (n: number) => void) {
  const db = await getDb();
  await withRetry("clearing crux-country", () => db.delete(schema.cruxCountry));
  let n = 0;
  let batch: { domain: string; country: string; rank: number }[] = [];
  const flush = async () => {
    const rows = keepLowerRank(batch, (r) => `${r.domain}\n${r.country}`);
    batch = [];
    if (!rows.length) return;
    await withRetry(`rows ${n + 1}-${n + rows.length}`, () =>
      db
        .insert(schema.cruxCountry)
        .values(rows)
        .onConflictDoUpdate({
          target: [schema.cruxCountry.domain, schema.cruxCountry.country],
          set: { rank: sql`LEAST(${schema.cruxCountry.rank}, excluded.rank)` },
        }),
    );
    n += rows.length;
    onProgress?.(n);
  };
  for await (const r of rows) {
    batch.push(r);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  await withRetry("saving import date", () => setMeta("import:crux-country", new Date().toISOString()));
  return n;
}
