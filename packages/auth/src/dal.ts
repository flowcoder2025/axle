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
};

/**
 * getCurrentUser — React cache-wrapped session fetch.
 *
 * Safe to call multiple times in one render; only hits auth() once per request.
 * Returns the session user or null if unauthenticated.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    orgId: (session.user as AuthUser).orgId ?? null,
  };
});

/**
 * requireUser — throws a redirect to /login if not authenticated.
 *
 * Use in Server Components / Server Actions that require auth.
 * Next.js redirect() throws internally, so calling code need not check the return.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * requireOrg — throws a redirect to /login if user has no active org.
 *
 * Use in org-scoped Server Components / Server Actions.
 */
export async function requireOrg(): Promise<AuthUser & { orgId: string }> {
  const user = await requireUser();
  if (!user.orgId) {
    redirect("/login");
  }
  return user as AuthUser & { orgId: string };
}
