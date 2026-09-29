import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { config } from "../config";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __sitelensDb?: { db: DB; client: Client; ready: Promise<void> } };

function init() {
  if (config.databaseUrl.startsWith("file:")) {
    const file = config.databaseUrl.startsWith("file://") ? fileURLToPath(config.databaseUrl) : config.databaseUrl.slice(5);
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const client = createClient({ url: config.databaseUrl, authToken: config.databaseAuthToken });
  const db = drizzle(client, { schema });
  const ready = (async () => {
    if (config.databaseUrl.startsWith("file:")) {
      await client.execute("PRAGMA journal_mode = WAL");
      await client.execute("PRAGMA busy_timeout = 5000");
    }
    await migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle") });
  })();
  return { db, client, ready };
}

/** Returns the Drizzle DB after migrations have been applied. */
export async function getDb(): Promise<DB> {
  g.__sitelensDb ??= init();
  await g.__sitelensDb.ready;
  return g.__sitelensDb.db;
}

export async function getClient(): Promise<Client> {
  g.__sitelensDb ??= init();
  await g.__sitelensDb.ready;
  return g.__sitelensDb.client;
}

export { schema };
