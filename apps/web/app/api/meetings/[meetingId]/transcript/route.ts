import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { generateSummary } from "@/lib/services/meeting-summary";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ meetingId: string }> };

async function resolveMeeting(meetingId: string, orgId: string) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, client: { orgId } },
    select: { id: true },
  });
}

// GET /api/meetings/[meetingId]/transcript — retrieve transcript + summary
export async function GET(_req: NextRequest, ctx: RouteContext) {
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

    const meeting = await resolveMeeting(meetingId, user.orgId);
    if (!meeting) return notFoundResponse("Meeting");

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { meetingId },
    });

    if (!transcript) return notFoundResponse("Transcript");

    return NextResponse.json({ data: transcript });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/meetings/[meetingId]/transcript — paste raw transcript text (create or update)
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

    const meeting = await resolveMeeting(meetingId, user.orgId);
    if (!meeting) return notFoundResponse("Meeting");

    const body = await req.json();
    const rawTranscript = body?.rawTranscript as string | undefined;

    if (!rawTranscript || typeof rawTranscript !== "string" || rawTranscript.trim() === "") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "rawTranscript is required and must be a non-empty string" } },
        { status: 400 }
      );
    }

    const transcript = await prisma.meetingTranscript.upsert({
      where: { meetingId },
      create: {
        meetingId,
        rawTranscript: rawTranscript.trim(),
      },
      update: {
        rawTranscript: rawTranscript.trim(),
        // Reset summary fields when transcript is updated
        summary: null,
        keyDecisions: undefined,
        aiJobId: null,
      },
    });

    // Fire-and-forget: trigger summary generation
    void Promise.resolve(generateSummary(meetingId)).catch((err) => {
      console.error("[transcript] summary generation trigger failed", { meetingId, err });
    });

    return NextResponse.json({ data: transcript }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
