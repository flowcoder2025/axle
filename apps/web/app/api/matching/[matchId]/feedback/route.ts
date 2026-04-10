import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { feedbackSchema } from "@/lib/validations/matching";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

interface RouteParams {
  params: Promise<{ matchId: string }>;
}

// PATCH /api/matching/[matchId]/feedback — submit feedback for a match result
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { matchId } = await params;

    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { isRelevant, feedbackNote } = parsed.data;

    // Verify the match result belongs to a client in this org
    const result = await prisma.matchingResult.findFirst({
      where: { id: matchId },
      include: {
        program: { select: { orgId: true } },
      },
    });

    if (!result) return notFoundResponse("MatchingResult");
    if (result.program.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    const updated = await prisma.matchingResult.update({
      where: { id: matchId },
      data: {
        isRelevant,
        feedbackNote: feedbackNote ?? null,
      },
      select: {
        id: true,
        isRelevant: true,
        feedbackNote: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
