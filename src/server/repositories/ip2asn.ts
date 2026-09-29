import { desc, lte } from "drizzle-orm";
import { getClient, getDb, schema } from "../db/client";
import { setMeta } from "./meta";

export const ipToInt = (ip: string) => ip.split(".").reduce((acc, o) => acc * 256 + Number(o), 0);

export async function lookupAsn(ip: string) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null;
  const n = ipToInt(ip);
  const db = await getDb();
  const row = await db.select().from(schema.ip2asn).where(lte(schema.ip2asn.start, n)).orderBy(desc(schema.ip2asn.start)).limit(1).get();
  return row && row.end >= n && row.asn ? { asn: row.asn, org: row.org, country: row.country } : null;
}

export async function replaceIp2Asn(rows: { start: number; end: number; asn: number; country: string | null; org: string | null }[]) {
  const client = await getClient();
  const tx = await client.transaction("write");
  try {
    await tx.execute("DELETE FROM ip2asn");
    for (let i = 0; i < rows.length; i += 2000) {
      const batch = rows.slice(i, i + 2000);
      await tx.execute({
        sql: `INSERT OR REPLACE INTO ip2asn(start, end, asn, country, org) VALUES ${batch.map(() => "(?, ?, ?, ?, ?)").join(",")}`,
        args: batch.flatMap((r) => [r.start, r.end, r.asn, r.country, r.org]),
      });
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  await setMeta("import:ip2asn", new Date().toISOString());
}
