import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { projectUpdateSchema } from "@/lib/validations/project";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { resolveProject } from "@/lib/utils/resolve-project";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/[projectId]
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
      include: {
        client: { select: { id: true, name: true } },
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
          },
        },
        _count: {
          select: {
            checklist: true,
            documents: true,
          },
        },
      },
    });

    if (!project) {
      return notFoundResponse("Project");
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/projects/[projectId]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
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
    const resolved = await resolveProject(projectId, user.orgId);
    if (!resolved.ok) return resolved.response;

    const body = await req.json();
    const parsed = projectUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { dueDate, feeAmount, successRate, metadata, ...rest } = parsed.data;

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        ...(feeAmount !== undefined ? { feeAmount: feeAmount !== null ? feeAmount : null } : {}),
        ...(successRate !== undefined ? { successRate: successRate !== null ? successRate : null } : {}),
        ...(metadata !== undefined
          ? {
              metadata:
                metadata != null
                  ? (metadata as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
      },
    });

    return NextResponse.json({ data: project });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/projects/[projectId] — hard delete (cascades checklist items via Prisma schema)
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
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
    const resolved = await resolveProject(projectId, user.orgId);
    if (!resolved.ok) return resolved.response;

    await prisma.project.delete({ where: { id: projectId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
