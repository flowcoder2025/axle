import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { exchangeCode } from "@/lib/services/google-calendar";
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
      return NextResponse.json(
        { error: { code: "OAUTH_DENIED", message: `Google OAuth error: ${error}` } },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: { code: "MISSING_CODE", message: "Missing authorization code" } },
        { status: 400 }
      );
    }

    const tokens = await exchangeCode(code);

    // Tokens are returned to the client for secure storage (e.g., encrypted cookie or user settings).
    // In production, store tokens encrypted in the database tied to user.id / orgId.
    return NextResponse.json({
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: "Google Calendar connected successfully",
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
