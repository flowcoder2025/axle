/**
 * Tests for AI routes (WI-122)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks (no top-level variables inside factory — use vi.fn() inline) ────────

vi.mock("../../src/mq/task.js", () => ({
  submitTask: vi.fn(),
}));
vi.mock("../../src/mq/result.js", () => ({
  hasResult: vi.fn(),
  readResult: vi.fn(),
}));
vi.mock("../../src/mq/status.js", () => ({
  readMqStatus: vi.fn(),
}));

import { submitTask } from "../../src/mq/task.js";
import { hasResult, readResult } from "../../src/mq/result.js";
import { readMqStatus } from "../../src/mq/status.js";

const submitTaskMock = vi.mocked(submitTask);
const hasResultMock = vi.mocked(hasResult);
const readResultMock = vi.mocked(readResult);
const readMqStatusMock = vi.mocked(readMqStatus);

import { aiRouter } from "../../src/routes/ai.js";

const app = express();
app.use(express.json());
app.use(aiRouter);

const VALID_JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("POST /api/ai/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitTaskMock.mockResolvedValue({
      jobId: VALID_JOB_ID,
      filePath: `.claude-mq/inbox/${VALID_JOB_ID}.md`,
    });
  });

  it("returns 202 with jobId on valid request", async () => {
    const res = await request(app)
      .post("/api/ai/run")
      .send({ prompt: "Hello Claude" });

    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe(VALID_JOB_ID);
    expect(res.body.status).toBe("queued");
  });

  it("returns 400 when prompt is missing", async () => {
    const res = await request(app).post("/api/ai/run").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 400 when prompt is empty string", async () => {
    const res = await request(app).post("/api/ai/run").send({ prompt: "" });
    expect(res.status).toBe(400);
  });

  it("passes metadata to submitTask", async () => {
    await request(app)
      .post("/api/ai/run")
      .send({ prompt: "Test", metadata: { source: "test" } });

    expect(submitTaskMock).toHaveBeenCalledWith("Test", { source: "test" });
  });
});

describe("GET /api/ai/status/:jobId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readMqStatusMock.mockResolvedValue({ status: "idle", updatedAt: new Date().toISOString() });
  });

  it("returns completed status when result exists", async () => {
    hasResultMock.mockResolvedValue(true);
    readResultMock.mockResolvedValue({
      jobId: VALID_JOB_ID,
      raw: "Claude response",
      text: "Claude response",
      completedAt: new Date("2025-01-01T00:00:00Z"),
    });

    const res = await request(app).get(`/api/ai/status/${VALID_JOB_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.result).toBe("Claude response");
  });

  it("returns processing status when job is current", async () => {
    hasResultMock.mockResolvedValue(false);
    readMqStatusMock.mockResolvedValue({
      status: "processing",
      currentJobId: VALID_JOB_ID,
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app).get(`/api/ai/status/${VALID_JOB_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("processing");
  });

  it("returns queued when no result and not processing", async () => {
    hasResultMock.mockResolvedValue(false);
    readMqStatusMock.mockResolvedValue({ status: "idle", updatedAt: new Date().toISOString() });

    const res = await request(app).get(`/api/ai/status/${VALID_JOB_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("queued");
  });

  it("returns 400 for invalid jobId", async () => {
    const res = await request(app).get("/api/ai/status/not-a-uuid");
    expect(res.status).toBe(400);
  });
});
