/**
 * WI-119: MQ Result Reader
 *
 * Reads a result .md file from the outbox directory.
 * The Claude CLI (or processor) writes results here after completing a task.
 */

import { readFile, access, unlink } from "node:fs/promises";
import { join } from "node:path";
import { constants } from "node:fs";
import { config } from "../config.js";

export interface MqResult {
  jobId: string;
  /** Full raw content of the result file */
  raw: string;
  /** Extracted response text (strip header comments) */
  text: string;
  completedAt: Date;
}

export interface PollResultOptions {
  jobId: string;
  /** How long to wait in ms. Default: 60_000 */
  timeoutMs?: number;
  /** Poll interval in ms. Default: 500 */
  intervalMs?: number;
  /** Remove the result file after reading. Default: true */
  consume?: boolean;
}

/**
 * Check if a result file exists for the given jobId.
 */
export async function hasResult(jobId: string): Promise<boolean> {
  const filePath = resultPath(jobId);
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the result file for a completed job.
 * Returns null if the file does not exist.
 */
export async function readResult(
  jobId: string,
  consume = true
): Promise<MqResult | null> {
  const filePath = resultPath(jobId);
  let raw: string;

  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  if (consume) {
    await unlink(filePath).catch(() => undefined);
  }

  return {
    jobId,
    raw,
    text: stripHeaders(raw),
    completedAt: new Date(),
  };
}

/**
 * Poll for a result with a timeout.
 * Resolves when the result appears or rejects on timeout.
 */
export async function pollResult(
  options: PollResultOptions
): Promise<MqResult> {
  const {
    jobId,
    timeoutMs = 60_000,
    intervalMs = 500,
    consume = true,
  } = options;

  const deadline = Date.now() + timeoutMs;

  return new Promise<MqResult>((resolve, reject) => {
    const check = async (): Promise<void> => {
      const result = await readResult(jobId, consume);
      if (result) {
        resolve(result);
        return;
      }
      if (Date.now() >= deadline) {
        reject(
          new Error(
            `Timeout waiting for MQ result for job ${jobId} after ${timeoutMs}ms`
          )
        );
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

// ── Internal ──────────────────────────────────────────────────────────────────

function resultPath(jobId: string): string {
  return join(config.CLAUDE_MQ_OUTBOX, `${jobId}.md`);
}

function stripHeaders(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("<!--"))
    .join("\n")
    .trim();
}
