import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { getTopActions } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10) || 30, 90);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);

    const actions = await getTopActions(days, limit);

    return NextResponse.json({ data: { actions } });
  } catch (err) {
    return handleInternalError(err);
  }
}
