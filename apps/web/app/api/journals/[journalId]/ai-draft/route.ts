import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { generateJournalDraft } from "@/lib/services/journal-draft";

type RouteContext = { params: Promise<{ journalId: string }> };

// POST /api/journals/[journalId]/ai-draft — create AiJob JOURNAL_DRAFT (LOCAL_MLX tier)
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
      select: {
        id: true,
        status: true,
        title: true,
        content: true,
        objectives: true,
        results: true,
        nextSteps: true,
        hours: true,
        date: true,
        clientId: true,
        researcherContactId: true,
      },
    });

    if (!journal) return notFoundResponse("Journal");

    const job = await generateJournalDraft(journal);

    return NextResponse.json({ data: { jobId: job.id, status: job.status } }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
