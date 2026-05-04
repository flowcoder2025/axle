import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockChecklistItem = { findMany: vi.fn() };
const mockDocument = { findMany: vi.fn() };
const mockDocumentEmbedding = { findMany: vi.fn() };
const mockProgramInfo = { findMany: vi.fn() };
const mockMatchingResult = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
};
const mockContact = { findMany: vi.fn() };
const mockResearchJournal = { findMany: vi.fn() };
const mockAccount = { findMany: vi.fn() };
const mockUser = { findMany: vi.fn() };
const mockClient = { findMany: vi.fn(), findFirst: vi.fn() };
const mockNotification = { count: vi.fn() };
const mockProject = { findFirst: vi.fn() };
const mockActionItem = { findMany: vi.fn() };

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    checklistItem: mockChecklistItem,
    document: mockDocument,
    documentEmbedding: mockDocumentEmbedding,
    programInfo: mockProgramInfo,
    matchingResult: mockMatchingResult,
    contact: mockContact,
    researchJournal: mockResearchJournal,
    account: mockAccount,
    user: mockUser,
    client: mockClient,
    notification: mockNotification,
    project: mockProject,
    actionItem: mockActionItem,
  },
}));

const mockCreate = vi.fn();
const mockSendTelegramToDefault = vi.fn();

vi.mock("@axle/notification", () => ({
  NOTIFICATION_PACKAGE: "@axle/notification",
  create: mockCreate,
  sendTelegramToDefault: mockSendTelegramToDefault,
}));

const mockSendEmail = vi.fn();
const mockDocRequestEmail = vi.fn().mockReturnValue("<html>doc-request</html>");
const mockJournalReminderEmail = vi.fn().mockReturnValue("<html>journal-reminder</html>");
const mockDeadlineAlertEmail = vi.fn().mockReturnValue("<html>deadline-alert</html>");
const mockMatchingDigestEmail = vi.fn().mockReturnValue("<html>matching-digest</html>");

vi.mock("@axle/email", () => ({
  EMAIL_PACKAGE: "@axle/email",
  sendEmail: mockSendEmail,
  docRequestEmail: mockDocRequestEmail,
  journalReminderEmail: mockJournalReminderEmail,
  deadlineAlertEmail: mockDeadlineAlertEmail,
  matchingDigestEmail: mockMatchingDigestEmail,
}));

const mockMatchClientToPrograms = vi.fn();

vi.mock("@axle/matching", () => ({
  matchClientToPrograms: mockMatchClientToPrograms,
}));

const mockGenerateEmbedding = vi.fn();
const mockUpsertEmbedding = vi.fn();

vi.mock("@axle/ai", () => ({
  generateEmbedding: mockGenerateEmbedding,
  upsertEmbedding: mockUpsertEmbedding,
  // Builtin handlers register journal-draft which imports completeWithFallback
  // at module load time. Even cron tests that don't exercise journal-draft
  // need this export defined to keep the mock surface complete.
  completeWithFallback: vi.fn(),
}));

const mockSyncCalendar = vi.fn();

vi.mock("../../../lib/services/google-calendar", () => ({
  syncCalendar: mockSyncCalendar,
}));

// --- Helpers ---

function makeRequest(method = "POST", authToken?: string): Request {
  const headers: Record<string, string> = {};
  if (authToken !== undefined) {
    headers["authorization"] = `Bearer ${authToken}`;
  }
  return new Request("http://localhost/api/cron/test", { method, headers });
}

function authedRequest(): Request {
  return makeRequest("POST", "test-secret");
}

// Set CRON_SECRET for all tests
process.env.CRON_SECRET = "test-secret";
process.env.NEXT_PUBLIC_APP_URL = "https://app.axle.kr";

// --- cron-auth ---

describe("verifyCronAuth", () => {
  it("returns true for correct Bearer token", async () => {
    const { verifyCronAuth } = await import("../../../lib/cron-auth");
    const req = authedRequest();
    expect(verifyCronAuth(req)).toBe(true);
  });

  it("returns false for wrong token", async () => {
    const { verifyCronAuth } = await import("../../../lib/cron-auth");
    const req = makeRequest("POST", "wrong-secret");
    expect(verifyCronAuth(req)).toBe(false);
  });

  it("returns false when authorization header is missing", async () => {
    const { verifyCronAuth } = await import("../../../lib/cron-auth");
    const req = makeRequest("POST");
    expect(verifyCronAuth(req)).toBe(false);
  });
});

// --- WI-132: doc-reminder ---

