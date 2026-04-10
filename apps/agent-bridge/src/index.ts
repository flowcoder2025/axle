/**
 * WI-123: Server Entry Point
 *
 * Express app setup, middleware, route mounting, graceful shutdown.
 */

import express from "express";
import { config } from "./config.js";
import { mlxServer } from "./mlx/server.js";
import { mqWatcher } from "./mq/watcher.js";
import { setMqProcessing, setMqIdle, setMqError } from "./mq/status.js";
import { mlxProxyRouter } from "./mlx/proxy.js";
import { healthRouter } from "./routes/health.js";
import { aiRouter } from "./routes/ai.js";
import { transcribeRouter } from "./routes/transcribe.js";

// ── App setup ─────────────────────────────────────────────────────────────────

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging (minimal)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Health endpoint
app.use(healthRouter);

// MLX OpenAI-compatible proxy
app.use(mlxProxyRouter);

// AI job queue routes
app.use(aiRouter);

// Transcription route
app.use(transcribeRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[agent-bridge] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
  }
);

// ── Services ──────────────────────────────────────────────────────────────────

async function startServices(): Promise<void> {
  // Start MLX server if model path is configured
  if (config.MLX_MODEL_PATH) {
    try {
      await mlxServer.start();
      console.log("[agent-bridge] MLX server starting...");
    } catch (err) {
      console.warn("[agent-bridge] MLX server failed to start:", err);
    }
  }

  // Start MQ inbox watcher
  await mqWatcher.start(async (event) => {
    const jobIdMatch = event.content.match(/<!-- job_id: ([a-f0-9-]+) -->/);
    const jobId = jobIdMatch?.[1] ?? "unknown";

    try {
      await setMqProcessing(jobId);
      console.log(`[mq] Processing job: ${jobId} (${event.filePath})`);
      // The actual Claude CLI integration reads the file and writes to outbox.
      // The watcher simply signals the state change; Claude CLI handles execution.
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await setMqError(jobId, msg);
      console.error(`[mq] Error processing job ${jobId}:`, err);
    }
  });

  console.log(`[agent-bridge] MQ watcher started (inbox: ${config.CLAUDE_MQ_INBOX})`);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

let server: ReturnType<typeof app.listen> | null = null;

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[agent-bridge] Received ${signal}, shutting down...`);

  // Stop accepting new connections
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }

  // Stop services
  await Promise.allSettled([
    mlxServer.stop(),
    mqWatcher.stop(),
    setMqIdle(),
  ]);

  console.log("[agent-bridge] Shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => { shutdown("SIGTERM"); });
process.on("SIGINT", () => { shutdown("SIGINT"); });
process.on("uncaughtException", (err) => {
  console.error("[agent-bridge] Uncaught exception:", err);
  shutdown("uncaughtException");
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await startServices();

  server = app.listen(config.PORT, () => {
    console.log(
      `[agent-bridge] Listening on port ${config.PORT} (${config.NODE_ENV})`
    );
  });
}

main().catch((err) => {
  console.error("[agent-bridge] Fatal startup error:", err);
  process.exit(1);
});

export { app };
