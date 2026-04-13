import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextMiddleware, NextRequest } from "next/server";
import { authConfig } from "@axle/auth/edge";

const { auth } = NextAuth(authConfig);

/** Paths that should NOT get a sessionId cookie */
const SKIP_SESSION_PREFIXES = ["/api/", "/_next/", "/favicon.ico"];
const SKIP_SESSION_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".css", ".js", ".woff2", ".woff", ".ttf", ".eot"];

function shouldSkipSession(pathname: string): boolean {
  if (SKIP_SESSION_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (SKIP_SESSION_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true;
  return false;
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

const authMiddleware = auth as NextMiddleware;

export const middleware: NextMiddleware = async (request: NextRequest) => {
  const response = await (authMiddleware as (req: NextRequest) => Promise<NextResponse | Response | undefined>)(request);
  const res = response ?? NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (!shouldSkipSession(pathname)) {
    const existingSession = request.cookies.get("axle_sid");
    if (!existingSession) {
      const sid = generateSessionId();
      (res as NextResponse).cookies.set("axle_sid", sid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 60,
        path: "/",
      });
    }
  }

  return res;
};

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)).*)",
  ],
};
