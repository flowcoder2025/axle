import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/checklist
 *
 * Aggregates every ChecklistItem belonging to the client's projects.
 * Used by the "서류 요청" tab on the client detail page to show checklist
 * status across all projects in one place.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });

    if (!client) {
      return notFoundResponse("Client");
    }

    const items = await prisma.checklistItem.findMany({
      where: { project: { clientId } },
      orderBy: [{ status: "asc" }, { isRequired: "desc" }],
      select: {
        id: true,
        projectId: true,
        name: true,
        description: true,
        isRequired: true,
        itemType: true,
        status: true,
        requestedAt: true,
        uploadedAt: true,
        certificateType: true,
        project: { select: { id: true, title: true, type: true } },
      },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    return handleInternalError(error);
  }
}
