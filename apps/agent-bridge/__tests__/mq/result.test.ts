/**
 * Tests for MQ result reader (WI-119)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { constants } from "node:fs";

// ── Mock fs/promises ──────────────────────────────────────────────────────────

const accessMock = vi.fn();
const readFileMock = vi.fn();
const unlinkMock = vi.fn().mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
  access: (...args: unknown[]) => accessMock(...args),
  unlink: (...args: unknown[]) => unlinkMock(...args),
}));

import { hasResult, readResult } from "../../src/mq/result.js";

const JOB_ID = "abc12345-abcd-1234-abcd-123456789012";
const RESULT_TEXT = "This is the Claude response.";
const RESULT_WITH_HEADERS = `<!-- job_id: ${JOB_ID} -->
<!-- completed_at: 2025-01-01T00:00:00.000Z -->

${RESULT_TEXT}`;

describe("hasResult", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when result file exists", async () => {
    accessMock.mockResolvedValueOnce(undefined);
    expect(await hasResult(JOB_ID)).toBe(true);
    expect(accessMock).toHaveBeenCalledWith(
      expect.stringContaining(`${JOB_ID}.md`),
      constants.R_OK
    );
  });

  it("returns false when file does not exist", async () => {
    accessMock.mockRejectedValueOnce(new Error("ENOENT"));
    expect(await hasResult(JOB_ID)).toBe(false);
  });
});

describe("readResult", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns parsed result with stripped headers", async () => {
    readFileMock.mockResolvedValueOnce(RESULT_WITH_HEADERS);

    const result = await readResult(JOB_ID, false);
    expect(result).not.toBeNull();
    expect(result!.jobId).toBe(JOB_ID);
    expect(result!.text).toBe(RESULT_TEXT);
    expect(result!.raw).toBe(RESULT_WITH_HEADERS);
  });

  it("returns null when file does not exist", async () => {
    readFileMock.mockRejectedValueOnce(new Error("ENOENT"));
    expect(await readResult(JOB_ID)).toBeNull();
  });

  it("deletes file when consume=true", async () => {
    readFileMock.mockResolvedValueOnce(RESULT_WITH_HEADERS);
    await readResult(JOB_ID, true);
    expect(unlinkMock).toHaveBeenCalledOnce();
  });

  it("does not delete file when consume=false", async () => {
    readFileMock.mockResolvedValueOnce(RESULT_WITH_HEADERS);
    await readResult(JOB_ID, false);
    expect(unlinkMock).not.toHaveBeenCalled();
  });
});
