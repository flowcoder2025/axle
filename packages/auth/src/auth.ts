/**
 * auth.ts — Node.js runtime Auth.js v5 configuration
 *
 * Uses Prisma adapter and full provider set.
 * NOT safe for Edge runtime — import auth.config.ts there instead.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@axle/db";
import { authConfig } from "./auth.config.js";

export const { auth, signIn, signOut, handlers } = NextAuth({
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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        // Password verification should use bcrypt in production.
        // The actual password field name depends on your Prisma schema.
        // Returning user here — add hash comparison once schema confirms field name.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
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
