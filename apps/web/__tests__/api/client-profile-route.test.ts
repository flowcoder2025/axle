/**
 * Tests for /api/clients/[clientId]/profile PATCH route.
 * Focus: WI-327-1-fix preserves `organizationChart` across edits.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaClient = {
  findFirst: vi.fn(),
  update: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: { client: mockPrismaClient },
  Prisma: { DbNull: "__DB_NULL__" },
}));

vi.mock("@prisma/client", () => ({
  Prisma: { DbNull: "__DB_NULL__" },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("../../lib/services/client-profile", () => ({
  generateMasterProfile: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/clients/c1/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
});

describe("PATCH /api/clients/[clientId]/profile — WI-327-1-fix preservation", () => {
  it("keeps organizationChart when PATCH ships only profile fields", async () => {
    const orgChart = {
      companyName: "JET",
      ceo: { name: "김희수" },
      departments: [],
    };
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: { businessInfo: { name: "stale" }, organizationChart: orgChart },
      profileBlocks: null,
    });
    mockPrismaClient.update.mockResolvedValue({
      id: "c1",
      masterProfile: {},
      profileBlocks: null,
    });

    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    const res = await PATCH(
      makeRequest({
        masterProfile: { businessInfo: { name: "fresh" }, summary: "new" },
      }) as never,
      { params: Promise.resolve({ clientId: "c1" }) },
    );
    expect(res.status).toBe(200);

    const [callArg] = mockPrismaClient.update.mock.calls;
    const data = callArg[0].data.masterProfile as Record<string, unknown>;
    expect(data.businessInfo).toEqual({ name: "fresh" });
    expect(data.summary).toBe("new");
    // Preserved
    expect(data.organizationChart).toEqual(orgChart);
  });

  it("nulling masterProfile still keeps preserved keys when present", async () => {
    const orgChart = {
      companyName: "JET",
      ceo: { name: "김희수" },
      departments: [],
    };
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: { organizationChart: orgChart, businessInfo: { name: "x" } },
      profileBlocks: null,
    });
    mockPrismaClient.update.mockResolvedValue({
      id: "c1",
      masterProfile: {},
      profileBlocks: null,
    });

    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    await PATCH(makeRequest({ masterProfile: null }) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });

    const [callArg] = mockPrismaClient.update.mock.calls;
    const data = callArg[0].data.masterProfile as Record<string, unknown>;
    expect(data.organizationChart).toEqual(orgChart);
    expect(data.businessInfo).toBeUndefined();
  });

  // ── WI-330-fix: venture slice (WI-302/303) preservation ───────────────────
  it("keeps venture slice when PATCH ships only profile fields (WI-330-fix)", async () => {
    const venture = {
      sections: { background: "사용자 입력 본문" },
      checks: { problemImportance: ["많은 사람들이 겪고 있는 문제임"] },
      ip: { trademarks: 5 },
    };
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: { businessInfo: { name: "stale" }, venture },
      profileBlocks: null,
    });
    mockPrismaClient.update.mockResolvedValue({
      id: "c1",
      masterProfile: {},
      profileBlocks: null,
    });

    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    await PATCH(
      makeRequest({
        masterProfile: { businessInfo: { name: "fresh" }, summary: "new" },
      }) as never,
      { params: Promise.resolve({ clientId: "c1" }) },
    );

    const [callArg] = mockPrismaClient.update.mock.calls;
    const data = callArg[0].data.masterProfile as Record<string, unknown>;
    expect(data.businessInfo).toEqual({ name: "fresh" });
    expect(data.venture).toEqual(venture);
  });

  it("keeps both organizationChart and venture slices simultaneously (WI-330-fix)", async () => {
    const orgChart = {
      companyName: "JET",
      ceo: { name: "김희수" },
      departments: [],
    };
    const venture = { sections: { background: "x" } };
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: {
        businessInfo: { name: "stale" },
        organizationChart: orgChart,
        venture,
      },
      profileBlocks: null,
    });
    mockPrismaClient.update.mockResolvedValue({
      id: "c1",
      masterProfile: {},
      profileBlocks: null,
    });

    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    await PATCH(
      makeRequest({ masterProfile: { businessInfo: { name: "fresh" } } }) as never,
      { params: Promise.resolve({ clientId: "c1" }) },
    );

    const [callArg] = mockPrismaClient.update.mock.calls;
    const data = callArg[0].data.masterProfile as Record<string, unknown>;
    expect(data.organizationChart).toEqual(orgChart);
    expect(data.venture).toEqual(venture);
  });

  it("nulling masterProfile keeps venture slice when present (WI-330-fix)", async () => {
    const venture = { sections: { background: "x" }, checks: {} };
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: { venture, businessInfo: { name: "x" } },
      profileBlocks: null,
    });
    mockPrismaClient.update.mockResolvedValue({
      id: "c1",
      masterProfile: {},
      profileBlocks: null,
    });

    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    await PATCH(makeRequest({ masterProfile: null }) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });

    const [callArg] = mockPrismaClient.update.mock.calls;
    const data = callArg[0].data.masterProfile as Record<string, unknown>;
    expect(data.venture).toEqual(venture);
    expect(data.businessInfo).toBeUndefined();
  });

  it("writes Prisma.DbNull when no preserved keys and masterProfile null", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: null,
      profileBlocks: null,
    });
    mockPrismaClient.update.mockResolvedValue({
      id: "c1",
      masterProfile: null,
      profileBlocks: null,
    });

    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    await PATCH(makeRequest({ masterProfile: null }) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });

    const [callArg] = mockPrismaClient.update.mock.calls;
    expect(callArg[0].data.masterProfile).toBe("__DB_NULL__");
  });
});
