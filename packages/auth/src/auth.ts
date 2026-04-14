/**
 * auth.ts — Node.js runtime Auth.js v5 configuration
 *
 * Uses Prisma adapter with Google OAuth + Credentials (email/password).
 * NOT safe for Edge runtime — import auth.config.ts there instead.
 */
import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
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
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user?.password) return null;

        const bcrypt = await import("bcryptjs");
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * signIn callback — blocks inactive users from signing in.
     * Runs for both OAuth and Credentials providers.
     */
    async signIn({ user }) {
      if (!user?.id) return true;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true },
      });
      if (dbUser && !dbUser.isActive) return false;
      return true;
    },

    /**
     * jwt callback — extends Edge jwt with orgId from DB.
     * Runs after authConfig.callbacks.jwt, so userId is already set.
     */
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.userId = user.id;
      }

      // On sign-in, fetch orgId and platformRole from DB
      if (account && token.userId) {
        const [membership, dbUser] = await Promise.all([
          prisma.membership.findFirst({
            where: { userId: token.userId as string },
            select: { organizationId: true },
          }),
          prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { platformRole: true },
          }),
        ]);
        token.orgId = membership?.organizationId ?? null;
        token.platformRole = dbUser?.platformRole ?? "USER";
      }

      return token;
    },

    /**
     * session callback — surfaces userId, orgId, and platformRole to the client session.
     */
    session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        (session.user as typeof session.user & { orgId: string | null; platformRole: string }).orgId =
          (token.orgId as string | null) ?? null;
        (session.user as typeof session.user & { orgId: string | null; platformRole: string }).platformRole =
          (token.platformRole as string) ?? "USER";
      }
      return session;
    },
  },
});

export const auth: typeof nextAuth.auth = nextAuth.auth;
export const signIn: typeof nextAuth.signIn = nextAuth.signIn;
export const signOut: typeof nextAuth.signOut = nextAuth.signOut;
export const handlers: typeof nextAuth.handlers = nextAuth.handlers;
