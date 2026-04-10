import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { actionItemUpdateSchema } from "@/lib/validations/action-item";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ meetingId: string; actionId: string }> };

async function resolveActionItem(actionId: string, meetingId: string, orgId: string) {
  return prisma.actionItem.findFirst({
    where: {
      id: actionId,
      meetingId,
      meeting: { client: { orgId } },
    },
    select: { id: true },
  });
}

// PATCH /api/meetings/[meetingId]/actions/[actionId] — update action item
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

    const { meetingId, actionId } = await ctx.params;

    const existing = await resolveActionItem(actionId, meetingId, user.orgId);
    if (!existing) return notFoundResponse("ActionItem");

    const body = await req.json();
    const parsed = actionItemUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { dueDate, ...rest } = parsed.data;

    const actionItem = await prisma.actionItem.update({
      where: { id: actionId },
      data: {
        ...rest,
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
      },
    });

    return NextResponse.json({ data: actionItem });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/meetings/[meetingId]/actions/[actionId] — delete action item
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { meetingId, actionId } = await ctx.params;

    const existing = await resolveActionItem(actionId, meetingId, user.orgId);
    if (!existing) return notFoundResponse("ActionItem");

    await prisma.actionItem.delete({ where: { id: actionId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
