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
        aiJobsTotal: true,
        aiJobsCost: true,
        aiAvgDurationMs: true,
      },
    });

    const totals = metrics.reduce(
      (acc, m) => ({
        aiJobsTotal: acc.aiJobsTotal + m.aiJobsTotal,
        aiJobsCost: acc.aiJobsCost + m.aiJobsCost,
      }),
      { aiJobsTotal: 0, aiJobsCost: 0 },
    );

    return NextResponse.json({
      data: {
        totals,
        avgCostPerJob:
          totals.aiJobsTotal > 0
            ? totals.aiJobsCost / totals.aiJobsTotal
            : 0,
        daily: metrics.map((m) => ({
          date: m.date.toISOString().split("T")[0],
          jobs: m.aiJobsTotal,
          cost: m.aiJobsCost,
          avgDurationMs: m.aiAvgDurationMs,
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
