import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ patternId: string }> };

/**
 * GET /api/ai/patterns/[patternId]
 * Returns full pattern detail including sampleInput/sampleOutput (admin-only).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "FORBIDDEN") return forbiddenResponse();
    return unauthorizedResponse();
  }

  try {
    const { patternId } = await params;
    const pattern = await prisma.skillPattern.findUnique({
      where: { id: patternId },
    });
    if (!pattern) return notFoundResponse("SkillPattern");

    return NextResponse.json({ data: pattern });
  } catch (err) {
    return handleInternalError(err);
  }
}
