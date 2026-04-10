import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { projectStatusTransitionSchema } from "@/lib/validations/project";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { canTransition } from "@/lib/services/project-state-machine";

type RouteContext = { params: Promise<{ projectId: string }> };

// PATCH /api/projects/[projectId]/status — transition project status
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

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      select: { id: true, status: true },
    });

    if (!project) {
      return notFoundResponse("Project");
    }

    const body = await req.json();
    const parsed = projectStatusTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { status: targetStatus } = parsed.data;

    if (!canTransition(project.status, targetStatus)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from ${project.status} to ${targetStatus}`,
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { status: targetStatus },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
