import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { getByUser, markAllRead } from "@axle/notification";
import { notificationQuerySchema } from "@/lib/validations/notification";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

// GET /api/notifications — list notifications for the current user with pagination
// Query params: type?, isRead?, page, pageSize
// Response: { data: Notification[], total, page, pageSize, unreadCount }
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = notificationQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { type, isRead, page, pageSize } = parsed.data;

    const result = await getByUser(user.id, { type, isRead, page, pageSize });

    return NextResponse.json({
      data: result.notifications,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      unreadCount: result.unreadCount,
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/notifications — mark all notifications as read for the current user
export async function PATCH(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const count = await markAllRead(user.id);

    return NextResponse.json({ data: { updated: count } });
  } catch (err) {
    return handleInternalError(err);
  }
}
