// Sliding-window limiter. In-memory is fine for a single server; swap the implementation
// for Redis/Upstash when you run more than one instance (the interface stays the same).
export interface RateLimiter {
  /** Returns true and records a hit if under the limit. */
  take(key: string): boolean;
}

export function createMemoryLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, list] of hits) if (!list.some((t) => now - t < windowMs)) hits.delete(k);
  }, 10 * 60_000);
  sweep.unref?.();

  return {
    take(key) {
      const now = Date.now();
      const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (list.length >= limit) {
        hits.set(key, list);
        return false;
      }
      list.push(now);
      hits.set(key, list);
      return true;
    },
  };
}
