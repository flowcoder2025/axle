import { NextResponse } from "next/server";
import { handleInternalError } from "@/lib/api-helpers";

/**
 * GET /api/push/vapid-public-key
 *
 * Returns the VAPID public key used by the browser to subscribe with
 * `pushManager.subscribe({ applicationServerKey })`.
 *
 * The key itself is a public identifier and safe to expose — only the
 * matching VAPID_PRIVATE_KEY (kept server-side) can sign push deliveries.
 */
export async function GET() {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return NextResponse.json(
        {
          error: {
            code: "VAPID_NOT_CONFIGURED",
            message: "VAPID_PUBLIC_KEY is not set on the server",
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ publicKey });
  } catch (err) {
    return handleInternalError(err);
  }
}
