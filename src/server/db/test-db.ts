import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "./client";
import * as schema from "./schema";

/** Postgres used only when DATABASE_URL starts with pglite (the test suite). A path shares one database between the test and CLI imports. */
export async function createTestDb(migrationsFolder: string, dataDir = ""): Promise<DB> {
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as DB;
}
