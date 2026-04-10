import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { meetingUpdateSchema } from "@/lib/validations/meeting";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ meetingId: string }> };

async function resolveMeeting(meetingId: string, orgId: string) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, client: { orgId } },
    select: { id: true },
  });
}

// GET /api/meetings/[meetingId] — single meeting with attendees, transcript, action items
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

    const { meetingId } = await ctx.params;

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, client: { orgId: user.orgId } },
      include: {
        attendees: true,
        transcript: true,
        actionItems: true,
      },
    });

    if (!meeting) return notFoundResponse("Meeting");

    return NextResponse.json({ data: meeting });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/meetings/[meetingId] — partial update
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

    const { meetingId } = await ctx.params;

    const existing = await resolveMeeting(meetingId, user.orgId);
    if (!existing) return notFoundResponse("Meeting");

    const body = await req.json();
    const parsed = meetingUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { date, ...rest } = parsed.data;

    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
      },
    });

    return NextResponse.json({ data: meeting });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/meetings/[meetingId] — hard delete (cascades to attendees, transcript, actionItems)
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

    const { meetingId } = await ctx.params;

    const existing = await resolveMeeting(meetingId, user.orgId);
    if (!existing) return notFoundResponse("Meeting");

    await prisma.meeting.delete({ where: { id: meetingId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
