/**
 * AiJob dispatcher bootstrap (web app side).
 *
 * Calls `registerBuiltinHandlers()` once per process, then exposes
 * `runJob(job)` for the API route to kick off a fire-and-forget
 * dispatch that updates the AiJob row on completion.
 */
import { prisma } from "@axle/db";
import type { Prisma } from "@prisma/client";
import type { AiJob } from "@prisma/client";
import {
  dispatch,
  registerBuiltinHandlers,
  UnknownJobTypeError,
  InvalidJobInputError,
} from "@axle/ai";

let initialized = false;
function ensureInitialized(): void {
  if (initialized) return;
  registerBuiltinHandlers();
  initialized = true;
}

/**
 * Execute the job's handler and update the AiJob row with the outcome.
 * Safe to call without `await` — all errors are caught and persisted.
 *
 * Flow:
 *   QUEUED → set RUNNING → dispatch → COMPLETED(output) or FAILED(errorMessage)
 */
export async function runJob(job: Pick<AiJob, "id" | "type" | "input">): Promise<void> {
  ensureInitialized();

  const startedAt = Date.now();
  try {
    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: "RUNNING" },
    });

    const output = await dispatch(job.type, job.input);

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        output: output as Prisma.InputJsonValue,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (err) {
    const message = normalizeError(err);
    try {
      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (updateErr) {
      // Swallow: the job row might have been deleted. Log only.
      console.error("[ai-dispatcher] failed to mark job FAILED", {
        jobId: job.id,
        original: message,
        updateErr: normalizeError(updateErr),
      });
    }
  }
}

function normalizeError(err: unknown): string {
  if (err instanceof UnknownJobTypeError || err instanceof InvalidJobInputError) {
    return `${err.code}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
