/**
 * WI-323: BUNDLE 공통 서류 전파 API 테스트.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockProjectFindFirst,
  mockProjectFindUnique,
  mockChecklistItemUpdate,
  mockTransaction,
  mockGetCurrentUser,
} = vi.hoisted(() => ({
  mockProjectFindFirst: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockChecklistItemUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    project: {
      findFirst: mockProjectFindFirst,
      findUnique: mockProjectFindUnique,
    },
    checklistItem: { update: mockChecklistItemUpdate },
    $transaction: mockTransaction,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: mockGetCurrentUser,
}));

import { POST } from "@/app/api/projects/[projectId]/bundle-propagate/route";

const orgUser = { id: "user-1", orgId: "org-1" };
const ctx = (projectId = "bundle-1") => ({
  params: Promise.resolve({ projectId }),
});

beforeEach(() => {
  mockProjectFindFirst.mockReset();
  mockProjectFindUnique.mockReset();
  mockChecklistItemUpdate.mockReset();
  mockTransaction.mockReset();
  mockGetCurrentUser.mockReset();
});

function makeBundle() {
  return {
    id: "bundle-1",
    type: "BUNDLE",
    documents: [
      { id: "doc-reg", name: "사업자등록증" },
      { id: "doc-corp", name: "법인등기부등본" },
    ],
    children: [
      {
        id: "venture",
        checklist: [
          {
            id: "v1",
            name: "사업자등록증",
            status: "PENDING",
            documentId: null,
          },
          {
            id: "v2",
            name: "법인등기부등본",
            status: "PENDING",
            documentId: null,
          },
        ],
      },
      {
        id: "research",
        checklist: [
          {
            id: "r1",
            name: "사업자등록증",
            status: "VERIFIED", // skip: verified
            documentId: null,
          },
        ],
      },
    ],
  };
}

describe("POST /api/projects/[projectId]/bundle-propagate", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not found", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when project type is not BUNDLE", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce({
      id: "p1",
      type: "VENTURE_CERT",
    });
    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toMatch(/BUNDLE/);
  });

  it("scopes the project lookup by org", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce(null);
    await POST(new Request("http://test", { method: "POST" }) as never, ctx());
    const args = mockProjectFindFirst.mock.calls[0][0];
    expect(args.where).toEqual({
      id: "bundle-1",
      client: { orgId: "org-1" },
    });
  });

  it("propagates and returns a summary for a valid BUNDLE", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce({ id: "bundle-1", type: "BUNDLE" });
    mockProjectFindUnique.mockResolvedValueOnce(makeBundle());
    mockTransaction.mockImplementationOnce(async (ops: unknown[]) => ops);
    mockChecklistItemUpdate.mockImplementation((args: unknown) => args);

    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.parentProjectId).toBe("bundle-1");
    expect(body.summary.parentDocumentCount).toBe(2);
    expect(body.summary.childProjectCount).toBe(2);
    // v1 + v2 propagate; r1 skipped (VERIFIED)
    expect(body.summary.updatedCount).toBe(2);
    expect(body.summary.skippedBecauseVerified).toBe(1);
    // Every parent doc matched at least one child
    expect(body.summary.noMatchInChildren).toBe(0);

    // Verified transaction was called with 2 ops (v1, v2)
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const ops = mockTransaction.mock.calls[0][0] as unknown[];
    expect(ops).toHaveLength(2);
  });

  it("does not open a transaction when no updates are planned", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(orgUser);
    mockProjectFindFirst.mockResolvedValueOnce({ id: "bundle-1", type: "BUNDLE" });
    mockProjectFindUnique.mockResolvedValueOnce({
      id: "bundle-1",
      type: "BUNDLE",
      documents: [{ id: "d1", name: "사업자등록증" }],
      children: [
        {
          id: "venture",
          checklist: [
            {
              id: "v1",
              name: "사업자등록증",
              status: "VERIFIED",
              documentId: null,
            },
          ],
        },
      ],
    });

    const res = await POST(
      new Request("http://test", { method: "POST" }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.updatedCount).toBe(0);
    expect(body.summary.skippedBecauseVerified).toBe(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
