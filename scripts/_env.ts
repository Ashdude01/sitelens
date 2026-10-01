// Load .env for CLI scripts (Next.js does this itself for the web app). Import this first.
import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

// Long-running jobs (imports, calibrate) should not go through Neon's connection pooler (PgBouncer).
// The pooled host is ideal for the web app's many short queries, but it can drop a connection that
// stays busy for minutes. Neon's direct host is the same name without "-pooler".
// Override with DATABASE_URL_UNPOOLED (the name Neon's Vercel integration uses), or keep the pooler
// with SCRIPTS_USE_POOLER=1.
{
  const url = process.env.DATABASE_URL?.trim() ?? "";
  const unpooled = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (process.env.SCRIPTS_USE_POOLER !== "1" && /^postgres(ql)?:\/\//.test(url)) {
    if (unpooled) {
      process.env.DATABASE_URL = unpooled;
    } else {
      try {
        const u = new URL(url);
        if (u.hostname.endsWith(".neon.tech") && u.hostname.includes("-pooler.")) {
          u.hostname = u.hostname.replace("-pooler.", ".");
          process.env.DATABASE_URL = u.toString();
          console.log(`Using Neon's direct connection (${u.hostname}) for this script.`);
        }
      } catch {
        // Not a parseable URL: leave it for config.ts to report.
      }
    }
  }
}
