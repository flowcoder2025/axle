import { NextRequest, NextResponse } from "next/server";
import { cleanupOldEvents } from "@/lib/analytics/aggregator";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
