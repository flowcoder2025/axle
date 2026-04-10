/**
 * WI-119: MQ Task Submission
 *
 * Writes a task .md file to the inbox directory with a UUID filename.
 * The Claude CLI watcher picks this up and processes it.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";

export interface MqTask {
  jobId: string;
  /** Markdown prompt content sent to Claude CLI */
  prompt: string;
  /** Optional metadata stored in the task file header */
  metadata?: Record<string, string>;
}

export interface MqTaskFile {
  jobId: string;
  filePath: string;
}

/**
 * Write a task to the inbox directory.
 * Returns the jobId and the path of the created file.
 */
export async function submitTask(
  prompt: string,
  metadata?: Record<string, string>
): Promise<MqTaskFile> {
  const jobId = uuidv4();
  const filePath = join(config.CLAUDE_MQ_INBOX, `${jobId}.md`);

  await mkdir(config.CLAUDE_MQ_INBOX, { recursive: true });

  const content = buildTaskContent({ jobId, prompt, metadata });
  await writeFile(filePath, content, "utf8");

  return { jobId, filePath };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function buildTaskContent(task: MqTask): string {
  const headerLines = [
    `<!-- job_id: ${task.jobId} -->`,
    `<!-- submitted_at: ${new Date().toISOString()} -->`,
  ];

  if (task.metadata) {
    for (const [key, value] of Object.entries(task.metadata)) {
      headerLines.push(`<!-- ${key}: ${value} -->`);
    }
  }

  return [headerLines.join("\n"), "", task.prompt].join("\n");
}
