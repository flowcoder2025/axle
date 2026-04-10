/**
 * meeting-summary.ts
 *
 * Generates AI summary and extracts action items from a meeting transcript.
 * Phase 9: creates AiJob record only — actual AI inference wired in Phase 14.
 */

import { prisma } from "@axle/db";
import { createAiJob } from "@axle/ai";

/**
 * Generate an AI summary for a meeting transcript.
 *
 * 1. Fetches MeetingTranscript.rawTranscript
 * 2. Creates an AiJob (type: SUMMARY, tier: API_HAIKU)
 * 3. Phase 14: actual LLM call will update summary, keyDecisions, and extract ActionItems
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
        meeting: { select: { projectId: true } },
      },
    });

    if (!transcript || !transcript.rawTranscript) {
      console.warn("[meeting-summary] no transcript found for meeting", { meetingId });
      return;
    }

    const job = await createAiJob({
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

    // Phase 14 TODO: enqueue LLM worker that:
    //   1. Calls AI to generate summary + keyDecisions
    //   2. Updates MeetingTranscript.summary and MeetingTranscript.keyDecisions
    //   3. Auto-extracts ActionItems from summary and creates them
    //   4. Marks job as COMPLETED

    console.info("[meeting-summary] job created", {
      meetingId,
      aiJobId: job.id,
      tier: job.tier,
    });
  } catch (err) {
    console.error("[meeting-summary] failed to create summary job", { meetingId, err });
  }
}
