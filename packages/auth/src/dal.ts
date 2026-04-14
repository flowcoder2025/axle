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

/**
 * getCurrentUser — React cache-wrapped session fetch.
 * Re-validates isActive on every request to enforce suspension immediately.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { prisma } = await import("@axle/db");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!dbUser?.isActive) return null;

  const user = session.user as AuthUser;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    orgId: user.orgId ?? null,
    platformRole: user.platformRole ?? "USER",
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
