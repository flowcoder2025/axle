/**
 * Tests for MQ task submission (WI-119)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock fs/promises ──────────────────────────────────────────────────────────

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock uuid ─────────────────────────────────────────────────────────────────

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1234-5678-abcd"),
}));

import { writeFile } from "node:fs/promises";
const writeFileMock = vi.mocked(writeFile);

import { submitTask } from "../../src/mq/task.js";

describe("submitTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns jobId and filePath", async () => {
    const result = await submitTask("Summarize this document");
    expect(result.jobId).toBe("test-uuid-1234-5678-abcd");
    expect(result.filePath).toContain("test-uuid-1234-5678-abcd.md");
  });

  it("writes a file with job_id header comment", async () => {
    await submitTask("Hello Claude", { source: "agent-bridge" });

    expect(writeFileMock).toHaveBeenCalledOnce();
    const [, content] = writeFileMock.mock.calls[0] as [string, string, string];
    expect(content).toContain("<!-- job_id: test-uuid-1234-5678-abcd -->");
    expect(content).toContain("<!-- source: agent-bridge -->");
    expect(content).toContain("Hello Claude");
  });

  it("includes submitted_at timestamp", async () => {
    await submitTask("Test");
    const [, content] = writeFileMock.mock.calls[0] as [string, string, string];
    expect(content).toMatch(/<!-- submitted_at: \d{4}-\d{2}-\d{2}T/);
  });
});
