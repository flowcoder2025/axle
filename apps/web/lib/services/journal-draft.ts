/**
 * journal-draft.ts
 *
 * Creates an AI draft job for a research journal entry and
 * calls the AI provider to generate objectives, results, and nextSteps.
 */

import { prisma } from "@axle/db";
import { createAiJob, resolveProvider, updateJobStatus } from "@axle/ai";
import { Prisma } from "@prisma/client";

const JOURNAL_DRAFT_SYSTEM_PROMPT = `You are a research journal assistant. Given project context and existing notes, generate:
1. Research objectives (연구 목표)
2. Results and findings (연구 결과)
3. Next steps (향후 계획)

Respond in JSON: {"objectives": "...", "results": "...", "nextSteps": "..."}
Write in Korean. Be specific and technical.`;

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

interface JournalDraftResult {
  objectives: string;
  results: string;
  nextSteps: string;
}

/**
 * Generate an AI draft for a research journal entry.
 *
 * 1. Creates an AiJob (type: JOURNAL_DRAFT, tier: LOCAL_MLX)
 * 2. Updates ResearchJournal.aiDraftJobId
 * 3. Calls AI provider to generate objectives, results, nextSteps
 * 4. Updates journal with generated fields and marks job COMPLETED
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

  console.info("[journal-draft] job created", {
    journalId: journal.id,
    aiJobId: job.id,
    tier: job.tier,
  });

  try {
    const startMs = Date.now();
    const provider = await resolveProvider("JOURNAL_DRAFT");

    const userPrompt = [
      `제목: ${journal.title}`,
      `날짜: ${journal.date.toISOString().slice(0, 10)}`,
      `내용:\n${journal.content.slice(0, 8000)}`,
      journal.objectives ? `기존 목표: ${journal.objectives}` : "",
      journal.results ? `기존 결과: ${journal.results}` : "",
      journal.nextSteps ? `기존 계획: ${journal.nextSteps}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await provider.complete({
      system: JOURNAL_DRAFT_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 2048,
    });

    const parsed = parseJsonResponse(completion.text);

    await prisma.researchJournal.update({
      where: { id: journal.id },
      data: {
        objectives: parsed.objectives,
        results: parsed.results,
        nextSteps: parsed.nextSteps,
      },
    });

    const durationMs = Date.now() - startMs;

    await updateJobStatus(job.id, {
      status: "COMPLETED",
      output: parsed as unknown as Prisma.InputJsonValue,
      durationMs,
    });

    console.info("[journal-draft] AI draft completed", {
      journalId: journal.id,
      aiJobId: job.id,
      durationMs,
    });
  } catch (err) {
    console.error("[journal-draft] AI draft failed", {
      journalId: journal.id,
      aiJobId: job.id,
      err,
    });

    await updateJobStatus(job.id, {
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : String(err),
    }).catch((updateErr) => {
      console.error("[journal-draft] failed to update job status", {
        aiJobId: job.id,
        updateErr,
      });
    });
  }

  return job;
}

/**
 * Parse the AI response text as JSON with JournalDraftResult shape.
 * Handles both raw JSON and markdown-fenced JSON blocks.
 */
function parseJsonResponse(text: string): JournalDraftResult {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();

  const parsed = JSON.parse(cleaned);

  if (
    typeof parsed.objectives !== "string" ||
    typeof parsed.results !== "string" ||
    typeof parsed.nextSteps !== "string"
  ) {
    throw new Error(
      "Invalid AI response: missing required fields (objectives, results, nextSteps)"
    );
  }

  return {
    objectives: parsed.objectives,
    results: parsed.results,
    nextSteps: parsed.nextSteps,
  };
}
