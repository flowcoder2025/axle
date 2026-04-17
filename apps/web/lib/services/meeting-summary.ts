/**
 * meeting-summary.ts
 *
 * Generates AI summary and extracts action items from a meeting transcript.
 * Creates an AiJob, calls the AI provider, and updates the transcript with results.
 */

import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { createAiJob, completeWithFallback, updateJobStatus } from "@axle/ai";

const SUMMARY_SYSTEM_PROMPT = `You are a meeting summarizer. Given a meeting transcript, extract:
1. A concise summary (2-3 sentences in Korean)
2. Key decisions made
3. Action items with assignees

Respond in JSON: {"summary": "...", "keyDecisions": ["..."], "actionItems": [{"task": "...", "assignee": "..."}]}`;

interface SummaryResponse {
  summary: string;
  keyDecisions: string[];
  actionItems: { task: string; assignee: string }[];
}

/**
 * Generate an AI summary for a meeting transcript.
 *
 * 1. Fetches MeetingTranscript.rawTranscript
 * 2. Creates an AiJob (type: SUMMARY, tier: API_HAIKU)
 * 3. Calls AI provider to generate summary, keyDecisions, and actionItems
 * 4. Updates MeetingTranscript with the results
 * 5. Marks job as COMPLETED (or FAILED on error)
 *
 * This function is intentionally fire-and-forget — errors are swallowed to
 * prevent blocking the caller (e.g. transcript save endpoint).
 */
export async function generateSummary(meetingId: string): Promise<void> {
  try {
    const transcript = await prisma.meetingTranscript.findUnique({
      where: { meetingId },
      select: {
        id: true,
        rawTranscript: true,
        meeting: {
          select: {
            projectId: true,
            project: { select: { client: { select: { orgId: true } } } },
          },
        },
      },
    });

    if (!transcript || !transcript.rawTranscript) {
      console.warn("[meeting-summary] no transcript found for meeting", { meetingId });
      return;
    }

    const orgId = transcript.meeting.project?.client.orgId;
    if (!orgId) {
      console.warn("[meeting-summary] meeting has no project/client org — skipping", {
        meetingId,
        projectId: transcript.meeting.projectId,
      });
      return;
    }

    const job = await createAiJob({
      orgId,
      type: "SUMMARY",
      tier: "API_HAIKU",
      projectId: transcript.meeting.projectId ?? undefined,
      input: {
        meetingId,
        transcriptId: transcript.id,
        rawTranscript: transcript.rawTranscript.slice(0, 8000), // cap input size
      },
    });

    // Update transcript with aiJobId for status tracking
    await prisma.meetingTranscript.update({
      where: { meetingId },
      data: { aiJobId: job.id },
    });

    console.info("[meeting-summary] job created", {
      meetingId,
      aiJobId: job.id,
      tier: job.tier,
    });

    // AI inference: call provider and update transcript
    try {
      const result = await completeWithFallback("SUMMARY", {
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: transcript.rawTranscript.slice(0, 8000),
        maxTokens: 2048,
      });

      // Strip markdown code fences if present (e.g., ```json ... ```)
      const jsonStr = result.text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
      const parsed: SummaryResponse = JSON.parse(jsonStr);

      await prisma.meetingTranscript.update({
        where: { meetingId },
        data: {
          summary: parsed.summary,
          keyDecisions: parsed.keyDecisions,
        },
      });

      await updateJobStatus(job.id, {
        status: "COMPLETED",
        output: parsed as unknown as Prisma.InputJsonValue,
        durationMs: 0,
      });

      console.info("[meeting-summary] summary generated", {
        meetingId,
        aiJobId: job.id,
      });
    } catch (aiErr) {
      await updateJobStatus(job.id, {
        status: "FAILED",
        errorMessage:
          aiErr instanceof Error ? aiErr.message : "Unknown AI error",
      });
      console.error("[meeting-summary] AI call failed", {
        meetingId,
        aiJobId: job.id,
        err: aiErr,
      });
    }
  } catch (err) {
    console.error("[meeting-summary] failed to create summary job", { meetingId, err });
  }
}
