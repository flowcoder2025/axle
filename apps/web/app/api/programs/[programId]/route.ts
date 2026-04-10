import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { programUpdateSchema } from "@/lib/validations/program";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ programId: string }> };

const PROGRAM_DUE_REMINDER_DAYS = [30, 14, 7, 3, 1];

// GET /api/programs/[programId]
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

    const { programId } = await ctx.params;

    const program = await prisma.programInfo.findFirst({
      where: { id: programId, orgId: user.orgId },
      include: {
        schedules: {
          orderBy: { startDate: "asc" },
          select: {
            id: true,
            title: true,
            type: true,
            startDate: true,
            reminderDays: true,
          },
        },
        _count: { select: { matchingResults: true } },
      },
    });

    if (!program) {
      return notFoundResponse("Program");
    }

    return NextResponse.json({ data: program });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/programs/[programId]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
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

    const { programId } = await ctx.params;

    const existing = await prisma.programInfo.findFirst({
      where: { id: programId, orgId: user.orgId },
      select: { id: true, name: true, applicationEnd: true },
    });
    if (!existing) {
      return notFoundResponse("Program");
    }

    const body = await req.json();
    const parsed = programUpdateSchema.safeParse(body);
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
      const updated = await tx.programInfo.update({
        where: { id: programId },
        data: {
          ...rest,
          ...(announcementUrl !== undefined ? { announcementUrl: announcementUrl || null } : {}),
          ...(applicationStart !== undefined
            ? { applicationStart: applicationStart ? new Date(applicationStart) : null }
            : {}),
          ...(applicationEnd !== undefined
            ? { applicationEnd: applicationEnd ? new Date(applicationEnd) : null }
            : {}),
          ...(maxFunding !== undefined ? { maxFunding: maxFunding !== null ? maxFunding : null } : {}),
          ...(requirements !== undefined
            ? {
                requirements:
                  requirements != null
                    ? (requirements as Prisma.InputJsonValue)
                    : Prisma.DbNull,
              }
            : {}),
          ...(eligibility !== undefined
            ? {
                eligibility:
                  eligibility != null
                    ? (eligibility as Prisma.InputJsonValue)
                    : Prisma.DbNull,
              }
            : {}),
        },
      });

      // Sync PROGRAM_DUE schedule when applicationEnd changes
      if (applicationEnd !== undefined) {
        const newEndDate = applicationEnd ? new Date(applicationEnd) : null;
        const existingSchedule = await tx.schedule.findFirst({
          where: { programId, type: "PROGRAM_DUE" },
          select: { id: true },
        });

        if (newEndDate) {
          if (existingSchedule) {
            await tx.schedule.update({
              where: { id: existingSchedule.id },
              data: {
                startDate: newEndDate,
                title: `[마감] ${updated.name}`,
              },
            });
          } else {
            await tx.schedule.create({
              data: {
                orgId: user.orgId!,
                programId,
                title: `[마감] ${updated.name}`,
                type: "PROGRAM_DUE",
                startDate: newEndDate,
                isAllDay: true,
                reminderDays: PROGRAM_DUE_REMINDER_DAYS,
              },
            });
          }
        } else if (existingSchedule) {
          await tx.schedule.delete({ where: { id: existingSchedule.id } });
        }
      }

      return updated;
    });

    return NextResponse.json({ data: program });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/programs/[programId] — deletes program and associated schedules
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
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

    const { programId } = await ctx.params;

    const existing = await prisma.programInfo.findFirst({
      where: { id: programId, orgId: user.orgId },
      select: { id: true },
    });
    if (!existing) {
      return notFoundResponse("Program");
    }

    await prisma.$transaction(async (tx) => {
      await tx.schedule.deleteMany({ where: { programId } });
      await tx.programInfo.delete({ where: { id: programId } });
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
