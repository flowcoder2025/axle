import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@axle/auth";
import { getTodayOverview, getDailyTrends } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requireOrgAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const [today, trends7d] = await Promise.all([
      getTodayOverview(user.orgId),
      getDailyTrends(7, user.orgId),
    ]);

    return NextResponse.json({
      data: { today, trends7d },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
