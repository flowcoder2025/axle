/**
 * Tests for recorder IPC handlers (WI-126).
 * Mocks Electron's ipcMain so we can run in Node/Vitest without Electron.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock electron before importing the handler module
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers = new Map<string, IpcHandler>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: IpcHandler) => {
      handlers.set(channel, fn);
    },
  },
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    killed: false,
    kill: vi.fn(),
    once: vi.fn((_event: string, cb: () => void) => setImmediate(cb)),
  })),
}));

vi.mock("fs", () => ({
  statSync: vi.fn(() => ({ size: 44 })),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

import { registerRecorderHandlers, resetRecorderState, buildWavHeader } from "../src/main/ipc/recorder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const invoke = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for channel: ${channel}`);
  return handler(null, ...args);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Recorder IPC handlers", () => {
  beforeEach(() => {
    handlers.clear();
    resetRecorderState();
    registerRecorderHandlers();
  });

  it("initial state is idle", async () => {
    const state = await invoke("recorder:getState");
    expect(state).toEqual({ status: "idle", durationMs: 0 });
  });

  it("start creates a recording session", async () => {
    await invoke("recorder:start");
    const state = await invoke("recorder:getState") as { status: string };
    expect(state.status).toBe("recording");
  });

  it("stop returns RecordingInfo with filePath", async () => {
    await invoke("recorder:start");
    const info = await invoke("recorder:stop") as { filePath: string; durationMs: number; sampleRate: number; channels: number };
    expect(info.filePath).toContain("axle-recording-");
    expect(info.filePath.endsWith(".wav")).toBe(true);
    expect(info.sampleRate).toBe(44100);
    expect(info.channels).toBe(2);
    expect(typeof info.durationMs).toBe("number");
  });

  it("stop resets state to null (subsequent getState is idle)", async () => {
    await invoke("recorder:start");
    await invoke("recorder:stop");
    const state = await invoke("recorder:getState") as { status: string };
    expect(state.status).toBe("idle");
  });

  it("double start throws", async () => {
    await invoke("recorder:start");
    await expect(invoke("recorder:start")).rejects.toThrow("already in progress");
  });

  it("stop without start throws", async () => {
    await expect(invoke("recorder:stop")).rejects.toThrow("No active recording");
  });

  it("pause changes status to paused", async () => {
    await invoke("recorder:start");
    await invoke("recorder:pause");
    const state = await invoke("recorder:getState") as { status: string };
    expect(state.status).toBe("paused");
  });

  it("resume after pause returns to recording", async () => {
    await invoke("recorder:start");
    await invoke("recorder:pause");
    await invoke("recorder:resume");
    const state = await invoke("recorder:getState") as { status: string };
    expect(state.status).toBe("recording");
  });

  it("pause when not recording throws", async () => {
    await expect(invoke("recorder:pause")).rejects.toThrow("Not recording");
  });

  it("resume when not paused throws", async () => {
    await expect(invoke("recorder:resume")).rejects.toThrow("Not paused");
  });
});

describe("buildWavHeader", () => {
  it("produces a 44-byte buffer with RIFF/WAVE markers", () => {
    const buf = buildWavHeader(0, 44100, 2);
    expect(buf.length).toBe(44);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buf.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(buf.subarray(12, 16).toString("ascii")).toBe("fmt ");
    expect(buf.subarray(36, 40).toString("ascii")).toBe("data");
  });

  it("encodes sampleRate and channels correctly", () => {
    const buf = buildWavHeader(1000, 16000, 1);
    expect(buf.readUInt32LE(24)).toBe(16000); // sampleRate
    expect(buf.readUInt16LE(22)).toBe(1);      // channels
    expect(buf.readUInt32LE(40)).toBe(1000);   // data length
  });
});
