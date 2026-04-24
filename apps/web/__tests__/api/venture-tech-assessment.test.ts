/**
 * WI-303: Venture Tech Assessment API tests.
 * GET / POST /api/projects/[projectId]/venture-tech-assessment
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockProjectFindFirst, mockClientFindUnique, mockGetCurrentUser } = vi.hoisted(() => ({
  mockProjectFindFirst: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    project: { findFirst: mockProjectFindFirst },
    client: { findUnique: mockClientFindUnique },
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: mockGetCurrentUser,
}));

import {
  GET,
  POST,
} from "@/app/api/projects/[projectId]/venture-tech-assessment/route";

const orgUser = { id: "user-1", orgId: "org-1" };

function makeProject(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "proj-1",
    type: "VENTURE_CERT",
    clientId: "client-1",
    ...over,
  };
}

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client-1",
    name: "주식회사 제이이티",
    ceoName: "김희수",
    businessNumber: "123-45-67890",
    foundedDate: new Date("2022-03-15T00:00:00Z"),
    address: "서울 강남구 테헤란로 1",
    capitalAmount: "100000000",
    employeeCount: 9,
    masterProfile: null,
    financials: [
      { year: 2024, revenue: "500000000", operatingProfit: "50000000", netProfit: "40000000" },
    ],
    achievements: [{ type: "PATENT", title: "P1" }],
    ...over,
  };
}

const ctx = (projectId = "proj-1") => ({
  params: Promise.resolve({ projectId }),
});

beforeEach(() => {
  mockProjectFindFirst.mockReset();
  mockClientFindUnique.mockReset();
  mockGetCurrentUser.mockReset();
});

describe("GET /api/projects/[projectId]/venture-tech-assessment", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://test") as never, ctx());
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no orgId", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: "u1" });
    const res = await GET(new Request("http://test") as never, ctx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when project does not exist", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://test") as never, ctx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when project type is not VENTURE_CERT", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject({ type: "PATENT" }));
    const res = await GET(new Request("http://test") as never, ctx());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toMatch(/VENTURE_CERT/);
  });

  it("returns the auto-filled input JSON for a VENTURE_CERT project", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const res = await GET(new Request("http://test") as never, ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.input.companyInfo.companyName).toBe("주식회사 제이이티");
    expect(body.input.finance).toHaveLength(1);
    expect(body.input.intellectualProperty.patents).toBe(1);
  });

  it("scopes the project lookup by org", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    await GET(new Request("http://test") as never, ctx());
    const args = mockProjectFindFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: "proj-1", client: { orgId: "org-1" } });
  });
});

describe("POST /api/projects/[projectId]/venture-tech-assessment", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when project does not exist", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when project type is not VENTURE_CERT", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject({ type: "RESEARCH_INSTITUTE" }));
    const res = await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    expect(res.status).toBe(403);
  });

  it("returns 422 when client has no companyName", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ name: "" }));
    const res = await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_COMPANY_NAME");
  });

  it("returns 422 when client has no ceoName", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ ceoName: null }));
    const res = await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_CEO_NAME");
  });

  it("maps capitalAmount precision-loss into a 422 NUMERIC_OVERFLOW (WI-332-fix H2)", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({ capitalAmount: "9007199254740993" }),
    );
    const res = await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("NUMERIC_OVERFLOW");
  });

  it("returns a DOCX buffer with proper download headers when generation succeeds", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const res = await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename");
    // Filename includes the company name (URI-encoded since UTF-8 form is used)
    expect(decodeURIComponent(disposition)).toContain("주식회사 제이이티");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(2000);
  });

  it("merges request-body overrides into the auto-filled input (WI-334-feat M2)", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());

    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: {
            companyInfo: { companyName: "오버라이드 사명" },
            sections: { background: "사용자 본문" },
          },
        }),
      }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    const disposition = decodeURIComponent(res.headers.get("Content-Disposition") ?? "");
    // Filename reflects the overridden company name, not the DB one.
    expect(disposition).toContain("오버라이드 사명");
  });

  it("ignores invalid JSON body and proceeds with auto-filled input", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());

    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    const disposition = decodeURIComponent(res.headers.get("Content-Disposition") ?? "");
    expect(disposition).toContain("주식회사 제이이티");
  });
});
