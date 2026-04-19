/**
 * auth.config.ts — Edge-compatible Auth.js v5 configuration
 *
 * IMPORTANT: This file must NOT import Prisma or any Node.js-only modules.
 * It is used in Edge middleware (auth.ts also imports it).
 */
import type { NextAuthConfig } from "next-auth";

/** Routes that require authentication */
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/org", "/api/protected", "/platform-admin", "/api/admin"];

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    /**
     * jwt callback (edge) — runs on every token creation/refresh.
     * Adds `userId` to the JWT payload from the User object (available on sign-in).
     * Note: `platformRole` and `orgId` are populated by the node-runtime jwt callback
     * in `auth.ts` at sign-in time and persist on the token across requests.
     */
    jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },

    /**
     * session callback (edge) — exposes token.platformRole/orgId on auth.user
     * so middleware's authorized() can enforce role-based access.
     * The node-runtime session callback in auth.ts does the same for page/API consumers.
     */
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.userId as string) ?? session.user.id;
        (session.user as typeof session.user & { orgId: string | null; platformRole: string }).orgId =
          (token.orgId as string | null) ?? null;
        (session.user as typeof session.user & { orgId: string | null; platformRole: string }).platformRole =
          (token.platformRole as string) ?? "USER";
      }
      return session;
    },

    /**
     * authorized callback — used by middleware to guard routes.
     * Returns true to allow, false/redirect to deny.
     * Also enforces PLATFORM_ADMIN role for admin routes.
     */
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
      );
      if (!isProtected) return true;
      if (!auth?.user) return false;

      const isAdminRoute = pathname.startsWith("/platform-admin") || pathname.startsWith("/api/admin");
      if (isAdminRoute) {
        const role = (auth.user as { platformRole?: string }).platformRole;
        if (role !== "PLATFORM_ADMIN") {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
      }

      return true;
    },
  },
  providers: [],
};
