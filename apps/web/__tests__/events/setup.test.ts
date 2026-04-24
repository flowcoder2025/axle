import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
vi.mock("@axle/notification", () => ({
  dispatch: mockDispatch,
}));

const mockProjectFindUnique = vi.fn();
vi.mock("@axle/db", () => ({
  prisma: {
    project: { findUnique: mockProjectFindUnique },
  },
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("setupEventHandlers()", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    mockDispatch.mockResolvedValue(undefined);
    mockProjectFindUnique.mockResolvedValue(null);

    // Reset module state so each test starts with a fresh setup
    const setup = await import("../../lib/events/setup.js");
    setup.resetEventHandlers();
  });

  async function setup() {
    const mod = await import("../../lib/events/setup.js");
    mod.setupEventHandlers();
    return mod;
  }

  it("registers DOC_UPLOADED → dispatches with correct event key", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    await eventBus.emit("DOC_UPLOADED", {
      documentId: "doc-1",
      clientId: "client-1",
      uploaderId: "user-1",
    });

    expect(mockDispatch).toHaveBeenCalledOnce();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "DOC_UPLOADED" })
    );
  });

  it("registers PROJECT_ASSIGNED → passes projectId in link", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    await eventBus.emit("PROJECT_ASSIGNED", {
      projectId: "proj-42",
      userId: "user-1",
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "PROJECT_ASSIGNED",
        link: "/projects/proj-42",
        recipientUserIds: ["user-1"],
      })
    );
  });

  it("registers HANDOFF → passes toUserId as recipientUserId", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    await eventBus.emit("HANDOFF", {
      projectId: "proj-1",
      fromUserId: "user-from",
      toUserId: "user-to",
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "HANDOFF",
        recipientUserIds: ["user-to"],
      })
    );
  });

  it("registers DEADLINE_APPROACHING → passes all assigneeIds", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    await eventBus.emit("DEADLINE_APPROACHING", {
      projectId: "proj-1",
      deadlineAt: new Date("2025-06-30"),
      assigneeIds: ["user-1", "user-2", "user-3"],
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "DEADLINE_APPROACHING",
        recipientUserIds: ["user-1", "user-2", "user-3"],
      })
    );
  });

  it("registers AI_JOB_FAILED → includes errorMessage in body", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    await eventBus.emit("AI_JOB_FAILED", {
      jobId: "job-99",
      jobType: "analysis",
      assigneeId: "user-1",
      errorMessage: "timeout exceeded",
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "AI_JOB_FAILED",
        body: expect.stringContaining("timeout exceeded"),
      })
    );
  });

  it("is idempotent — calling setupEventHandlers twice does not double-register", async () => {
    const mod = await import("../../lib/events/setup.js");
    mod.setupEventHandlers();
    mod.setupEventHandlers(); // second call is a no-op

    const { eventBus } = await import("../../lib/events/event-bus.js");

    await eventBus.emit("AI_JOB_COMPLETE", {
      jobId: "job-1",
      jobType: "ocr",
      assigneeId: "user-1",
    });

    // Should be called exactly once, not twice
    expect(mockDispatch).toHaveBeenCalledOnce();
  });

  // ── PROJECT_COMPLETED (WI-325F) ────────────────────────────────────────────

  it("PROJECT_COMPLETED on BUNDLE → dispatches BUNDLE_COMPLETED to assignee", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    mockProjectFindUnique.mockResolvedValueOnce({
      title: "JET 번들 인증",
      assignedToId: "user-lead",
      client: { name: "JET Corp" },
    });

    await eventBus.emit("PROJECT_COMPLETED", {
      projectId: "bundle-1",
      projectType: "BUNDLE",
      clientId: "client-1",
      completedAt: new Date(),
      certificateCreated: false,
      certificateId: null,
    });

    expect(mockDispatch).toHaveBeenCalledOnce();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "BUNDLE_COMPLETED",
        recipientUserIds: ["user-lead"],
        link: "/projects/bundle-1",
      }),
    );
    const call = mockDispatch.mock.calls[0][0];
    expect(call.body).toContain("JET Corp");
    expect(call.body).toContain("JET 번들 인증");
    expect(call.metadata).toMatchObject({
      projectId: "bundle-1",
      clientId: "client-1",
      certificateCreated: false,
    });
  });

  it("PROJECT_COMPLETED on BUNDLE with no assignee → does not dispatch", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    mockProjectFindUnique.mockResolvedValueOnce({
      title: "무할당 번들",
      assignedToId: null,
      client: { name: "X" },
    });

    await eventBus.emit("PROJECT_COMPLETED", {
      projectId: "bundle-2",
      projectType: "BUNDLE",
      clientId: "client-1",
      completedAt: new Date(),
      certificateCreated: false,
      certificateId: null,
    });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("PROJECT_COMPLETED on BUNDLE with missing project row → does not dispatch", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    mockProjectFindUnique.mockResolvedValueOnce(null);

    await eventBus.emit("PROJECT_COMPLETED", {
      projectId: "gone",
      projectType: "BUNDLE",
      clientId: "client-1",
      completedAt: new Date(),
      certificateCreated: false,
      certificateId: null,
    });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("PROJECT_COMPLETED on non-BUNDLE projects → does not dispatch (no notification path)", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    await eventBus.emit("PROJECT_COMPLETED", {
      projectId: "venture-1",
      projectType: "VENTURE_CERT",
      clientId: "client-1",
      completedAt: new Date(),
      certificateCreated: true,
      certificateId: "cert-1",
    });

    expect(mockDispatch).not.toHaveBeenCalled();
    // Should not even probe the DB for non-BUNDLE types
    expect(mockProjectFindUnique).not.toHaveBeenCalled();
  });

  it("all 14 events are registered and dispatch is called for each", async () => {
    await setup();
    const { eventBus } = await import("../../lib/events/event-bus.js");

    const events = [
      () =>
        eventBus.emit("DOC_UPLOADED", {
          documentId: "d1",
          clientId: "c1",
          uploaderId: "u1",
        }),
      () =>
        eventBus.emit("DOC_REQUESTED", {
          checklistItemId: "ci1",
          clientId: "c1",
        }),
      () =>
        eventBus.emit("DOC_EXPIRING", {
          documentId: "d1",
          clientId: "c1",
          expiresAt: new Date(),
        }),
      () =>
        eventBus.emit("DEADLINE_APPROACHING", {
          projectId: "p1",
          deadlineAt: new Date(),
          assigneeIds: ["u1"],
        }),
      () =>
        eventBus.emit("MEETING_SCHEDULED", {
          meetingId: "m1",
          projectId: "p1",
          attendeeIds: ["u1"],
          scheduledAt: new Date(),
        }),
      () =>
        eventBus.emit("JOURNAL_DUE", {
          journalId: "j1",
          clientId: "c1",
          dueAt: new Date(),
        }),
      () =>
        eventBus.emit("ACTION_ITEM_CREATED", {
          actionItemId: "ai1",
          projectId: "p1",
          assigneeId: "u1",
        }),
      () =>
        eventBus.emit("ACTION_ITEM_DUE", {
          actionItemId: "ai1",
          projectId: "p1",
          assigneeId: "u1",
          dueAt: new Date(),
        }),
      () =>
        eventBus.emit("PROJECT_ASSIGNED", { projectId: "p1", userId: "u1" }),
      () =>
        eventBus.emit("MATCHING_RESULT", {
          matchingId: "mr1",
          assigneeId: "u1",
          score: 80,
        }),
      () =>
        eventBus.emit("AI_JOB_COMPLETE", {
          jobId: "j1",
          jobType: "ocr",
          assigneeId: "u1",
        }),
      () =>
        eventBus.emit("AI_JOB_FAILED", {
          jobId: "j1",
          jobType: "ocr",
          assigneeId: "u1",
          errorMessage: "err",
        }),
      () =>
        eventBus.emit("PORTAL_COMPLETE", {
          portalId: "po1",
          clientId: "c1",
          assigneeId: "u1",
        }),
      () =>
        eventBus.emit("HANDOFF", {
          projectId: "p1",
          fromUserId: "u1",
          toUserId: "u2",
        }),
    ];

    for (const emitFn of events) {
      await emitFn();
    }

    expect(mockDispatch).toHaveBeenCalledTimes(14);
  });
});
