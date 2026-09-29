import { and, asc, eq, inArray, min, sql } from "drizzle-orm";
import { getClient, getDb, schema } from "../db/client";
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

/** Replace a whole source with new rows. Streams in batches inside one write transaction. */
export async function replaceSource(source: string, rows: AsyncIterable<RankRow>, onProgress?: (n: number) => void) {
  const client = await getClient();
  const tx = await client.transaction("write");
  let n = 0;
  try {
    await tx.execute({ sql: "DELETE FROM ranks WHERE source = ?", args: [source] });
    let batch: RankRow[] = [];
    const flush = async () => {
      if (!batch.length) return;
      const placeholders = batch.map(() => "(?, ?, ?, ?)").join(",");
      await tx.execute({
        sql: `INSERT INTO ranks(source, domain, rank, extra) VALUES ${placeholders}
              ON CONFLICT(source, domain) DO UPDATE SET rank = MIN(rank, excluded.rank)`,
        args: batch.flatMap((r) => [source, r.domain, r.rank, r.extra ?? null]),
      });
      n += batch.length;
      onProgress?.(n);
      batch = [];
    };
    for await (const r of rows) {
      batch.push(r);
      if (batch.length >= 2000) await flush();
    }
    await flush();
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  await setMeta(`import:${source}`, new Date().toISOString());
  return n;
}

export async function replaceCruxCountry(rows: AsyncIterable<{ domain: string; country: string; rank: number }>, onProgress?: (n: number) => void) {
  const client = await getClient();
  const tx = await client.transaction("write");
  let n = 0;
  try {
    await tx.execute("DELETE FROM crux_country");
    let batch: { domain: string; country: string; rank: number }[] = [];
    const flush = async () => {
      if (!batch.length) return;
      await tx.execute({
        sql: `INSERT INTO crux_country(domain, country, rank) VALUES ${batch.map(() => "(?, ?, ?)").join(",")}
              ON CONFLICT(domain, country) DO UPDATE SET rank = MIN(rank, excluded.rank)`,
        args: batch.flatMap((r) => [r.domain, r.country, r.rank]),
      });
      n += batch.length;
      onProgress?.(n);
      batch = [];
    };
    for await (const r of rows) {
      batch.push(r);
      if (batch.length >= 3000) await flush();
    }
    await flush();
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  await setMeta("import:crux-country", new Date().toISOString());
  return n;
}
