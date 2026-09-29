import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.select().from(schema.meta).where(eq(schema.meta.key, key)).get();
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.insert(schema.meta).values({ key, value }).onConflictDoUpdate({ target: schema.meta.key, set: { value } });
}
