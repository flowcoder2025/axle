/**
 * meeting-transcription.ts
 *
 * Triggers AI transcription for a meeting recording.
 * Phase 9: creates AiJob record only — actual transcription wired in Phase 14.
 */

import { prisma } from "@axle/db";
import { createAiJob } from "@axle/ai";

/**
 * Start transcription for a meeting recording.
 *
 * Creates an AiJob of type TRANSCRIBE with tier auto-resolved.
 * Returns the aiJobId for status polling.
 *
 * NOTE: Actual transcription execution is deferred to Phase 14.
 */
export async function startTranscription(meetingId: string): Promise<string> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      recordingUrl: true,
      projectId: true,
      project: { select: { client: { select: { orgId: true } } } },
    },
  });

  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }

  if (!meeting.recordingUrl) {
    throw new Error(`Meeting ${meetingId} has no recording URL`);
  }

  const orgId = meeting.project?.client.orgId;
  if (!orgId) {
    throw new Error(`Meeting ${meetingId} has no project/client org`);
  }

  const job = await createAiJob({
    orgId,
    type: "TRANSCRIBE",
    projectId: meeting.projectId ?? undefined,
    input: {
      meetingId,
      recordingUrl: meeting.recordingUrl,
    },
  });

  // Phase 14 TODO: enqueue actual transcription worker with job.id

  console.info("[meeting-transcription] job created", {
    meetingId,
    aiJobId: job.id,
    tier: job.tier,
  });

  return job.id;
}
