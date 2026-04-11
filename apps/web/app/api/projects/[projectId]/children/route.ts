import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/[projectId]/children — list child projects of a bundle
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

    // Verify the parent project exists and belongs to the user's org
    const parent = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      select: { id: true, type: true },
    });

    if (!parent) {
      return notFoundResponse("Project");
    }

    const children = await prisma.project.findMany({
      where: { parentId: projectId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        clientId: true,
        parentId: true,
        type: true,
        title: true,
        status: true,
        priority: true,
        assignedToId: true,
        assignedToUser: { select: { id: true, name: true, email: true } },
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            checklist: true,
            documents: true,
          },
        },
      },
    });

    return NextResponse.json({ data: children });
  } catch (err) {
    return handleInternalError(err);
  }
}