describe("POST /api/cron/doc-reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth is missing", async () => {
    const { POST } = await import(
      "../../../app/api/cron/doc-reminder/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("returns success with processed=0 when no items", async () => {
    mockChecklistItem.findMany.mockResolvedValue([]);
    const { POST } = await import(
      "../../../app/api/cron/doc-reminder/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, processed: 0 });
  });

  it("sends email and notification for each overdue item", async () => {
    const item = {
      id: "item-1",
      name: "사업계획서",
      projectId: "proj-1",
      project: {
        assignedToId: "user-1",
        client: { id: "client-1", name: "테스트기업", email: "test@example.com" },
      },
    };
    mockChecklistItem.findMany.mockResolvedValue([item]);
    mockSendEmail.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({});

    const { POST } = await import(
      "../../../app/api/cron/doc-reminder/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DOC_REQUESTED", userId: "user-1" })
    );
  });

  it("skips email when client has no email", async () => {
    const item = {
      id: "item-2",
      name: "사업계획서",
      projectId: "proj-2",
      project: {
        assignedToId: "user-1",
        client: { id: "client-2", name: "테스트기업", email: null },
      },
    };
    mockChecklistItem.findMany.mockResolvedValue([item]);
    mockCreate.mockResolvedValue({});

    const { POST } = await import(
      "../../../app/api/cron/doc-reminder/route"
    );
    await POST(authedRequest());
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

// --- WI-133: deadline-alert ---

describe("POST /api/cron/deadline-alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults so the route's secondary sweeps (project lookup, action-item
    // due-soon) don't throw before the asserted code path runs.
    mockProject.findFirst.mockResolvedValue(null);
    mockActionItem.findMany.mockResolvedValue([]);
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/deadline-alert/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("returns processed=0 when no programs found", async () => {
    mockProgramInfo.findMany.mockResolvedValue([]);
    const { POST } = await import(
      "../../../app/api/cron/deadline-alert/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();
    expect(body).toEqual({ success: true, processed: 0 });
  });

  it("sends notification for matching results with score > 50", async () => {
    const deadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    mockProgramInfo.findMany.mockResolvedValue([
      { id: "prog-1", name: "중소기업 R&D", applicationEnd: deadline },
    ]);
    mockMatchingResult.findMany.mockResolvedValue([
      {
        id: "mr-1",
        clientId: "client-1",
        programId: "prog-1",
        score: 75,
        program: { id: "prog-1", name: "중소기업 R&D", applicationEnd: deadline },
      },
    ]);
    mockClient.findFirst.mockResolvedValue({
      id: "client-1",
      name: "테스트기업",
      email: "test@example.com",
      assignedToId: "user-1",
    });
    mockCreate.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    const { POST } = await import(
      "../../../app/api/cron/deadline-alert/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DEADLINE", userId: "user-1" })
    );
  });

  it("sends Telegram alert for D-7 deadlines", async () => {
    const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // D-5
    mockProgramInfo.findMany.mockResolvedValue([
      { id: "prog-2", name: "창업성장 기술개발", applicationEnd: deadline },
    ]);
    mockMatchingResult.findMany.mockResolvedValue([
      {
        id: "mr-2",
        clientId: "client-2",
        programId: "prog-2",
        score: 80,
        program: { id: "prog-2", name: "창업성장 기술개발", applicationEnd: deadline },
      },
    ]);
    mockClient.findFirst.mockResolvedValue({
      id: "client-2",
      name: "스타트업A",
      email: null,
      assignedToId: "user-2",
    });
    mockCreate.mockResolvedValue({});
    mockSendTelegramToDefault.mockResolvedValue(undefined);

    const { POST } = await import(
      "../../../app/api/cron/deadline-alert/route"
    );
    await POST(authedRequest());
    expect(mockSendTelegramToDefault).toHaveBeenCalledOnce();
  });
});

// --- WI-134: journal-remind ---

