import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { scheduleCreateSchema, scheduleQuerySchema } from "@/lib/validations/schedule";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

// GET /api/schedules — list schedules with filters and pagination
export async function GET(req: NextRequest) {
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

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = scheduleQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { type, clientId, startDateFrom, startDateTo, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ScheduleWhereInput = {
      orgId: user.orgId,
      ...(type ? { type } : {}),
      ...(clientId ? { clientId } : {}),
      ...(startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom ? { gte: new Date(startDateFrom) } : {}),
              ...(startDateTo ? { lte: new Date(startDateTo) } : {}),
            },
          }
        : {}),
    };

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          orgId: true,
          clientId: true,
          projectId: true,
          programId: true,
          title: true,
          description: true,
          type: true,
          startDate: true,
          endDate: true,
          isAllDay: true,
          reminderDays: true,
          googleCalendarId: true,
          createdAt: true,
          client: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
        },
      }),
      prisma.schedule.count({ where }),
    ]);

    return NextResponse.json({ data: schedules, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/schedules — create schedule
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const parsed = scheduleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { startDate, endDate, ...rest } = parsed.data;

    const schedule = await prisma.schedule.create({
      data: {
        ...rest,
        orgId: user.orgId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
