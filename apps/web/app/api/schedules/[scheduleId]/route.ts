import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { scheduleUpdateSchema } from "@/lib/validations/schedule";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import {
  getSchedule,
  updateSchedule,
  deleteSchedule,
} from "@/lib/services/schedule-service";

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
    const schedule = await getSchedule(scheduleId, user.orgId);

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

    const body = await req.json();
    const parsed = scheduleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const schedule = await updateSchedule(scheduleId, user.orgId, parsed.data);

    if (!schedule) {
      return notFoundResponse("Schedule");
    }

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
    const deleted = await deleteSchedule(scheduleId, user.orgId);

    if (!deleted) {
      return notFoundResponse("Schedule");
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
