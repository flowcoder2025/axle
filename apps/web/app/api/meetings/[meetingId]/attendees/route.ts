import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { attendeeSchema } from "@/lib/validations/meeting";
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

// POST /api/meetings/[meetingId]/attendees — add an attendee
export async function POST(req: NextRequest, ctx: RouteContext) {
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

    const meeting = await resolveMeeting(meetingId, user.orgId);
    if (!meeting) return notFoundResponse("Meeting");

    const body = await req.json();
    const parsed = attendeeSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const attendee = await prisma.meetingAttendee.create({
      data: { meetingId, ...parsed.data },
    });

    return NextResponse.json({ data: attendee }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/meetings/[meetingId]/attendees — remove an attendee by attendeeId in body
export async function DELETE(req: NextRequest, ctx: RouteContext) {
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

    const meeting = await resolveMeeting(meetingId, user.orgId);
    if (!meeting) return notFoundResponse("Meeting");

    const body = await req.json();
    const attendeeId = body?.attendeeId as string | undefined;
    if (!attendeeId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "attendeeId is required" } },
        { status: 400 }
      );
    }

    const existing = await prisma.meetingAttendee.findFirst({
      where: { id: attendeeId, meetingId },
      select: { id: true },
    });
    if (!existing) return notFoundResponse("Attendee");

    await prisma.meetingAttendee.delete({ where: { id: attendeeId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
