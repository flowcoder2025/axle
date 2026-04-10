/**
 * Tests for mlx-whisper wrapper (WI-120)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// ── Mock child_process ────────────────────────────────────────────────────────

const mockProc = new EventEmitter() as ReturnType<typeof import("node:child_process").spawn>;
// @ts-expect-error partial mock
mockProc.stdout = null;
// @ts-expect-error partial mock
mockProc.stderr = new EventEmitter();

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockProc),
}));

// ── Mock fs/promises ──────────────────────────────────────────────────────────

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { readFile } from "node:fs/promises";
const readFileMock = vi.mocked(readFile);

import { transcribeAudio } from "../../src/mlx/whisper.js";

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns transcription text on success", async () => {
    readFileMock.mockResolvedValueOnce("안녕하세요 반갑습니다" as unknown as Buffer);

    const promise = transcribeAudio({
      audioPath: "/tmp/audio.wav",
      model: "large-v3",
      language: "ko",
      outputDir: "/tmp/axle-whisper",
    });

    // Simulate process exiting successfully
    setTimeout(() => mockProc.emit("exit", 0, null), 10);

    const result = await promise;
    expect(result.text).toBe("안녕하세요 반갑습니다");
    expect(result.language).toBe("ko");
  });

  it("rejects when mlx_whisper exits with non-zero code", async () => {
    const promise = transcribeAudio({ audioPath: "/tmp/audio.wav" });

    setTimeout(() => {
      (mockProc.stderr as EventEmitter).emit("data", Buffer.from("Model not found"));
      mockProc.emit("exit", 1, null);
    }, 10);

    await expect(promise).rejects.toThrow("mlx_whisper exited with code 1");
  });

  it("rejects when spawn fails", async () => {
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockImplementationOnce(() => {
      const p = new EventEmitter() as ReturnType<typeof spawn>;
      // @ts-expect-error partial mock
      p.stderr = new EventEmitter();
      // @ts-expect-error partial mock
      p.stdout = null;
      setTimeout(() => p.emit("error", new Error("ENOENT: mlx_whisper not found")), 5);
      return p;
    });

    await expect(
      transcribeAudio({ audioPath: "/tmp/audio.wav" })
    ).rejects.toThrow("Failed to spawn mlx_whisper");
  });
});