describe("POST /api/cron/journal-remind", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/journal-remind/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("skips researchers who already wrote a journal this month", async () => {
    mockResearchJournal.findMany.mockResolvedValue([
      { researcherContactId: "contact-1" },
    ]);
    mockContact.findMany.mockResolvedValue([
      {
        id: "contact-1",
        name: "홍길동",
        email: "hong@example.com",
        client: { name: "기업A" },
      },
    ]);

    const { POST } = await import(
      "../../../app/api/cron/journal-remind/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.processed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends reminder to researchers without journals this month", async () => {
    mockResearchJournal.findMany.mockResolvedValue([]);
    mockContact.findMany.mockResolvedValue([
      {
        id: "contact-2",
        name: "김연구",
        email: "kim@example.com",
        client: { name: "기업B" },
      },
    ]);
    mockSendEmail.mockResolvedValue(undefined);

    const { POST } = await import(
      "../../../app/api/cron/journal-remind/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockJournalReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ researcherName: "김연구", clientName: "기업B" })
    );
  });
});

// --- WI-135: doc-expiry ---

describe("POST /api/cron/doc-expiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/doc-expiry/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("creates DOC_EXPIRING notification for expiring documents", async () => {
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    mockDocument.findMany.mockResolvedValue([
      {
        id: "doc-1",
        name: "법인등기부등본",
        clientId: "client-1",
        expiresAt,
        client: { id: "client-1", name: "테스트기업", assignedToId: "user-1" },
      },
    ]);
    mockCreate.mockResolvedValue({});

    const { POST } = await import(
      "../../../app/api/cron/doc-expiry/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DOC_EXPIRING", userId: "user-1" })
    );
  });

  it("skips documents with no assigned consultant", async () => {
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    mockDocument.findMany.mockResolvedValue([
      {
        id: "doc-2",
        name: "사업자등록증",
        clientId: "client-2",
        expiresAt,
        client: { id: "client-2", name: "기업B", assignedToId: null },
      },
    ]);

    const { POST } = await import(
      "../../../app/api/cron/doc-expiry/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.processed).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// --- WI-136: schedule-sync ---

describe("POST /api/cron/schedule-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/schedule-sync/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("calls syncCalendar for orgs with connected google accounts", async () => {
    mockAccount.findMany.mockResolvedValue([
      {
        provider: "google",
        access_token: "acc-token",
        refresh_token: "ref-token",
        user: {
          memberships: [{ organizationId: "org-1" }],
        },
      },
    ]);
    mockSyncCalendar.mockResolvedValue({ pushed: 2, pulled: 1 });

    const { POST } = await import(
      "../../../app/api/cron/schedule-sync/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockSyncCalendar).toHaveBeenCalledWith(
      "org-1",
      { accessToken: "acc-token", refreshToken: "ref-token" }
    );
  });

  it("deduplicates orgs with multiple google accounts", async () => {
    mockAccount.findMany.mockResolvedValue([
      {
        provider: "google",
        access_token: "acc-1",
        refresh_token: "ref-1",
        user: { memberships: [{ organizationId: "org-1" }] },
      },
      {
        provider: "google",
        access_token: "acc-2",
        refresh_token: "ref-2",
        user: { memberships: [{ organizationId: "org-1" }] }, // same org
      },
    ]);
    mockSyncCalendar.mockResolvedValue({ pushed: 0, pulled: 0 });

    const { POST } = await import(
      "../../../app/api/cron/schedule-sync/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.processed).toBe(1); // deduplicated to 1
    expect(mockSyncCalendar).toHaveBeenCalledOnce();
  });
});

// --- WI-137/211-213: crawler-execute ---
//
// Detailed tests (pagination, retries, upsert, AutomationLog) live in
// __tests__/api/cron/crawler-execute.test.ts with fully mocked @axle/crawler
// and @axle/db. Here we only keep the auth gate + "no keys configured"
// behaviour so this file does not need to mock the crawler package.

describe("POST /api/cron/crawler-execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BIZINFO_API_KEY;
    delete process.env.KSTARTUP_API_KEY;
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/crawler-execute/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("returns empty sources when no API keys are configured", async () => {
    const { POST } = await import(
      "../../../app/api/cron/crawler-execute/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.sources).toEqual([]);
    expect(typeof body.totalDuration).toBe("number");
  });
});

// --- WI-138: matching-refresh ---

describe("POST /api/cron/matching-refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/matching-refresh/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("returns processed=0 when no active clients", async () => {
    mockClient.findMany.mockResolvedValue([]);

    const { POST } = await import(
      "../../../app/api/cron/matching-refresh/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body).toEqual({ success: true, processed: 0 });
  });

  it("re-runs matching and upserts results for each active client", async () => {
    mockClient.findMany.mockResolvedValue([
      {
        id: "client-1",
        orgId: "org-1",
        name: "테스트기업",
        industry: "IT",
        region: "서울",
        employeeCount: 50,
        isVenture: true,
        isInnoBiz: false,
        certificates: [],
        financials: [{ revenue: 500000000, year: 2024 }],
      },
    ]);
    mockProgramInfo.findMany.mockResolvedValue([
      {
        id: "prog-1",
        name: "중소기업 R&D",
        category: "RND",
        region: null,
        maxFunding: null,
        requirements: null,
        eligibility: null,
      },
    ]);
    mockMatchClientToPrograms.mockReturnValue([
      {
        programId: "prog-1",
        programName: "중소기업 R&D",
        score: 85,
        isDisqualified: false,
        disqualifyReasons: [],
        penalties: [],
        matchReasons: ["벤처기업 가점"],
      },
    ]);
    mockMatchingResult.findFirst.mockResolvedValue(null);
    mockMatchingResult.create.mockResolvedValue({});

    const { POST } = await import(
      "../../../app/api/cron/matching-refresh/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockMatchingResult.create).toHaveBeenCalledOnce();
  });
});

