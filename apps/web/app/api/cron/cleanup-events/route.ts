import { NextRequest, NextResponse } from "next/server";
import { cleanupOldEvents } from "@/lib/analytics/aggregator";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 },
    );
  }

  try {
    const deleted = await cleanupOldEvents(90);
    return NextResponse.json({
      data: {
        message: "Cleanup complete",
        eventsDeleted: deleted,
      },
    });
  } catch (err) {
    console.error("[cron] cleanup-events failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Cleanup failed" } },
      { status: 500 },
    );
  }
}
