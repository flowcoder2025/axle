/**
 * WI-202 — POST /api/business-plans
 *
 * Kicks off the full business-plan pipeline (RAG draft → Precision DOCX →
 * Verification → Supabase upload → Document row). The endpoint returns
 * immediately with the AiJob id; progress is polled via GET
 * /api/business-plans/[jobId].
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import type { Prisma } from "@prisma/client";
import { businessPlanCreateSchema } from "@/lib/validations/business-plan";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";
import { runBusinessPlanPipeline } from "@/lib/services/business-plan-pipeline";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return forbiddenResponse("No active organization");
    }

    const body = await req.json();
    const parsed = businessPlanCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { projectId, programId, sections, engine } = parsed.data;

    // Verify the project belongs to the caller's org and resolve context.
    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      select: {
        id: true,
        clientId: true,
        programId: true,
        assignedToId: true,
        client: { select: { orgId: true } },
      },
    });
    if (!project) return notFoundResponse("Project");

    const resolvedProgramId = programId ?? project.programId ?? undefined;
    if (!resolvedProgramId) {
      return NextResponse.json(
        {
          error: {
            code: "PROGRAM_ID_REQUIRED",
            message:
              "programId is required when the project is not linked to a program",
          },
        },
        { status: 400 }
      );
    }

    // Create AiJob in QUEUED state. Input preserves enough to re-run / audit.
    const jobInput = {
      projectId,
      clientId: project.clientId,
      programId: resolvedProgramId,
      sections,
      engine,
    } satisfies Prisma.InputJsonValue;

    const job = await prisma.aiJob.create({
      data: {
        orgId: user.orgId,
        projectId,
        type: "BUSINESS_PLAN",
        tier: "CLI_CLAUDE",
        status: "QUEUED",
        input: jobInput,
      },
      select: { id: true, status: true },
    });

    // Fire-and-forget pipeline — all terminal states are persisted by
    // runBusinessPlanPipeline itself.
    void runBusinessPlanPipeline({
      jobId: job.id,
      projectId,
      clientId: project.clientId,
      orgId: user.orgId,
      programId: resolvedProgramId,
      assigneeId: project.assignedToId ?? user.id,
      sections,
      engine,
    });

    return NextResponse.json(
      { data: { jobId: job.id, status: job.status } },
      { status: 201 }
    );
  } catch (err) {
    return handleInternalError(err);
  }
}
