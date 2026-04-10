import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import {
  setPushSubscription,
  deletePushSubscription,
} from "@/lib/push/subscriptions";

/**
 * POST /api/push/subscribe
 *
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 *
 * Saves the push subscription for the currently authenticated user.
 * Subsequent POST calls from the same user overwrite the previous subscription
 * (one active subscription per user for Phase 4).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await req.json();

    const { endpoint, keys } = body ?? {};
    if (
      typeof endpoint !== "string" ||
      !endpoint ||
      typeof keys?.p256dh !== "string" ||
      typeof keys?.auth !== "string"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "subscription must have endpoint and keys.p256dh + keys.auth",
          },
        },
        { status: 400 }
      );
    }

    setPushSubscription(user.id, { endpoint, keys });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * DELETE /api/push/subscribe
 *
 * Removes the push subscription for the currently authenticated user.
 */
export async function DELETE(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    deletePushSubscription(user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleInternalError(err);
  }
}
