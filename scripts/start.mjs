// Production start (works on Windows, macOS and Linux).
// The standalone server changes its working directory to .next/standalone, so we pin the data folder
// (database, fingerprints, calibration) to ./data *before* it starts. Otherwise a rebuild would wipe the DB.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

for (const file of [".env.local", ".env"]) if (fs.existsSync(file)) process.loadEnvFile(file);
process.env.DATA_DIR ??= path.resolve("data");
process.env.MIGRATIONS_DIR ??= path.resolve("drizzle");
process.env.PORT ??= "3000";

const server = path.resolve(".next/standalone/server.js");
if (!fs.existsSync(server)) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}
await import(pathToFileURL(server).href);
