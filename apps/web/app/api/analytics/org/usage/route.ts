import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@axle/auth";
import { getTopActions } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requireOrgAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10) || 30, 90);

    const actions = await getTopActions(days, 20, user.orgId);

    return NextResponse.json({ data: { actions } });
  } catch (err) {
    return handleInternalError(err);
  }
}
