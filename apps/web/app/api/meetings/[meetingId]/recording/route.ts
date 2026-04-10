import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { uploadFromFormData, BUCKETS, StorageValidationError } from "@axle/storage";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ meetingId: string }> };

const ALLOWED_RECORDING_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "video/webm",
]);

// POST /api/meetings/[meetingId]/recording — upload a recording file
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { meetingId } = await ctx.params;

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, client: { orgId: user.orgId } },
      select: { id: true },
    });
    if (!meeting) return notFoundResponse("Meeting");

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "file field is required" } },
        { status: 400 }
      );
    }

    if (!ALLOWED_RECORDING_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Unsupported file type: ${file.type}. Allowed: audio/mpeg, audio/wav, audio/webm, audio/mp4, video/webm`,
          },
        },
        { status: 400 }
      );
    }

    const result = await uploadFromFormData(BUCKETS.RECORDINGS, formData, "file", {
      orgId: user.orgId,
    });

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: { recordingUrl: result.url },
      select: { id: true, recordingUrl: true },
    });

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (err) {
    if (err instanceof StorageValidationError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: err.message } },
        { status: 400 }
      );
    }
    return handleInternalError(err);
  }
}
