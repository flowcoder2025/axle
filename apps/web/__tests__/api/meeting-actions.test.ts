import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockActionItem = {
  findFirst: vi.fn(),
  update: vi.fn(),
};

const mockMeeting = {
  findFirst: vi.fn(),
};

const mockProject = {
  create: vi.fn(),
};

const mockClient = {
  findFirst: vi.fn(),
};

const mockChecklistTemplate = {
  findMany: vi.fn(),
};

const mockChecklistItem = {
  createMany: vi.fn(),
  findFirst: vi.fn(),
};

const mockEmailLog = {
  createMany: vi.fn(),
};

const mockContact = {
  findMany: vi.fn(),
};

const mockUser = {
  findMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    meeting: mockMeeting,
    actionItem: mockActionItem,
    project: mockProject,
    client: mockClient,
    checklistTemplate: mockChecklistTemplate,
    checklistItem: mockChecklistItem,
    emailLog: mockEmailLog,
    contact: mockContact,
    user: mockUser,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        project: mockProject,
        client: mockClient,
        checklistTemplate: mockChecklistTemplate,
        checklistItem: mockChecklistItem,
        actionItem: mockActionItem,
      };
      return fn(tx);
    }),
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

vi.mock("@axle/email", () => ({
  sendEmail: vi.fn(),
  meetingSummaryEmail: vi.fn().mockReturnValue("<p>Summary HTML</p>"),
}));

import { getCurrentUser } from "@axle/auth";
import { sendEmail, meetingSummaryEmail } from "@axle/email";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- POST /api/meetings/[meetingId]/actions/[actionId]/create-project ---

describe("POST /api/meetings/[meetingId]/actions/[actionId]/create-project", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-1/create-project", {
        projectType: "BUSINESS_PLAN",
        clientId: "c-1",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" });
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-1/create-project", {
        projectType: "BUSINESS_PLAN",
        clientId: "c-1",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when action item not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-999/create-project", {
        projectType: "BUSINESS_PLAN",
        clientId: "c-1",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-999" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 on missing projectType", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1", description: "Submit plan" });
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-1/create-project", {
        clientId: "c-1",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when client not in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1", description: "Submit plan" });
    mockClient.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-1/create-project", {
        projectType: "BUSINESS_PLAN",
        clientId: "c-unknown",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toMatch(/Client/i);
  });

  it("creates project using action item description as default title and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1", description: "Submit business plan" });
    mockClient.findFirst.mockResolvedValue({ id: "c-1" });
    const createdProject = {
      id: "p-1",
      title: "Submit business plan",
      type: "BUSINESS_PLAN",
      clientId: "c-1",
    };
    mockProject.create.mockResolvedValue(createdProject);
    mockChecklistTemplate.findMany.mockResolvedValue([]);
    mockActionItem.update.mockResolvedValue({ id: "ai-1" });

    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-1/create-project", {
        projectType: "BUSINESS_PLAN",
        clientId: "c-1",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("Submit business plan");
    expect(mockProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Submit business plan", type: "BUSINESS_PLAN" }),
      })
    );
  });

  it("uses custom title when provided", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1", description: "Submit business plan" });
    mockClient.findFirst.mockResolvedValue({ id: "c-1" });
    const createdProject = { id: "p-1", title: "Custom Title", type: "PATENT", clientId: "c-1" };
    mockProject.create.mockResolvedValue(createdProject);
    mockChecklistTemplate.findMany.mockResolvedValue([]);
    mockActionItem.update.mockResolvedValue({ id: "ai-1" });

    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-1/create-project", {
        projectType: "PATENT",
        clientId: "c-1",
        title: "Custom Title",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("Custom Title");
  });

  it("auto-applies checklist templates and links first item to action item", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1", description: "Submit plan" });
    mockClient.findFirst.mockResolvedValue({ id: "c-1" });
    const createdProject = { id: "p-1", title: "Submit plan", type: "BUSINESS_PLAN" };
    mockProject.create.mockResolvedValue(createdProject);
    const templates = [
      { id: "tpl-1", name: "체크1", description: null, isRequired: true, sortOrder: 0 },
    ];
    mockChecklistTemplate.findMany.mockResolvedValue(templates);
    mockChecklistItem.createMany.mockResolvedValue({ count: 1 });
    mockChecklistItem.findFirst.mockResolvedValue({ id: "ci-1" });
    mockActionItem.update.mockResolvedValue({ id: "ai-1", linkedChecklistId: "ci-1" });

    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/actions/[actionId]/create-project/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions/ai-1/create-project", {
        projectType: "BUSINESS_PLAN",
        clientId: "c-1",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(201);
    expect(mockChecklistItem.createMany).toHaveBeenCalled();
    expect(mockActionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkedChecklistId: "ci-1" }),
      })
    );
  });
});

