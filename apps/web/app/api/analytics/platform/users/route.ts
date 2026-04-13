import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { getDailyTrends } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10) || 30, 90);

    const trends = await getDailyTrends(days);

    return NextResponse.json({ data: { trends } });
  } catch (err) {
    return handleInternalError(err);
  }
}
