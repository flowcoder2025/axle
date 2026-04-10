import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { checklistItemUpdateSchema } from "@/lib/validations/checklist-item";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string; itemId: string }> };

/**
 * Resolves a ChecklistItem, enforcing org boundary via project.client.orgId.
 */
async function resolveItem(
  projectId: string,
  itemId: string,
  orgId: string,
): Promise<
  | { ok: true; item: NonNullable<Awaited<ReturnType<typeof prisma.checklistItem.findFirst>>> }
  | { ok: false; response: NextResponse }
> {
  // Verify project belongs to org
  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId } },
    select: { id: true },
  });

  if (!project) {
    return { ok: false, response: notFoundResponse("Project") };
  }

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, projectId },
  });

  if (!item) {
    return { ok: false, response: notFoundResponse("ChecklistItem") };
  }

  return { ok: true, item };
}

/**
 * PATCH /api/projects/[projectId]/checklist/[itemId]
 * Updates status, links documentId, or edits name/description/isRequired.
 *
 * When status transitions to VERIFIED, sets no extra timestamps here —
 * the upload flow (via /api/upload/[token]) already handles REQUESTED→UPLOADED.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId, itemId } = await params;
    const result = await resolveItem(projectId, itemId, user.orgId);
    if (!result.ok) return result.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = checklistItemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { status, ...rest } = parsed.data;

    // Build timestamp updates based on status transition
    const statusData: Record<string, unknown> = {};
    if (status === "REQUESTED" && result.item.status === "PENDING") {
      statusData.requestedAt = new Date();
    }
    if (status === "UPLOADED" && !result.item.uploadedAt) {
      statusData.uploadedAt = new Date();
    }

    const updated = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...rest,
        ...(status !== undefined ? { status } : {}),
        ...statusData,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * DELETE /api/projects/[projectId]/checklist/[itemId]
 * Hard-deletes the checklist item.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId, itemId } = await params;
    const result = await resolveItem(projectId, itemId, user.orgId);
    if (!result.ok) return result.response;

    await prisma.checklistItem.delete({ where: { id: itemId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleInternalError(error);
  }
}
