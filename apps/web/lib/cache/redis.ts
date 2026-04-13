import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

/**
 * Cache-aside helper. Returns cached value or fetches + caches.
 * Gracefully degrades to direct fetch if Redis is unavailable.
 */
export async function cacheGet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const r = getRedis();
  if (!r) return fetcher();

  try {
    const cached = await r.get<T>(`axle:cache:${key}`);
    if (cached !== null && cached !== undefined) return cached;
  } catch {
    // Redis error — fall through to fetcher
  }

  const value = await fetcher();

  try {
    await r.set(`axle:cache:${key}`, value, { ex: ttlSeconds });
  } catch {
    // Ignore cache write failure
  }

  return value;
}

export async function cacheInvalidate(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(`axle:cache:${key}`);
  } catch {
    // Ignore
  }
}

/**
 * Invalidate all cache keys matching a prefix using SCAN + DEL.
 * Safe for moderate key counts. For very large datasets, consider a versioning strategy.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const fullPrefix = `axle:cache:${prefix}*`;
    let done = false;
    let scanCursor = 0;
    while (!done) {
      const scanResult: [string, string[]] = (await r.scan(scanCursor, {
        match: fullPrefix,
        count: 100,
      })) as [string, string[]];
      const keys = scanResult[1];
      if (keys.length > 0) {
        await r.del(...keys);
      }
      const next = Number(scanResult[0]);
      if (next === 0 || Number.isNaN(next)) {
        done = true;
      } else {
        scanCursor = next;
      }
    }
  } catch {
    // Ignore
  }
}
