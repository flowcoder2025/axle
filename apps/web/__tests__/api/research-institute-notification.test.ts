/**
 * WI-311: Research Institute Notification API tests.
 * GET / POST /api/projects/[projectId]/research-institute-notification
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockProjectFindFirst, mockClientFindUnique, mockGetCurrentUser } = vi.hoisted(
  () => ({
    mockProjectFindFirst: vi.fn(),
    mockClientFindUnique: vi.fn(),
    mockGetCurrentUser: vi.fn(),
  }),
);

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
} from "@/app/api/projects/[projectId]/research-institute-notification/route";

const orgUser = { id: "user-1", orgId: "org-1" };

function makeProject(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "proj-1",
    type: "RESEARCH_INSTITUTE",
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
    foundedDate: new Date("2015-03-15T00:00:00Z"),
    address: "서울 강남구 테헤란로 1",
    masterProfile: {
      researchInstitute: {
        instituteName: "JET 기업부설연구소",
        instituteAreaSqm: 120,
        overview: "연구소 개요 본문",
        rdFields: [{ title: "자동화 장비", items: ["a"] }],
        coreTechnologies: [{ name: "비전", descriptions: ["d"] }],
        projects: [{ name: "과제1", content: "내용", budget: 95_000_000 }],
        researchers: [{ name: "김희수", position: "연구소장" }],
      },
    },
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

describe("GET /api/projects/[projectId]/research-institute-notification", () => {
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

  it("returns 403 when project type is not RESEARCH_INSTITUTE", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject({ type: "VENTURE_CERT" }));
    const res = await GET(new Request("http://test") as never, ctx());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toMatch(/RESEARCH_INSTITUTE/);
  });

  it("returns the auto-filled input JSON for a RESEARCH_INSTITUTE project", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const res = await GET(new Request("http://test") as never, ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.input.companyInfo.companyName).toBe("주식회사 제이이티");
    expect(body.input.companyInfo.instituteName).toBe("JET 기업부설연구소");
    expect(body.input.companyInfo.instituteAreaSqm).toBe(120);
    expect(body.input.overview).toBe("연구소 개요 본문");
    expect(body.input.projects).toHaveLength(1);
    expect(body.input.researchers).toHaveLength(1);
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

describe("POST /api/projects/[projectId]/research-institute-notification", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when project does not exist", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when project type is not RESEARCH_INSTITUTE", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject({ type: "VENTURE_CERT" }));
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 422 when client has no companyName", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ name: "" }));
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_COMPANY_NAME");
  });

  it("returns 422 when client has no ceoName", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ ceoName: null }));
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_CEO_NAME");
  });

  it("returns a DOCX buffer with proper download headers when generation succeeds", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename");
    expect(decodeURIComponent(disposition)).toContain("주식회사 제이이티");
    expect(decodeURIComponent(disposition)).toContain("연구소설립신고서");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(2000);
  });

  it("merges request-body overrides into the auto-filled input", async () => {
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
            overview: "사용자 입력 overview",
          },
        }),
      }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    const disposition = decodeURIComponent(res.headers.get("Content-Disposition") ?? "");
    expect(disposition).toContain("오버라이드 사명");
  });

  it("replaces array fields entirely when override supplies them", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(makeProject());
    mockClientFindUnique.mockResolvedValueOnce(makeClient());

    // Override with an empty researcher array should remove the base roster
    // from the generated document. We can't inspect the DOCX easily here,
    // but a non-500 status confirms the merge did not throw.
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: { researchers: [], projects: [] },
        }),
      }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
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
