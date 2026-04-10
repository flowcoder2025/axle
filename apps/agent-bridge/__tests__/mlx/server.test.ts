/**
 * Tests for MlxServerManager (WI-116)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// ── Mock child_process ────────────────────────────────────────────────────────

const mockProcess = new EventEmitter() as ReturnType<typeof import("node:child_process").spawn>;
// @ts-expect-error partial mock
mockProcess.pid = 12345;
// @ts-expect-error partial mock
mockProcess.killed = false;
// @ts-expect-error partial mock
mockProcess.kill = vi.fn(() => true);
// @ts-expect-error partial mock
mockProcess.stdout = new EventEmitter();
// @ts-expect-error partial mock
mockProcess.stderr = new EventEmitter();

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockProcess),
}));

// Mock fetch for health check
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ── Import after mocks ────────────────────────────────────────────────────────

// Reset module to get a fresh manager instance
const { MlxServerManager } = await import("../../src/mlx/server.js");

describe("MlxServerManager", () => {
  let manager: InstanceType<typeof MlxServerManager>;

  beforeEach(() => {
    manager = new MlxServerManager();
    vi.clearAllMocks();
    // @ts-expect-error reset killed flag
    mockProcess.killed = false;
  });

  afterEach(async () => {
    await manager.stop();
  });

  it("starts in stopped state", () => {
    expect(manager.state.status).toBe("stopped");
    expect(manager.state.restartCount).toBe(0);
  });

  it("transitions to starting when start() is called", async () => {
    const startPromise = manager.start();
    // Just starting — not yet 'running' until stdout signals
    expect(manager.state.status === "starting" || manager.state.status === "running").toBe(true);
    await startPromise;
  });

  it("does not spawn a second process if already starting", async () => {
    const { spawn } = await import("node:child_process");
    await manager.start();
    await manager.start(); // second call should be a no-op
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("healthCheck returns false when fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const ok = await manager.healthCheck();
    expect(ok).toBe(false);
  });

  it("healthCheck returns true when server responds 2xx", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    const ok = await manager.healthCheck();
    expect(ok).toBe(true);
  });

  it("transitions to running when stdout emits startup signal", async () => {
    await manager.start();

    const runningPromise = new Promise<void>((resolve) =>
      manager.once("started", resolve)
    );

    // Simulate mlx_lm writing startup line to stdout
    (mockProcess.stdout as EventEmitter).emit(
      "data",
      Buffer.from("Application startup complete")
    );

    await runningPromise;
    expect(manager.state.status).toBe("running");
    expect(manager.state.pid).toBe(12345);
  });

  it("transitions to error when process exits unexpectedly", async () => {
    await manager.start();

    const errorPromise = new Promise<void>((resolve) =>
      manager.once("exit", resolve)
    );

    mockProcess.emit("exit", 1, null);
    await errorPromise;

    expect(manager.state.status).toBe("error");
  });

  it("stops and sets status to stopped", async () => {
    await manager.start();
    await manager.stop();
    expect(manager.state.status).toBe("stopped");
  });
});
