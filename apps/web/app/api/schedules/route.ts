import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { scheduleCreateSchema, scheduleQuerySchema } from "@/lib/validations/schedule";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { listSchedules, createSchedule } from "@/lib/services/schedule-service";

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

    const { page, pageSize } = parsed.data;
    const { schedules, total } = await listSchedules(user.orgId, parsed.data);

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

    const schedule = await createSchedule(user.orgId, parsed.data);

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
