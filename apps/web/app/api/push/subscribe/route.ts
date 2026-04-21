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
 * Persists the push subscription via Prisma (PushSubscription table).
 * Upserts by `endpoint` — re-subscribing from the same device refreshes the
 * keys. A single user may register multiple endpoints (one per device).
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
            message:
              "subscription must have endpoint and keys.p256dh + keys.auth",
          },
        },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") ?? undefined;
    await setPushSubscription(user.id, { endpoint, keys }, { userAgent });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * DELETE /api/push/subscribe
 *
 * Body: { endpoint: string }
 *
 * Removes a single push subscription identified by its push-service endpoint.
 * Idempotent — returns 200 even if the endpoint was already removed.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    let endpoint: string | undefined;
    try {
      const body = await req.json();
      endpoint =
        typeof body?.endpoint === "string" && body.endpoint.length > 0
          ? body.endpoint
          : undefined;
    } catch {
      endpoint = undefined;
    }

    if (!endpoint) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "endpoint is required to unsubscribe",
          },
        },
        { status: 400 }
      );
    }

    await deletePushSubscription(endpoint);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleInternalError(err);
  }
}
