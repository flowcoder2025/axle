import { NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { syncCalendar } from "@/lib/services/google-calendar";
import { getDecryptedTokens } from "@/lib/services/oauth-tokens";
import { unauthorizedResponse, handleInternalError } from "@/lib/api-helpers";

// POST /api/google-calendar/sync — trigger manual bidirectional sync
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const tokens = await getDecryptedTokens(user.id, "GOOGLE");
    if (!tokens) {
      return NextResponse.json(
        { error: { code: "NOT_CONNECTED", message: "Google Calendar is not connected. Please connect first." } },
        { status: 400 }
      );
    }

    const result = await syncCalendar(user.orgId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? "",
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleInternalError(err);
  }
}
