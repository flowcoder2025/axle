import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { markRead, deleteOne } from "@axle/notification";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ notificationId: string }> };

// PATCH /api/notifications/[notificationId] — mark a single notification as read
// Only updates when the notification belongs to the current user
export async function PATCH(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const { notificationId } = await ctx.params;

    const updated = await markRead(notificationId, user.id);
    if (!updated) {
      return notFoundResponse("Notification");
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/notifications/[notificationId] — delete a notification
// Only deletes when the notification belongs to the current user
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const { notificationId } = await ctx.params;

    const result = await deleteOne(notificationId, user.id);
    if (!result) {
      return notFoundResponse("Notification");
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleInternalError(err);
  }
}
