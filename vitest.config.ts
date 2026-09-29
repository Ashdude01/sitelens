import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const tmpDb = path.join(os.tmpdir(), `sitelens-test-${process.pid}.db`);

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // tests share fixture ports and a database
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: `file:${tmpDb}`,
      ALLOW_PRIVATE_NETWORK: "1",
      RDAP_ENABLED: "0",
      FETCH_TIMEOUT_MS: "5000",
      FRESH_SCANS_PER_HOUR: "1000",
      PAGESPEED_API_BASE: "http://127.0.0.6:8080/runPagespeed",
      PUBLIC_URL: "https://sitelens.test",
    },
  },
});
