import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { exchangeCode } from "@/lib/services/google-calendar";
import { encrypt } from "@/lib/crypto";
import { unauthorizedResponse, handleInternalError } from "@/lib/api-helpers";

// GET /api/google-calendar/callback — handle Google OAuth callback and store tokens
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      const settingsUrl = new URL("/settings", req.url);
      settingsUrl.searchParams.set("gc_error", error);
      return NextResponse.redirect(settingsUrl);
    }

    if (!code) {
      const settingsUrl = new URL("/settings", req.url);
      settingsUrl.searchParams.set("gc_error", "missing_code");
      return NextResponse.redirect(settingsUrl);
    }

    const tokens = await exchangeCode(code);

    // Store encrypted tokens in the database
    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
      create: {
        userId: user.id,
        provider: "GOOGLE",
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        scope: "calendar",
      },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      },
    });

    const settingsUrl = new URL("/settings", req.url);
    settingsUrl.searchParams.set("gc_connected", "true");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    return handleInternalError(err);
  }
}
