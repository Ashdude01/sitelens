import { desc, lte, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { withRetry } from "../db/bulk";
import { setMeta } from "./meta";

export const ipToInt = (ip: string) => ip.split(".").reduce((acc, o) => acc * 256 + Number(o), 0);

export async function lookupAsn(ip: string) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null;
  const n = ipToInt(ip);
  const db = await getDb();
  const [row] = await db.select().from(schema.ip2asn).where(lte(schema.ip2asn.start, n)).orderBy(desc(schema.ip2asn.start)).limit(1);
  return row && row.end >= n && row.asn ? { asn: row.asn, org: row.org, country: row.country } : null;
}

/** Replace the IP -> ASN table. Batched and retried instead of one long transaction (see db/bulk.ts). */
export async function replaceIp2Asn(rows: { start: number; end: number; asn: number; country: string | null; org: string | null }[]) {
  const db = await getDb();
  await withRetry("clearing ip2asn", () => db.delete(schema.ip2asn));
  for (let i = 0; i < rows.length; i += 5000) {
    const batch = rows.slice(i, i + 5000);
    if (!batch.length) continue;
    await withRetry(`rows ${i + 1}-${i + batch.length}`, () =>
      db
        .insert(schema.ip2asn)
        .values(batch)
        .onConflictDoUpdate({
          target: schema.ip2asn.start,
          set: { end: sql`excluded."end"`, asn: sql`excluded.asn`, country: sql`excluded.country`, org: sql`excluded.org` },
        }),
    );
    if ((i / 5000) % 20 === 19) console.log(`  ${(i + batch.length).toLocaleString()} / ${rows.length.toLocaleString()} ranges`);
  }
  await withRetry("saving import date", () => setMeta("import:ip2asn", new Date().toISOString()));
}
