import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { programCreateSchema, programQuerySchema } from "@/lib/validations/program";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

const PROGRAM_DUE_REMINDER_DAYS = [30, 14, 7, 3, 1];

// GET /api/programs — list programs filtered by category/region, sorted by applicationEnd
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
    const parsed = programQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { category, region, hasDeadline, page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProgramInfoWhereInput = {
      orgId: user.orgId,
      ...(category ? { category } : {}),
      ...(region ? { region } : {}),
      ...(hasDeadline === true ? { applicationEnd: { not: null } } : {}),
      ...(hasDeadline === false ? { applicationEnd: null } : {}),
    };

    const [programs, total] = await Promise.all([
      prisma.programInfo.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { applicationEnd: "asc" },
        select: {
          id: true,
          orgId: true,
          name: true,
          agency: true,
          category: true,
          announcementUrl: true,
          announcementDocId: true,
          applicationStart: true,
          applicationEnd: true,
          maxFunding: true,
          region: true,
          memo: true,
          isCrawled: true,
          crawledAt: true,
          _count: { select: { matchingResults: true, schedules: true } },
        },
      }),
      prisma.programInfo.count({ where }),
    ]);

    return NextResponse.json({ data: programs, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/programs — create program + auto-create PROGRAM_DUE schedule if applicationEnd exists
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

    const orgId = user.orgId;
    const body = await req.json();
    const parsed = programCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const {
      applicationStart,
      applicationEnd,
      maxFunding,
      requirements,
      eligibility,
      announcementUrl,
      ...rest
    } = parsed.data;

    const program = await prisma.$transaction(async (tx) => {
      const created = await tx.programInfo.create({
        data: {
          ...rest,
          orgId,
          announcementUrl: announcementUrl || null,
          applicationStart: applicationStart ? new Date(applicationStart) : null,
          applicationEnd: applicationEnd ? new Date(applicationEnd) : null,
          maxFunding: maxFunding !== undefined && maxFunding !== null ? maxFunding : undefined,
          requirements:
            requirements != null ? (requirements as Prisma.InputJsonValue) : undefined,
          eligibility: eligibility != null ? (eligibility as Prisma.InputJsonValue) : undefined,
        },
      });

      if (created.applicationEnd) {
        await tx.schedule.create({
          data: {
            orgId,
            programId: created.id,
            title: `[마감] ${created.name}`,
            type: "PROGRAM_DUE",
            startDate: created.applicationEnd,
            isAllDay: true,
            reminderDays: PROGRAM_DUE_REMINDER_DAYS,
          },
        });
      }

      return created;
    });

    return NextResponse.json({ data: program }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
