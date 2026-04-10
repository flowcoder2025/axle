/**
 * WI-122: GET /health
 *
 * Returns MLX server status, MQ watcher status, and process uptime.
 */

import { Router } from "express";
import { mlxServer } from "../mlx/server.js";
import { mqWatcher } from "../mq/watcher.js";
import { readMqStatus } from "../mq/status.js";

export const healthRouter = Router();

const startedAt = new Date();

healthRouter.get("/health", async (_req, res) => {
  const mqStatus = await readMqStatus().catch(() => ({ status: "unknown" }));

  const uptimeMs = Date.now() - startedAt.getTime();

  res.json({
    ok: true,
    uptime: {
      ms: uptimeMs,
      seconds: Math.floor(uptimeMs / 1000),
      human: formatUptime(uptimeMs),
    },
    mlx: {
      status: mlxServer.state.status,
      pid: mlxServer.state.pid ?? null,
      startedAt: mlxServer.state.startedAt?.toISOString() ?? null,
      restartCount: mlxServer.state.restartCount,
      lastError: mlxServer.state.lastError ?? null,
    },
    mq: {
      watching: mqWatcher.isWatching,
      ...mqStatus,
    },
    timestamp: new Date().toISOString(),
  });
});

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}
