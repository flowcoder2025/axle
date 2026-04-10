/**
 * Tests for WI-108/WI-109 Portal API routes
 * GET  /api/portal/[token]              — validate token
 * GET  /api/portal/[token]/checklist    — read-only checklist
 * GET  /api/portal/[token]/journal      — list journal entries
 * POST /api/portal/[token]/journal      — create journal entry
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockPortalToken,
  mockClient,
  mockChecklistItem,
  mockPortalJournal,
} = vi.hoisted(() => ({
  mockPortalToken: { findUnique: vi.fn() },
  mockClient: { findUnique: vi.fn() },
  mockChecklistItem: { findMany: vi.fn() },
  mockPortalJournal: { findMany: vi.fn(), create: vi.fn() },
}));

vi.mock("@axle/db", () => ({
  prisma: {
    portalToken: mockPortalToken,
    client: mockClient,
    checklistItem: mockChecklistItem,
    portalJournal: mockPortalJournal,
  },
}));

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_TOKEN = {
  id: "tok-1",
  token: "abc123",
  projectId: "proj-1",
  clientId: "client-1",
  scope: "FULL",
  expiresAt: null,
  project: {
    id: "proj-1",
    title: "테스트 프로젝트",
    status: "IN_PROGRESS",
    dueDate: null,
    type: "BUSINESS_PLAN",
    priority: "MEDIUM",
  },
};

const JOURNAL_TOKEN = { ...VALID_TOKEN, id: "tok-2", scope: "JOURNAL" };
const UPLOAD_TOKEN = { ...VALID_TOKEN, id: "tok-3", scope: "UPLOAD" };
const EXPIRED_TOKEN = { ...VALID_TOKEN, id: "tok-4", expiresAt: new Date("2000-01-01") };

const tokenCtx = (token: string) => ({ params: Promise.resolve({ token }) });

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// /api/portal/[token] — token validation
// ---------------------------------------------------------------------------

import { GET as portalGET } from "@/app/api/portal/[token]/route";

describe("GET /api/portal/[token]", () => {
  it("returns 404 for invalid token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(null);
    const res = await portalGET(makeRequest("GET", "http://test/") as never, tokenCtx("bad"));
    expect(res.status).toBe(404);
  });

  it("returns 410 for expired token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(EXPIRED_TOKEN);
    const res = await portalGET(makeRequest("GET", "http://test/") as never, tokenCtx("expired"));
    expect(res.status).toBe(410);
  });

  it("returns project and client info for valid token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(VALID_TOKEN);
    mockClient.findUnique.mockResolvedValue({ id: "client-1", name: "테스트 회사", email: null, phone: null });
    const res = await portalGET(makeRequest("GET", "http://test/") as never, tokenCtx("abc123"));
    const json = await res.json() as { data: { project: { title: string }; scope: string } };
    expect(res.status).toBe(200);
    expect(json.data.project.title).toBe("테스트 프로젝트");
    expect(json.data.scope).toBe("FULL");
  });
});

// ---------------------------------------------------------------------------
// /api/portal/[token]/checklist
// ---------------------------------------------------------------------------

import { GET as checklistGET } from "@/app/api/portal/[token]/checklist/route";

describe("GET /api/portal/[token]/checklist", () => {
  it("returns 404 for invalid token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(null);
    const res = await checklistGET(makeRequest("GET", "http://test/") as never, tokenCtx("bad"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for JOURNAL-scope token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(JOURNAL_TOKEN);
    const res = await checklistGET(makeRequest("GET", "http://test/") as never, tokenCtx("journal-tok"));
    expect(res.status).toBe(403);
  });

  it("returns checklist items for FULL-scope token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(VALID_TOKEN);
    mockChecklistItem.findMany.mockResolvedValue([
      { id: "item-1", name: "사업자등록증", description: null, isRequired: true, status: "PENDING", requestedAt: null, uploadedAt: null },
    ]);
    const res = await checklistGET(makeRequest("GET", "http://test/") as never, tokenCtx("abc123"));
    const json = await res.json() as { data: { name: string }[] };
    expect(res.status).toBe(200);
    expect(json.data[0]?.name).toBe("사업자등록증");
  });

  it("returns checklist items for UPLOAD-scope token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(UPLOAD_TOKEN);
    mockChecklistItem.findMany.mockResolvedValue([]);
    const res = await checklistGET(makeRequest("GET", "http://test/") as never, tokenCtx("upload-tok"));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /api/portal/[token]/journal
// ---------------------------------------------------------------------------

import {
  GET as journalGET,
  POST as journalPOST,
} from "@/app/api/portal/[token]/journal/route";

describe("GET /api/portal/[token]/journal", () => {
  it("returns 404 for invalid token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(null);
    const res = await journalGET(makeRequest("GET", "http://test/") as never, tokenCtx("bad"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for UPLOAD-scope token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(UPLOAD_TOKEN);
    const res = await journalGET(makeRequest("GET", "http://test/") as never, tokenCtx("upload-tok"));
    expect(res.status).toBe(403);
  });

  it("returns journal entries for JOURNAL-scope token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(JOURNAL_TOKEN);
    mockPortalJournal.findMany.mockResolvedValue([
      { id: "j-1", tokenId: "tok-2", title: "1차 연구", content: "내용", submittedAt: new Date() },
    ]);
    const res = await journalGET(makeRequest("GET", "http://test/") as never, tokenCtx("journal-tok"));
    const json = await res.json() as { data: { title: string }[] };
    expect(res.status).toBe(200);
    expect(json.data[0]?.title).toBe("1차 연구");
  });

  it("returns journal entries for FULL-scope token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(VALID_TOKEN);
    mockPortalJournal.findMany.mockResolvedValue([]);
    const res = await journalGET(makeRequest("GET", "http://test/") as never, tokenCtx("abc123"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/portal/[token]/journal", () => {
  it("returns 404 for invalid token", async () => {
    mockPortalToken.findUnique.mockResolvedValue(null);
    const res = await journalPOST(makeRequest("POST", "http://test/", { title: "t", content: "c" }) as never, tokenCtx("bad"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when title is empty", async () => {
    mockPortalToken.findUnique.mockResolvedValue(JOURNAL_TOKEN);
    const res = await journalPOST(makeRequest("POST", "http://test/", { title: "", content: "내용" }) as never, tokenCtx("journal-tok"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is empty", async () => {
    mockPortalToken.findUnique.mockResolvedValue(JOURNAL_TOKEN);
    const res = await journalPOST(makeRequest("POST", "http://test/", { title: "제목", content: "" }) as never, tokenCtx("journal-tok"));
    expect(res.status).toBe(400);
  });

  it("creates a journal entry successfully", async () => {
    mockPortalToken.findUnique.mockResolvedValue(JOURNAL_TOKEN);
    mockPortalJournal.create.mockResolvedValue({
      id: "j-new",
      tokenId: "tok-2",
      title: "새 일지",
      content: "연구 내용",
      submittedAt: new Date(),
    });
    const res = await journalPOST(
      makeRequest("POST", "http://test/", { title: "새 일지", content: "연구 내용" }) as never,
      tokenCtx("journal-tok"),
    );
    const json = await res.json() as { data: { title: string } };
    expect(res.status).toBe(201);
    expect(json.data.title).toBe("새 일지");
  });
});
