import { eq } from "drizzle-orm";
import type { LatencyReport } from "@/lib/latency-types";
import { getDb, schema } from "../db/client";

export async function findLatency(domain: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.latency).where(eq(schema.latency.domain, domain)).limit(1);
  return row ? { data: JSON.parse(row.json) as LatencyReport, fetchedAt: row.fetchedAt } : null;
}

export async function saveLatency(domain: string, data: LatencyReport) {
  const db = await getDb();
  const values = { domain, json: JSON.stringify(data), fetchedAt: Date.now() };
  await db.insert(schema.latency).values(values).onConflictDoUpdate({ target: schema.latency.domain, set: { json: values.json, fetchedAt: values.fetchedAt } });
}

export async function findPreview(domain: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.previews).where(eq(schema.previews.domain, domain)).limit(1);
  return row ? { image: Buffer.from(row.image, "base64"), contentType: row.contentType, fetchedAt: row.fetchedAt } : null;
}

export async function savePreview(domain: string, image: Buffer, contentType: string) {
  const db = await getDb();
  const values = { domain, image: image.toString("base64"), contentType, fetchedAt: Date.now() };
  await db
    .insert(schema.previews)
    .values(values)
    .onConflictDoUpdate({ target: schema.previews.domain, set: { image: values.image, contentType: values.contentType, fetchedAt: values.fetchedAt } });
}
