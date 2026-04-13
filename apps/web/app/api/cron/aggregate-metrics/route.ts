import { NextRequest, NextResponse } from "next/server";
import { aggregateYesterday } from "@/lib/analytics/aggregator";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 },
    );
  }

  try {
    const result = await aggregateYesterday();
    return NextResponse.json({
      data: {
        message: "Aggregation complete",
        orgsProcessed: result.orgs,
        actionMetrics: result.actions,
      },
    });
  } catch (err) {
    console.error("[cron] aggregate-metrics failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Aggregation failed" } },
      { status: 500 },
    );
  }
}
