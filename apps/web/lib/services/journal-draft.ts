/**
 * journal-draft.ts
 *
 * Creates an AI draft job for a research journal entry.
 * Phase 14: actual LLM inference will be wired in.
 */

import { prisma } from "@axle/db";
import { createAiJob } from "@axle/ai";
import { Prisma } from "@prisma/client";

interface JournalDraftInput {
  id: string;
  title: string;
  content: string;
  objectives: string | null;
  results: string | null;
  nextSteps: string | null;
  hours: Prisma.Decimal | null;
  date: Date;
  clientId: string;
  researcherContactId: string;
}

/**
 * Generate an AI draft for a research journal entry.
 *
 * 1. Creates an AiJob (type: JOURNAL_DRAFT, tier: LOCAL_MLX)
 * 2. Updates ResearchJournal.aiDraftJobId
 * 3. Phase 14: actual LLM call will fill in objectives, results, nextSteps
 *
 * @param journal - Journal data for the draft job
 * @returns The created AiJob record
 */
export async function generateJournalDraft(journal: JournalDraftInput) {
  const job = await createAiJob({
    type: "JOURNAL_DRAFT",
    tier: "LOCAL_MLX",
    input: {
      journalId: journal.id,
      title: journal.title,
      content: journal.content.slice(0, 8000), // cap input size
      objectives: journal.objectives,
      results: journal.results,
      nextSteps: journal.nextSteps,
      hours: journal.hours ? Number(journal.hours) : null,
      date: journal.date.toISOString(),
      clientId: journal.clientId,
      researcherContactId: journal.researcherContactId,
    },
  });

  // Link job to journal for status tracking
  await prisma.researchJournal.update({
    where: { id: journal.id },
    data: { aiDraftJobId: job.id },
  });

  // Phase 14 TODO: enqueue LLM worker that:
  //   1. Analyzes existing content
  //   2. Suggests/fills objectives, results, nextSteps
  //   3. Updates ResearchJournal fields
  //   4. Marks job as COMPLETED

  console.info("[journal-draft] job created", {
    journalId: journal.id,
    aiJobId: job.id,
    tier: job.tier,
  });

  return job;
}
