import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/[projectId]/research — start a research task
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { projectId } = await ctx.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      select: { id: true, type: true, metadata: true, clientId: true },
    });

    if (!project) {
      return notFoundResponse("Project");
    }

    if (project.type !== "RESEARCH_TASK") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PROJECT_TYPE",
            message: "Research tasks can only be started on RESEARCH_TASK projects",
          },
        },
        { status: 400 }
      );
    }

    const metadata = (project.metadata ?? {}) as Record<string, unknown>;
    const investigationItems = (metadata.investigationItems ?? []) as Array<{
      topic: string;
      description?: string;
      priority?: "HIGH" | "MEDIUM" | "LOW";
    }>;

    const clientContext = (metadata.clientContext ?? null) as unknown;

    const aiJob = await prisma.aiJob.create({
      data: {
        projectId: project.id,
        type: "RESEARCH",
        tier: "CLI_CLAUDE",
        status: "QUEUED",
        input: {
          investigationItems,
          clientContext,
        },
      },
      select: { id: true, status: true },
    });

    return NextResponse.json(
      { data: { aiJobId: aiJob.id, status: aiJob.status } },
      { status: 201 }
    );
  } catch (err) {
    return handleInternalError(err);
  }
}

// GET /api/projects/[projectId]/research — get latest research results
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { projectId } = await ctx.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      select: { id: true },
    });

    if (!project) {
      return notFoundResponse("Project");
    }

    const aiJob = await prisma.aiJob.findFirst({
      where: { projectId: project.id, type: "RESEARCH" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        output: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!aiJob) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No research job found for this project" } },
        { status: 404 }
      );
    }

    const output = (aiJob.output ?? {}) as Record<string, unknown>;
    const reportDocumentId = (output.reportDocumentId ?? null) as string | null;

    return NextResponse.json({
      data: {
        aiJobId: aiJob.id,
        status: aiJob.status,
        output: aiJob.output,
        reportDocumentId,
        createdAt: aiJob.createdAt,
        updatedAt: aiJob.updatedAt,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