// --- POST /api/meetings/[meetingId]/send-summary ---

describe("POST /api/meetings/[meetingId]/send-summary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/meetings/[meetingId]/send-summary/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/send-summary") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue(null);
    const { POST } = await import("../../app/api/meetings/[meetingId]/send-summary/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-999/send-summary") as never,
      { params: Promise.resolve({ meetingId: "m-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 when no attendee emails found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue({
      id: "m-1",
      title: "Q1 Review",
      date: new Date("2025-01-15T10:00:00.000Z"),
      clientId: "c-1",
      attendees: [],
      transcript: null,
      actionItems: [],
    });
    mockContact.findMany.mockResolvedValue([]);
    mockUser.findMany.mockResolvedValue([]);

    const { POST } = await import("../../app/api/meetings/[meetingId]/send-summary/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/send-summary") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("NO_RECIPIENTS");
  });

  it("sends emails to all attendees and creates EmailLog records", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue({
      id: "m-1",
      title: "Q1 Review",
      date: new Date("2025-01-15T10:00:00.000Z"),
      clientId: "c-1",
      attendees: [
        { name: "Kim Soo", contactId: "cnt-1", userId: null },
        { name: "Lee Jun", contactId: null, userId: "usr-2" },
      ],
      transcript: { summary: "We discussed Q1 goals." },
      actionItems: [{ description: "Send report", status: "OPEN" }],
    });
    mockContact.findMany.mockResolvedValue([{ email: "kim@example.com" }]);
    mockUser.findMany.mockResolvedValue([{ email: "lee@example.com" }]);
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ id: "resend-1" })
      .mockResolvedValueOnce({ id: "resend-2" });
    mockEmailLog.createMany.mockResolvedValue({ count: 2 });

    const { POST } = await import("../../app/api/meetings/[meetingId]/send-summary/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/send-summary") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sent).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(mockEmailLog.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ to: "kim@example.com", type: "MEETING_SUMMARY" }),
          expect.objectContaining({ to: "lee@example.com", type: "MEETING_SUMMARY" }),
        ]),
      })
    );
  });

  it("uses meetingSummaryEmail template", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue({
      id: "m-1",
      title: "Strategy Meeting",
      date: new Date("2025-02-01T09:00:00.000Z"),
      clientId: "c-1",
      attendees: [{ name: "Park", contactId: null, userId: "usr-1" }],
      transcript: { summary: "Discussed strategy." },
      actionItems: [],
    });
    mockContact.findMany.mockResolvedValue([]);
    mockUser.findMany.mockResolvedValue([{ email: "park@example.com" }]);
    vi.mocked(sendEmail).mockResolvedValue({ id: "resend-1" });
    mockEmailLog.createMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("../../app/api/meetings/[meetingId]/send-summary/route");
    await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/send-summary") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );

    expect(meetingSummaryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingTitle: "Strategy Meeting",
        summary: "Discussed strategy.",
        attendees: ["Park"],
        actionItems: [],
      })
    );
  });

  it("skips attendees with no email and returns partial sent count", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue({
      id: "m-1",
      title: "Team Sync",
      date: new Date("2025-03-01T14:00:00.000Z"),
      clientId: "c-1",
      attendees: [
        { name: "No Email", contactId: "cnt-1", userId: null },
        { name: "Has Email", contactId: null, userId: "usr-1" },
      ],
      transcript: null,
      actionItems: [],
    });
    // Contact has no email
    mockContact.findMany.mockResolvedValue([{ email: null }]);
    mockUser.findMany.mockResolvedValue([{ email: "has@example.com" }]);
    vi.mocked(sendEmail).mockResolvedValue({ id: "resend-1" });
    mockEmailLog.createMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("../../app/api/meetings/[meetingId]/send-summary/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/send-summary") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
