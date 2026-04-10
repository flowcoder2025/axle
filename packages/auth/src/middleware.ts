/**
 * middleware.ts — Edge-compatible middleware helper
 *
 * Re-exports NextAuth middleware configured with the Edge-safe authConfig.
 * Import this from apps/web/middleware.ts.
 *
 * Usage in apps/web/middleware.ts:
 *   export { auth as middleware, config } from "@axle/auth/middleware";
 */
import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";
import { authConfig } from "./auth.config.js";

const nextAuth: NextAuthResult = NextAuth(authConfig);
export const auth: typeof nextAuth.auth = nextAuth.auth;

/**
 * Next.js middleware matcher config.
 * Excludes: /login, /api/auth/*, _next static files, and public assets.
 */
export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)).*)",
  ],
};
