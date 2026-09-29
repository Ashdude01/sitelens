import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { config } from "../config";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __sitelensDb?: { db: DB; client: Client; ready: Promise<void> } };

function localSqlitePath(url: string): string {
  return url.startsWith("file://") ? fileURLToPath(url) : url.slice("file:".length);
}

/**
 * Vercel (and other serverless hosts) mount the app directory read-only, so the default
 * `data/sitelens.db` cannot be created. Fall back to the temp dir, which is writable but
 * ephemeral. A `libsql://` DATABASE_URL is unchanged and is what persists across requests.
 */
function directoryIsWritable(dir: string): boolean {
  const probe = path.join(dir, `.write-probe-${process.pid}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, "");
  } catch {
    return false;
  }
  try {
    fs.unlinkSync(probe);
  } catch {
    // The directory accepted a write. A leftover probe file is harmless.
  }
  return true;
}

export function resolveDatabaseUrl(url: string): string {
  if (!url.startsWith("file:")) return url;
  const file = localSqlitePath(url);
  const dir = path.dirname(file);
  if (directoryIsWritable(dir)) return url;
  const fallback = path.join(os.tmpdir(), "sitelens.db");
  console.warn(
    `SQLite database at ${file} is not writable. Using ephemeral ${fallback}. Set DATABASE_URL to a libsql:// database so reports persist.`,
  );
  return pathToFileURL(fallback).href;
}

function init() {
  const url = resolveDatabaseUrl(config.databaseUrl);
  if (url.startsWith("file:")) fs.mkdirSync(path.dirname(localSqlitePath(url)), { recursive: true });
  const client = createClient({ url, authToken: config.databaseAuthToken });
  const db = drizzle(client, { schema });
  const ready = (async () => {
    if (url.startsWith("file:")) {
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
