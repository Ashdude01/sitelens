import path from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __sitelensDb?: Promise<DB>; __sitelensRev?: number };

/** Bump when a new SQL migration must run on an already-open dev server. */
const MIGRATION_REV = 2;

function migrationsFolder() {
  return process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");
}

async function open(): Promise<DB> {
  const url = config.databaseUrl;
  if (url === "pglite" || url.startsWith("pglite:")) {
    const { createTestDb } = await import("./test-db");
    return createTestDb(migrationsFolder(), url.slice("pglite:".length));
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(
      "DATABASE_URL must be a Postgres connection string (postgresql://...). Add your Neon connection string to .env and to the Vercel project settings.",
    );
  }
  // prepare:false is required for Neon's pooled (`-pooler`) connections.
  const client = postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 15 });
  const db = drizzle(client, { schema });
  return db;
}

/** Returns the Drizzle DB after migrations have been applied. */
export function getDb(): Promise<DB> {
  if (!g.__sitelensDb || g.__sitelensRev !== MIGRATION_REV) {
    const prev = g.__sitelensDb;
    g.__sitelensRev = MIGRATION_REV;
    g.__sitelensDb = (prev ?? open()).then(async (db) => {
      const url = process.env.DATABASE_URL?.trim() ?? config.databaseUrl;
      if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
        await migrate(db, { migrationsFolder: migrationsFolder() });
      }
      return db;
    });
  }
  return g.__sitelensDb;
}

export { schema };
