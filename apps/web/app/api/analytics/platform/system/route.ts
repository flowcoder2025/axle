import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const metrics = await prisma.dailyMetric.findMany({
      where: { date: { gte: since }, orgId: null },
      orderBy: { date: "asc" },
      select: {
        date: true,
        apiCalls: true,
        apiErrors: true,
        avgResponseMs: true,
        automationRuns: true,
        automationFailures: true,
      },
    });

    const totals = metrics.reduce(
      (acc, m) => ({
        apiCalls: acc.apiCalls + m.apiCalls,
        apiErrors: acc.apiErrors + m.apiErrors,
        automationRuns: acc.automationRuns + m.automationRuns,
        automationFailures: acc.automationFailures + m.automationFailures,
      }),
      { apiCalls: 0, apiErrors: 0, automationRuns: 0, automationFailures: 0 },
    );

    return NextResponse.json({
      data: {
        totals,
        errorRate:
          totals.apiCalls > 0
            ? (totals.apiErrors / totals.apiCalls) * 100
            : 0,
        daily: metrics.map((m) => ({
          date: m.date.toISOString().split("T")[0],
          apiCalls: m.apiCalls,
          apiErrors: m.apiErrors,
          avgResponseMs: m.avgResponseMs,
          automationRuns: m.automationRuns,
          automationFailures: m.automationFailures,
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
