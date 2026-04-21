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
import { syncDeadlines, deleteProgramWithDeadlines } from "@/lib/services/program-deadline";
import { cacheInvalidatePrefix } from "@/lib/cache/redis";

type RouteContext = { params: Promise<{ programId: string }> };

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

    // GET: Crawled 플랫폼 프로그램(orgId=null)과 조직 프로그램 모두 조회 가능
    const program = await prisma.programInfo.findFirst({
      where: {
        id: programId,
        OR: [{ orgId: user.orgId }, { orgId: null }],
      },
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

    // PATCH는 조직 소유 프로그램만 수정 허용 (플랫폼 프로그램은 읽기 전용)
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
        await syncDeadlines(programId, user.orgId!, newEndDate, updated.name, tx);
      }

      return updated;
    });

    // Invalidate programs list cache for this org
    void cacheInvalidatePrefix(`programs:list:${user.orgId}:`);

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

    await deleteProgramWithDeadlines(programId);

    // Invalidate programs list cache for this org
    void cacheInvalidatePrefix(`programs:list:${user.orgId}:`);

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