// --- WI-139: embedding-generate ---

describe("POST /api/cron/embedding-generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/embedding-generate/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("skips already embedded documents", async () => {
    mockDocumentEmbedding.findMany.mockResolvedValue([
      { sourceId: "doc-1" },
    ]);
    mockDocument.findMany.mockResolvedValue([]); // excluded by notIn filter

    const { POST } = await import(
      "../../../app/api/cron/embedding-generate/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.processed).toBe(0);
    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
  });

  it("generates and upserts embeddings for documents without embeddings", async () => {
    mockDocumentEmbedding.findMany.mockResolvedValue([]);
    mockDocument.findMany.mockResolvedValue([
      {
        id: "doc-2",
        name: "사업계획서",
        category: "BUSINESS_PLAN",
        ocrResult: { text: "사업 계획 내용입니다." },
      },
    ]);
    const fakeEmbedding = Array.from({ length: 1536 }, () => 0.1);
    mockGenerateEmbedding.mockResolvedValue(fakeEmbedding);
    mockUpsertEmbedding.mockResolvedValue(undefined);

    const { POST } = await import(
      "../../../app/api/cron/embedding-generate/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockGenerateEmbedding).toHaveBeenCalledWith("사업 계획 내용입니다.");
    expect(mockUpsertEmbedding).toHaveBeenCalledOnce();
  });

  it("falls back to document name when ocrResult has no text", async () => {
    mockDocumentEmbedding.findMany.mockResolvedValue([]);
    mockDocument.findMany.mockResolvedValue([
      { id: "doc-3", name: "법인등기부등본", category: "REGISTRATION", ocrResult: null },
    ]);
    const fakeEmbedding = Array.from({ length: 1536 }, () => 0.2);
    mockGenerateEmbedding.mockResolvedValue(fakeEmbedding);
    mockUpsertEmbedding.mockResolvedValue(undefined);

    const { POST } = await import(
      "../../../app/api/cron/embedding-generate/route"
    );
    await POST(authedRequest());
    expect(mockGenerateEmbedding).toHaveBeenCalledWith("법인등기부등본");
  });
});

// --- WI-140: daily-digest ---

describe("POST /api/cron/daily-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing auth", async () => {
    const { POST } = await import(
      "../../../app/api/cron/daily-digest/route"
    );
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("returns processed=0 when no consultants found", async () => {
    mockUser.findMany.mockResolvedValue([]);

    const { POST } = await import(
      "../../../app/api/cron/daily-digest/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body).toEqual({ success: true, processed: 0 });
  });

  it("sends digest email to consultants with upcoming deadlines", async () => {
    mockUser.findMany.mockResolvedValue([
      { id: "user-1", name: "컨설턴트1", email: "consultant@example.com" },
    ]);
    mockClient.findMany.mockResolvedValue([
      { id: "client-1", name: "기업A" },
    ]);

    const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mockMatchingResult.findMany
      .mockResolvedValueOnce([
        // upcomingMatches
        {
          id: "mr-1",
          clientId: "client-1",
          score: 80,
          program: { name: "중소기업 R&D", applicationEnd: deadline },
        },
      ])
      .mockResolvedValueOnce([]); // newMatchesToday

    mockNotification.count.mockResolvedValue(2);
    mockSendEmail.mockResolvedValue(undefined);

    const { POST } = await import(
      "../../../app/api/cron/daily-digest/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockMatchingDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({ consultantName: "컨설턴트1" })
    );
  });

  it("skips consultants with nothing to report", async () => {
    mockUser.findMany.mockResolvedValue([
      { id: "user-2", name: "조용한컨설턴트", email: "quiet@example.com" },
    ]);
    mockClient.findMany.mockResolvedValue([]);
    mockMatchingResult.findMany.mockResolvedValue([]);
    mockNotification.count.mockResolvedValue(0);

    const { POST } = await import(
      "../../../app/api/cron/daily-digest/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(body.processed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
