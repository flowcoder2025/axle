/**
 * auth.config.ts — Edge-compatible Auth.js v5 configuration
 *
 * IMPORTANT: This file must NOT import Prisma or any Node.js-only modules.
 * It is used in Edge middleware (auth.ts also imports it).
 */
import type { NextAuthConfig } from "next-auth";

/** Routes that require authentication */
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/org", "/api/protected"];

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    /**
     * jwt callback — runs on every token creation/refresh.
     * Adds `userId` to the JWT payload from the User object (available on sign-in).
     */
    jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },

    /**
     * authorized callback — used by middleware to guard routes.
     * Returns true to allow, false/redirect to deny.
     */
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
      );
      if (!isProtected) return true;
      return !!auth?.user;
    },
  },
  providers: [],
};
