import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { meetingCreateSchema, meetingQuerySchema } from "@/lib/validations/meeting";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

// GET /api/meetings — list meetings with filtering and pagination
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = meetingQuerySchema.safeParse(searchParams);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, projectId, dateFrom, dateTo, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MeetingWhereInput = {
      client: { orgId: user.orgId },
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { date: "desc" },
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          recordingUrl: true,
          client: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
          _count: { select: { attendees: true, actionItems: true } },
          transcript: { select: { id: true, summary: true } },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    const data = meetings.map((m) => ({
      ...m,
      date: m.date.toISOString(),
      hasTranscript: !!m.transcript,
      hasSummary: !!m.transcript?.summary,
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/meetings — create meeting with optional attendees
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = meetingCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { attendees, date, ...rest } = parsed.data;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: rest.clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    const meeting = await prisma.meeting.create({
      data: {
        ...rest,
        date: new Date(date),
        ...(attendees && attendees.length > 0
          ? { attendees: { create: attendees } }
          : {}),
      },
      include: {
        attendees: true,
        _count: { select: { attendees: true } },
      },
    });

    return NextResponse.json({ data: meeting }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
