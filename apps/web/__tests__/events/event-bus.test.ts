import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypedEventEmitter, eventBus } from "../../lib/events/event-bus.js";

// ── TypedEventEmitter unit tests ───────────────────────────────────────────

describe("TypedEventEmitter", () => {
  let emitter: TypedEventEmitter;

  beforeEach(() => {
    emitter = new TypedEventEmitter();
  });

  describe("on() / emit()", () => {
    it("calls a registered handler with the correct payload", async () => {
      const handler = vi.fn();
      emitter.on("DOC_UPLOADED", handler);

      const payload = {
        documentId: "doc-1",
        clientId: "client-1",
        uploaderId: "user-1",
      };
      await emitter.emit("DOC_UPLOADED", payload);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("calls multiple handlers for the same event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on("PROJECT_ASSIGNED", handler1);
      emitter.on("PROJECT_ASSIGNED", handler2);

      await emitter.emit("PROJECT_ASSIGNED", {
        projectId: "proj-1",
        userId: "user-1",
      });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("does not call handlers for a different event", async () => {
      const handler = vi.fn();
      emitter.on("DOC_UPLOADED", handler);

      await emitter.emit("HANDOFF", {
        projectId: "proj-1",
        fromUserId: "user-1",
        toUserId: "user-2",
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("resolves immediately when no handlers are registered", async () => {
      await expect(
        emitter.emit("MATCHING_RESULT", {
          matchingId: "m-1",
          assigneeId: "user-1",
          score: 90,
        })
      ).resolves.toBeUndefined();
    });

    it("awaits async handlers", async () => {
      const order: number[] = [];
      emitter.on("AI_JOB_COMPLETE", async () => {
        await Promise.resolve();
        order.push(1);
      });
      emitter.on("AI_JOB_COMPLETE", async () => {
        order.push(2);
      });

      await emitter.emit("AI_JOB_COMPLETE", {
        jobId: "job-1",
        jobType: "analysis",
        assigneeId: "user-1",
      });

      expect(order).toEqual([1, 2]);
    });
  });

  describe("off()", () => {
    it("removes a handler so it no longer receives events", async () => {
      const handler = vi.fn();
      emitter.on("HANDOFF", handler);
      emitter.off("HANDOFF", handler);

      await emitter.emit("HANDOFF", {
        projectId: "proj-1",
        fromUserId: "user-1",
        toUserId: "user-2",
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("does not affect other handlers for the same event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on("HANDOFF", handler1);
      emitter.on("HANDOFF", handler2);
      emitter.off("HANDOFF", handler1);

      await emitter.emit("HANDOFF", {
        projectId: "proj-1",
        fromUserId: "user-1",
        toUserId: "user-2",
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe("removeAllListeners()", () => {
    it("removes all handlers for a specific event", async () => {
      const handler = vi.fn();
      emitter.on("PORTAL_COMPLETE", handler);
      emitter.removeAllListeners("PORTAL_COMPLETE");

      await emitter.emit("PORTAL_COMPLETE", {
        portalId: "portal-1",
        clientId: "client-1",
        assigneeId: "user-1",
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("removes all handlers for all events when called without argument", async () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      emitter.on("DOC_EXPIRING", h1);
      emitter.on("AI_JOB_FAILED", h2);
      emitter.removeAllListeners();

      await emitter.emit("DOC_EXPIRING", {
        documentId: "doc-1",
        clientId: "client-1",
        expiresAt: new Date(),
      });
      await emitter.emit("AI_JOB_FAILED", {
        jobId: "job-1",
        jobType: "ocr",
        assigneeId: "user-1",
        errorMessage: "timeout",
      });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });
  });

  describe("error isolation", () => {
    it("logs errors from a failing handler and continues to the next", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const failingHandler = vi.fn().mockRejectedValue(new Error("boom"));
      const nextHandler = vi.fn();

      emitter.on("DEADLINE_APPROACHING", failingHandler);
      emitter.on("DEADLINE_APPROACHING", nextHandler);

      await emitter.emit("DEADLINE_APPROACHING", {
        projectId: "proj-1",
        deadlineAt: new Date(),
        assigneeIds: ["user-1"],
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("DEADLINE_APPROACHING")
      );
      expect(nextHandler).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });
  });
});

// ── Singleton eventBus smoke test ──────────────────────────────────────────

describe("eventBus singleton", () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  it("is an instance of TypedEventEmitter", () => {
    expect(eventBus).toBeInstanceOf(TypedEventEmitter);
  });

  it("can emit and receive events", async () => {
    const handler = vi.fn();
    eventBus.on("MEETING_SCHEDULED", handler);

    const payload = {
      meetingId: "mtg-1",
      projectId: "proj-1",
      attendeeIds: ["user-1", "user-2"],
      scheduledAt: new Date("2025-06-01T10:00:00Z"),
    };
    await eventBus.emit("MEETING_SCHEDULED", payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });
});
