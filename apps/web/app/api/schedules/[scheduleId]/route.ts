import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { scheduleUpdateSchema } from "@/lib/validations/schedule";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ scheduleId: string }> };

// GET /api/schedules/[scheduleId]
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

    const { scheduleId } = await ctx.params;

    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, orgId: user.orgId },
      include: {
        client: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    });

    if (!schedule) {
      return notFoundResponse("Schedule");
    }

    return NextResponse.json({ data: schedule });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/schedules/[scheduleId]
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

    const { scheduleId } = await ctx.params;

    const existing = await prisma.schedule.findFirst({
      where: { id: scheduleId, orgId: user.orgId },
      select: { id: true },
    });

    if (!existing) {
      return notFoundResponse("Schedule");
    }

    const body = await req.json();
    const parsed = scheduleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { startDate, endDate, ...rest } = parsed.data;

    const schedule = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    });

    return NextResponse.json({ data: schedule });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/schedules/[scheduleId]
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

    const { scheduleId } = await ctx.params;

    const existing = await prisma.schedule.findFirst({
      where: { id: scheduleId, orgId: user.orgId },
      select: { id: true },
    });

    if (!existing) {
      return notFoundResponse("Schedule");
    }

    await prisma.schedule.delete({ where: { id: scheduleId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
