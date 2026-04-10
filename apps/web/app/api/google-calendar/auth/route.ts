import { NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { getAuthUrl } from "@/lib/services/google-calendar";
import { unauthorizedResponse, handleInternalError } from "@/lib/api-helpers";

// GET /api/google-calendar/auth — redirect to Google OAuth consent screen
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    return handleInternalError(err);
  }
}
