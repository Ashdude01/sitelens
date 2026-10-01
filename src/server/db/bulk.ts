// Helpers for bulk imports over a remote database (Neon).
//
// A single transaction holding one connection for minutes is fragile over the internet: one dropped
// socket (Wi-Fi hiccup, laptop sleep, pooler recycling the connection) throws away the whole import.
// Instead, each batch is its own short statement and is retried on connection errors. Batches use
// ON CONFLICT upserts, so retrying a batch that may already have been written is safe.

const TRANSIENT_CODES = new Set([
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECT_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01", // admin_shutdown (e.g. Neon compute restarted)
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
]);

function errorCode(e: unknown): string {
  const err = e as { code?: unknown; cause?: { code?: unknown } } | null;
  return String(err?.code ?? err?.cause?.code ?? "");
}

export function isTransientDbError(e: unknown): boolean {
  const code = errorCode(e);
  // 08xxx = Postgres "connection exception" class.
  return TRANSIENT_CODES.has(code) || code.startsWith("08");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn`, retrying up to `attempts` times on connection errors with exponential backoff (1s, 2s, 4s…). */
export async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isTransientDbError(e)) throw e;
      const wait = Math.min(30_000, 1000 * 2 ** (i - 1));
      console.warn(`  ${label}: ${errorCode(e) || "connection error"}, retrying in ${wait / 1000}s (attempt ${i + 1}/${attempts})`);
      await sleep(wait);
    }
  }
}
