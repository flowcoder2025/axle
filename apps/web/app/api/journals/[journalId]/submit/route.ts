import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ journalId: string }> };

// POST /api/journals/[journalId]/submit — DRAFT → SUBMITTED (only researcher can submit)
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { journalId } = await ctx.params;

    const journal = await prisma.researchJournal.findFirst({
      where: { id: journalId, client: { orgId: user.orgId } },
      select: { id: true, status: true },
    });

    if (!journal) return notFoundResponse("Journal");

    if (journal.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot submit journal with status ${journal.status}. Only DRAFT journals can be submitted.`,
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.researchJournal.update({
      where: { id: journalId },
      data: { status: "SUBMITTED" },
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
