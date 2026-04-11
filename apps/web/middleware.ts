import NextAuth from "next-auth";
import { authConfig } from "@axle/auth/edge";

const { auth } = NextAuth(authConfig);
export const middleware = auth;

/**
 * Next.js requires `config` to be a static literal — cannot be imported.
 * Must be defined inline here so Next.js can statically analyze it.
 */
export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)).*)",
  ],
};
