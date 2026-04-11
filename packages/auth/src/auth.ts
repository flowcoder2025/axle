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
import bcrypt from "bcryptjs";
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
