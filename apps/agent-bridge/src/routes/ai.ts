/**
 * WI-122: AI Routes
 *
 * POST /api/ai/run  — submit a Claude CLI job via MQ
 * GET  /api/ai/status/:jobId — poll job status + result
 */

import { Router } from "express";
import { z } from "zod";
import { submitTask } from "../mq/task.js";
import { hasResult, readResult } from "../mq/result.js";
import { readMqStatus } from "../mq/status.js";

export const aiRouter = Router();

// ── POST /api/ai/run ──────────────────────────────────────────────────────────

const RunBodySchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  metadata: z.record(z.string()).optional(),
});

aiRouter.post("/api/ai/run", async (req, res) => {
  const parsed = RunBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const { jobId, filePath } = await submitTask(
      parsed.data.prompt,
      parsed.data.metadata
    );

    res.status(202).json({
      jobId,
      status: "queued",
      filePath,
      submittedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to submit job", details: message });
  }
});

// ── GET /api/ai/status/:jobId ─────────────────────────────────────────────────

aiRouter.get("/api/ai/status/:jobId", async (req, res) => {
  const { jobId } = req.params;

  if (!jobId || !/^[0-9a-f-]{36}$/.test(jobId)) {
    res.status(400).json({ error: "Invalid jobId format" });
    return;
  }

  try {
    const [mqStatus, resultExists] = await Promise.all([
      readMqStatus(),
      hasResult(jobId),
    ]);

    if (resultExists) {
      // Consume=false so we don't delete on status poll; caller decides when to consume
      const result = await readResult(jobId, false);
      res.json({
        jobId,
        status: "completed",
        result: result?.text ?? null,
        completedAt: result?.completedAt.toISOString() ?? null,
      });
      return;
    }

    // Check if this job is currently being processed
    if (
      mqStatus.status === "processing" &&
      mqStatus.currentJobId === jobId
    ) {
      res.json({ jobId, status: "processing" });
      return;
    }

    // Still queued (inbox file exists or mq is idle with no result yet)
    res.json({ jobId, status: "queued", mqStatus: mqStatus.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to get job status", details: message });
  }
});
