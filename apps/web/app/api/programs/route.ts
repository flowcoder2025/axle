import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { programCreateSchema, programQuerySchema } from "@/lib/validations/program";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";
import { createProgramWithDeadlines } from "@/lib/services/program-deadline";
import { cacheGet, cacheInvalidatePrefix } from "@/lib/cache/redis";

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
    const filters = { category, region, hasDeadline, page, pageSize };
    const cacheKey = `programs:list:${user.orgId}:${JSON.stringify(filters)}`;

    const result = await cacheGet(cacheKey, 900, async () => {
      const where: Prisma.ProgramInfoWhereInput = {
        orgId: user.orgId!,
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

      return { data: programs, total, page, pageSize };
    });

    return NextResponse.json(result);
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

    const program = await createProgramWithDeadlines(orgId, parsed.data);

    // Invalidate programs list cache for this org
    void cacheInvalidatePrefix(`programs:list:${orgId}:`);

    return NextResponse.json({ data: program }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
