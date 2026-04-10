/**
 * session-cache.ts — 3-tier session cache
 *
 * Tier 1: React cache (per-request, in-memory)
 * Tier 2: Upstash Redis (cross-request, shared)
 * Tier 3: Prisma DB (source of truth)
 *
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in env.
 */
import { cache } from "react";
import { Redis } from "@upstash/redis";
import { prisma } from "@axle/db";

const REDIS_TTL_SECONDS = 60 * 5; // 5 minutes
const CACHE_KEY_PREFIX = "axle:session:";

type CachedSession = {
  userId: string;
  orgId: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
};

/**
 * Build a Redis client from env vars, or null if unconfigured.
 * This allows graceful degradation when Redis is not available (e.g., local dev).
 */
function buildRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = buildRedis();

/**
 * fetchSessionFromDb — fetches session data from Prisma (Tier 3 fallback).
 */
async function fetchSessionFromDb(
  userId: string,
): Promise<CachedSession | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, image: true },
  });

  if (!user) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId },
    select: { organizationId: true },
  });

  return {
    userId: user.id,
    orgId: membership?.organizationId ?? null,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}

/**
 * getCachedSessionInner — Redis-aware session fetch (no React cache wrapping here).
 */
async function getCachedSessionInner(
  userId: string,
): Promise<CachedSession | null> {
  if (!userId) return null;

  const key = `${CACHE_KEY_PREFIX}${userId}`;

  // Tier 2: Redis
  if (redis) {
    const cached = await redis.get<CachedSession>(key);
    if (cached) return cached;
  }

  // Tier 3: DB
  const session = await fetchSessionFromDb(userId);
  if (!session) return null;

  // Populate Redis for next request
  if (redis) {
    await redis.set(key, session, { ex: REDIS_TTL_SECONDS });
  }

  return session;
}

/**
 * getCachedSession — Tier 1 (React cache) wrapping Tier 2+3.
 *
 * Safe to call multiple times per request; React cache deduplicates.
 */
export const getCachedSession = cache(
  async (userId: string): Promise<CachedSession | null> => {
    return getCachedSessionInner(userId);
  },
);

/**
 * invalidateCachedSession — removes the Redis entry for a user.
 *
 * Call this on sign-out or when user/org data changes.
 */
export async function invalidateCachedSession(userId: string): Promise<void> {
  if (!redis || !userId) return;
  await redis.del(`${CACHE_KEY_PREFIX}${userId}`);
}
