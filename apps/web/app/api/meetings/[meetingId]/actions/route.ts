import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { actionItemCreateSchema } from "@/lib/validations/action-item";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { eventBus } from "@/lib/events/event-bus";

type RouteContext = { params: Promise<{ meetingId: string }> };

async function resolveMeeting(meetingId: string, orgId: string) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, client: { orgId } },
    select: { id: true },
  });
}

// GET /api/meetings/[meetingId]/actions — list action items for a meeting
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

    const meeting = await resolveMeeting(meetingId, user.orgId);
    if (!meeting) return notFoundResponse("Meeting");

    const actionItems = await prisma.actionItem.findMany({
      where: { meetingId },
      orderBy: { status: "asc" },
    });

    return NextResponse.json({ data: actionItems });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/meetings/[meetingId]/actions — create action item
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
    const parsed = actionItemCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { dueDate, ...rest } = parsed.data;

    const actionItem = await prisma.actionItem.create({
      data: {
        ...rest,
        meetingId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
    });

    // Fire-and-forget: emit ACTION_ITEM_CREATED event when assignee is set
    if (actionItem.assigneeUserId) {
      // Resolve projectId from the meeting (action items are linked via meeting)
      const meetingWithProject = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { projectId: true },
      });

      void eventBus
        .emit("ACTION_ITEM_CREATED", {
          actionItemId: actionItem.id,
          projectId: meetingWithProject?.projectId ?? "",
          assigneeId: actionItem.assigneeUserId,
        })
        .catch(console.error);
    }

    return NextResponse.json({ data: actionItem }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
