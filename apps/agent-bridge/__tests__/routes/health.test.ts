/**
 * Tests for GET /health (WI-122)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../src/mlx/server.js", () => ({
  mlxServer: {
    state: {
      status: "running",
      pid: 9999,
      startedAt: new Date("2025-01-01T00:00:00Z"),
      restartCount: 0,
      lastError: undefined,
    },
  },
}));

vi.mock("../../src/mq/watcher.js", () => ({
  mqWatcher: { isWatching: true },
}));

vi.mock("../../src/mq/status.js", () => ({
  readMqStatus: vi.fn().mockResolvedValue({ status: "idle" }),
}));

import { healthRouter } from "../../src/routes/health.js";

const app = express();
app.use(express.json());
app.use(healthRouter);

describe("GET /health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with health payload", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("includes mlx status", async () => {
    const res = await request(app).get("/health");
    expect(res.body.mlx.status).toBe("running");
    expect(res.body.mlx.pid).toBe(9999);
  });

  it("includes mq watching state", async () => {
    const res = await request(app).get("/health");
    expect(res.body.mq.watching).toBe(true);
    expect(res.body.mq.status).toBe("idle");
  });

  it("includes uptime fields", async () => {
    const res = await request(app).get("/health");
    expect(res.body.uptime).toHaveProperty("ms");
    expect(res.body.uptime).toHaveProperty("seconds");
    expect(res.body.uptime).toHaveProperty("human");
  });
});
