import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { getTodayOverview, getDailyTrends } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const [today, trends7d] = await Promise.all([
      getTodayOverview(),
      getDailyTrends(7),
    ]);

    return NextResponse.json({
      data: { today, trends7d },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
