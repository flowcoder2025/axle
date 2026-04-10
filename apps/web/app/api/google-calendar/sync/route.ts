import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { syncCalendar } from "@/lib/services/google-calendar";
import { unauthorizedResponse, handleInternalError } from "@/lib/api-helpers";
import { z } from "zod";

const syncRequestSchema = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
  refreshToken: z.string().min(1, "refreshToken is required"),
});

// POST /api/google-calendar/sync — trigger manual bidirectional sync
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
    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join("; "),
          },
        },
        { status: 400 }
      );
    }

    const result = await syncCalendar(user.orgId, {
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleInternalError(err);
  }
}
