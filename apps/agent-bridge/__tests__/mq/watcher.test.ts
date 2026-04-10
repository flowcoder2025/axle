/**
 * Tests for MQ watcher (WI-118)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// ── Mock chokidar ─────────────────────────────────────────────────────────────

const mockFsWatcher = new EventEmitter() as ReturnType<typeof import("chokidar").watch>;
// @ts-expect-error partial mock
mockFsWatcher.close = vi.fn().mockResolvedValue(undefined);

vi.mock("chokidar", () => ({
  default: {
    watch: vi.fn(() => mockFsWatcher),
  },
}));

// ── Mock fs/promises ──────────────────────────────────────────────────────────

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue("<!-- job_id: abc -->\n\nHello Claude"),
}));

import { MqWatcher } from "../../src/mq/watcher.js";

describe("MqWatcher", () => {
  let watcher: MqWatcher;

  beforeEach(() => {
    watcher = new MqWatcher();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await watcher.stop();
  });

  it("starts with isWatching=false", () => {
    expect(watcher.isWatching).toBe(false);
  });

  it("sets isWatching=true after start()", async () => {
    await watcher.start(async () => undefined);
    expect(watcher.isWatching).toBe(true);
  });

  it("does not start twice", async () => {
    const chokidar = await import("chokidar");
    await watcher.start(async () => undefined);
    await watcher.start(async () => undefined); // second call should be no-op
    expect(chokidar.default.watch).toHaveBeenCalledTimes(1);
  });

  it("calls handler when 'add' event fires", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await watcher.start(handler);

    // Simulate chokidar detecting a new file
    mockFsWatcher.emit("add", "/test/.claude-mq/inbox/job-1.md");

    // Give the async handler time to fire
    await new Promise((r) => setTimeout(r, 20));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({
      filePath: "/test/.claude-mq/inbox/job-1.md",
      content: expect.stringContaining("Hello Claude"),
    });
  });

  it("emits inbox event when file is detected", async () => {
    const inboxEvents: unknown[] = [];
    watcher.on("inbox", (e) => inboxEvents.push(e));

    await watcher.start(async () => undefined);
    mockFsWatcher.emit("add", "/inbox/test.md");

    await new Promise((r) => setTimeout(r, 20));
    expect(inboxEvents).toHaveLength(1);
  });

  it("stops watching after stop()", async () => {
    await watcher.start(async () => undefined);
    await watcher.stop();
    expect(watcher.isWatching).toBe(false);
  });
});
