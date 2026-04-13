/**
 * Rate limiter for the analytics track endpoint.
 * Uses Upstash Redis sliding window: 100 requests per minute per sessionId.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

export function getAnalyticsRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("[analytics] Upstash Redis not configured — rate limiting disabled");
    return null;
  }

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "analytics:",
  });

  return ratelimit;
}
