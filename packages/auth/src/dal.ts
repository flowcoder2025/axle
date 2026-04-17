/**
 * dal.ts — Data Access Layer for authentication
 *
 * Provides React cache-wrapped helpers that components/server actions can call
 * without worrying about session fetching or redirect logic.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth.js";

type AuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  orgId?: string | null;
  platformRole?: string | null;
};

type CachedDbUser = { isActive: boolean; platformRole: string | null };

// Process-local TTL cache for the DB lookup portion of getCurrentUser.
// Keyed by userId. Short TTL bounds the window during which a suspended
// (isActive=false) user could still pass auth.
const USER_CACHE_TTL_MS = Number(process.env.AUTH_USER_CACHE_TTL_MS ?? 10_000);
const userCache = new Map<string, { value: CachedDbUser; expiresAt: number }>();

async function fetchDbUser(userId: string): Promise<CachedDbUser | null> {
  const cached = userCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const { prisma } = await import("@axle/db");
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, platformRole: true },
  });
  if (!dbUser) {
    userCache.delete(userId);
    return null;
  }
  const value: CachedDbUser = {
    isActive: dbUser.isActive,
    platformRole: dbUser.platformRole as string | null,
  };
  userCache.set(userId, { value, expiresAt: now + USER_CACHE_TTL_MS });
  return value;
}

/** Invalidate cached DB state for a user (call after role/activation changes). */
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

/**
 * getCurrentUser — React cache-wrapped session fetch.
 * Re-validates isActive on every request (with a short process-local TTL
 * to avoid a DB hit on every Server Component render).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const dbUser = await fetchDbUser(session.user.id);
  if (!dbUser?.isActive) return null;

  const user = session.user as AuthUser;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    orgId: user.orgId ?? null,
    platformRole: dbUser.platformRole as string,
  };
});

/**
 * requireUser — throws a redirect to /login if not authenticated.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * requireOrg — throws a redirect to /login if user has no active org,
 * or /suspended if the org is suspended.
 */
export async function requireOrg(): Promise<AuthUser & { orgId: string }> {
  const user = await requireUser();
  if (!user.orgId) {
    redirect("/login");
  }

  const { prisma } = await import("@axle/db");
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { isSuspended: true },
  });
  if (org?.isSuspended) {
    redirect("/suspended");
  }

  return user as AuthUser & { orgId: string };
}

/**
 * requirePlatformAdmin — throws Error("FORBIDDEN") if not PLATFORM_ADMIN.
 * Use in API routes. Catch the error and return forbiddenResponse().
 */
export async function requirePlatformAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.platformRole !== "PLATFORM_ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/**
 * requireOrgAdmin — returns user if OWNER or ADMIN of current org.
 * Requires DB lookup for membership role.
 */
export async function requireOrgAdmin(): Promise<AuthUser & { orgId: string }> {
  const user = await requireOrg();
  const { prisma } = await import("@axle/db");
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: user.orgId },
    select: { role: true },
  });
  if (!membership || membership.role === "MEMBER") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
