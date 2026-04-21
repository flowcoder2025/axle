/**
 * WI-202 — GET /api/business-plans/[jobId]
 *
 * Returns AiJob status + pipeline output for polling clients.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) return forbiddenResponse("No active organization");

    const { jobId } = await ctx.params;

    const job = await prisma.aiJob.findFirst({
      where: {
        id: jobId,
        orgId: user.orgId,
        type: "BUSINESS_PLAN",
      },
      select: {
        id: true,
        status: true,
        output: true,
        errorMessage: true,
        durationMs: true,
        createdAt: true,
      },
    });

    if (!job) return notFoundResponse("BusinessPlanJob");

    return NextResponse.json({
      data: {
        jobId: job.id,
        status: job.status,
        output: job.output,
        errorMessage: job.errorMessage,
        durationMs: job.durationMs,
        createdAt: job.createdAt,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
