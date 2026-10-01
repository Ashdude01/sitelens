// Copy SiteLens data from one Postgres database to another (e.g. Neon -> Aiven). No pg_dump needed.
//
//   npm run copy-db -- "<FROM database URL>" "<TO database URL>"
//   npm run copy-db -- "<FROM>" "<TO>" --with-ranks     also copy ranks + crux_country (large)
//
// Creates the tables on the target (same migrations as the app), then copies rows in batches.
// Rank lists are skipped by default: re-importing them from your files is faster and they are most of the size.
// Safe to re-run: existing rows on the target are left as they are (ON CONFLICT DO NOTHING).
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { withRetry } from "@/server/db/bulk";

const args = process.argv.slice(2);
const [fromUrl, toUrl] = args.filter((a) => !a.startsWith("--"));
const withRanks = args.includes("--with-ranks");

if (!fromUrl || !toUrl || ![fromUrl, toUrl].every((u) => /^postgres(ql)?:\/\//.test(u))) {
  console.log(usage());
  process.exit(1);
}

function usage() {
  return 'Usage: npm run copy-db -- "postgresql://FROM..." "postgresql://TO..." [--with-ranks]';
}

/** Neon's pooler can drop long reads; use its direct host (same name without "-pooler"). */
function direct(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".neon.tech")) u.hostname = u.hostname.replace("-pooler.", ".");
    return u.toString();
  } catch {
    return url;
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "?";
  }
};

// Small tables first. ranks / crux_country only with --with-ranks.
const TABLES = ["meta", "ground_truth", "reports", "tech_history", "pagespeed", "latency", "previews", "ip2asn"];
if (withRanks) TABLES.push("ranks", "crux_country");

const BATCH = 1000;

async function main() {
  const opts = { max: 1, prepare: false, connect_timeout: 20, onnotice: () => {} } as const;
  const src = postgres(direct(fromUrl), opts);
  const dst = postgres(direct(toUrl), opts);
  console.log(`From: ${hostOf(fromUrl)}\nTo:   ${hostOf(toUrl)}\n`);

  console.log("Creating tables on the target…");
  await migrate(drizzle(dst), { migrationsFolder: process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle") });

  for (const table of TABLES) {
    const [{ exists }] = await src`select to_regclass(${"public." + table}) is not null as exists`;
    if (!exists) {
      console.log(`  ${table}: not in source, skipped`);
      continue;
    }
    const [{ n }] = await src`select count(*)::int as n from ${src(table)}`;
    let copied = 0;
    // Stream with a cursor so large tables never sit in memory all at once.
    for await (const rows of src`select * from ${src(table)}`.cursor(BATCH)) {
      await withRetry(`${table} rows ${copied + 1}-${copied + rows.length}`, () =>
        dst`insert into ${dst(table)} ${dst(rows as Record<string, unknown>[])} on conflict do nothing`,
      );
      copied += rows.length;
      if (copied % 50_000 < BATCH) console.log(`  ${table}: ${copied.toLocaleString()} / ${n.toLocaleString()}`);
    }
    console.log(`  ${table}: ${copied.toLocaleString()} rows copied`);
  }

  await src.end();
  await dst.end();
  console.log(withRanks ? "\nDone." : "\nDone. Now point DATABASE_URL at the new database and re-import the rank lists (npm run import:ranks …).");
}

main().catch((e) => {
  const cause = (e as { cause?: { message?: string; code?: string } })?.cause;
  console.error(`Copy failed: ${e instanceof Error ? e.message : e}`);
  if (cause) console.error(`Reason: ${cause.message ?? ""} ${cause.code ? `(${cause.code})` : ""}`.trim());
  process.exit(1);
});
