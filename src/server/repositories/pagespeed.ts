import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";

export async function findPagespeed(domain: string, strategy: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.pagespeed)
    .where(and(eq(schema.pagespeed.domain, domain), eq(schema.pagespeed.strategy, strategy)))
    .limit(1);
  return row ? { data: JSON.parse(row.json) as unknown, fetchedAt: row.fetchedAt } : null;
}

export async function savePagespeed(domain: string, strategy: string, data: unknown) {
  const db = await getDb();
  const values = { domain, strategy, json: JSON.stringify(data), fetchedAt: Date.now() };
  await db
    .insert(schema.pagespeed)
    .values(values)
    .onConflictDoUpdate({ target: [schema.pagespeed.domain, schema.pagespeed.strategy], set: { json: values.json, fetchedAt: values.fetchedAt } });
}
