/**
 * auth.ts — Node.js runtime Auth.js v5 configuration
 *
 * Uses Prisma adapter and Google OAuth only.
 * NOT safe for Edge runtime — import auth.config.ts there instead.
 *
 * NOTE: Credentials provider is intentionally omitted in Phase 0.
 * The User model has no password field yet. Add it in a later phase.
 */
import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@axle/db";
import { authConfig } from "./auth.config.js";

const nextAuth: NextAuthResult = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * jwt callback — extends Edge jwt with orgId from DB.
     * Runs after authConfig.callbacks.jwt, so userId is already set.
     */
    async jwt({ token, user, account }) {
      // Call base callback first
      if (user?.id) {
        token.userId = user.id;
      }

      // On sign-in, fetch orgId from DB
      if (account && token.userId) {
        const membership = await prisma.membership.findFirst({
          where: { userId: token.userId as string },
          select: { organizationId: true },
        });
        token.orgId = membership?.organizationId ?? null;
      }

      return token;
    },

    /**
     * session callback — surfaces userId and orgId to the client session.
     */
    session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        (session.user as typeof session.user & { orgId: string | null }).orgId =
          (token.orgId as string | null) ?? null;
      }
      return session;
    },
  },
});

export const auth: typeof nextAuth.auth = nextAuth.auth;
export const signIn: typeof nextAuth.signIn = nextAuth.signIn;
export const signOut: typeof nextAuth.signOut = nextAuth.signOut;
export const handlers: typeof nextAuth.handlers = nextAuth.handlers;
