import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { InvalidTransitionError, queueForFineTune } from "@axle/ai";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ patternId: string }> };

/**
 * POST /api/ai/patterns/[patternId]/fine-tune
 *
 * Platform-admin action: transition a SkillPattern from IDLE/CANDIDATE/FAILED → QUEUED.
 * The agent-bridge will pick up QUEUED jobs and transition them to FINE_TUNING.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "FORBIDDEN") return forbiddenResponse();
    return unauthorizedResponse();
  }

  try {
    const { patternId } = await params;

    const existing = await prisma.skillPattern.findUnique({
      where: { id: patternId },
    });
    if (!existing) return notFoundResponse("SkillPattern");

    const updated = await queueForFineTune(patternId);
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json(
        { error: { code: "INVALID_TRANSITION", message: err.message } },
        { status: 409 },
      );
    }
    if (err instanceof Error && err.message.includes("need >= 10")) {
      return NextResponse.json(
        { error: { code: "NOT_CANDIDATE", message: err.message } },
        { status: 400 },
      );
    }
    return handleInternalError(err);
  }
}
