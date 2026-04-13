import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { Prisma } from "@prisma/client";
import { aiJobStatusUpdateSchema } from "@/lib/validations/ai-job";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { eventBus } from "@/lib/events/event-bus";
import { extractAndStorePattern } from "@axle/ai";

type RouteContext = { params: Promise<{ jobId: string }> };

// GET /api/ai/jobs/[jobId] — single job with full output
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { jobId } = await ctx.params;

    const job = await prisma.aiJob.findFirst({
      where: {
        id: jobId,
        project: { client: { orgId: user.orgId } },
      },
      select: {
        id: true,
        projectId: true,
        type: true,
        tier: true,
        status: true,
        input: true,
        output: true,
        cost: true,
        durationMs: true,
        errorMessage: true,
        skillPatternId: true,
        createdAt: true,
      },
    });

    if (!job) return notFoundResponse("AiJob");

    return NextResponse.json({ data: job });
  } catch (err) {
    return handleInternalError(err);
  }
}

const VALID_JOB_TRANSITIONS: Record<string, string[]> = {
  QUEUED: ["RUNNING"],
  RUNNING: ["COMPLETED", "FAILED"],
  COMPLETED: [], // terminal
  FAILED: ["QUEUED"], // allow retry
};

// PATCH /api/ai/jobs/[jobId] — update job status (for agent-bridge webhook callbacks)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { jobId } = await ctx.params;

    // Verify the job belongs to user's org
    const existing = await prisma.aiJob.findFirst({
      where: {
        id: jobId,
        project: { client: { orgId: user.orgId } },
      },
      select: { id: true, status: true },
    });

    if (!existing) return notFoundResponse("AiJob");

    const body = await req.json();
    const parsed = aiJobStatusUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { status, output, errorMessage, durationMs } = parsed.data;

    // Validate status transition
    const allowedNext = VALID_JOB_TRANSITIONS[existing.status] ?? [];
    if (!allowedNext.includes(status)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition job from ${existing.status} to ${status}.`,
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status,
        ...(output !== undefined
          ? { output: output as Prisma.InputJsonValue }
          : {}),
        ...(errorMessage !== undefined ? { errorMessage } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
      },
      select: {
        id: true,
        type: true,
        status: true,
        input: true,
        output: true,
        errorMessage: true,
        durationMs: true,
      },
    });

    // Fire-and-forget: learn from completed jobs without blocking the response
    if (status === "COMPLETED") {
      void extractAndStorePattern({
        aiJobId: updated.id,
        type: updated.type,
        input: updated.input,
        output: updated.output,
        success: true,
      });
    }

    // Fire-and-forget: emit AI_JOB_COMPLETE or AI_JOB_FAILED for notification dispatch
    if (status === "COMPLETED" || status === "FAILED") {
      // Resolve assignee from the linked project
      const jobWithProject = await prisma.aiJob.findUnique({
        where: { id: jobId },
        select: { projectId: true, project: { select: { assignedToId: true } } },
      });
      const assigneeId = jobWithProject?.project?.assignedToId ?? user.id;

      if (status === "COMPLETED") {
        void eventBus
          .emit("AI_JOB_COMPLETE", {
            jobId: updated.id,
            jobType: updated.type,
            assigneeId,
          })
          .catch(console.error);
      } else {
        void eventBus
          .emit("AI_JOB_FAILED", {
            jobId: updated.id,
            jobType: updated.type,
            assigneeId,
            errorMessage: updated.errorMessage ?? "Unknown error",
          })
          .catch(console.error);
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
