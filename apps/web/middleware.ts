import { authMiddleware } from "@axle/auth";
import type { NextMiddleware } from "next/server";

export const middleware: NextMiddleware = authMiddleware as NextMiddleware;

/**
 * Next.js requires `config` to be a static literal — cannot be imported.
 * Must be defined inline here so Next.js can statically analyze it.
 */
export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)).*)",
  ],
};
