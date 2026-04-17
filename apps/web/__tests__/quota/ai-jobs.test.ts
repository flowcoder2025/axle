import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    aiJob: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@axle/db";
import {
  assertAiJobQuota,
  getAiJobQuotaStatus,
  OrgNotFoundError,
  QuotaExceededError,
} from "@/lib/quota/ai-jobs";

const mockOrg = prisma.organization.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockCount = prisma.aiJob.count as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockOrg.mockReset();
  mockCount.mockReset();
});

describe("getAiJobQuotaStatus", () => {
  it("returns used/limit/remaining when under quota", async () => {
    mockOrg.mockResolvedValue({ quotaAiJobs: 100 });
    mockCount.mockResolvedValue(25);
    const status = await getAiJobQuotaStatus("org1");
    expect(status).toEqual({ used: 25, limit: 100, remaining: 75 });
  });

  it("remaining clamps to 0 when used exceeds limit", async () => {
    mockOrg.mockResolvedValue({ quotaAiJobs: 10 });
    mockCount.mockResolvedValue(15);
    const status = await getAiJobQuotaStatus("org1");
    expect(status.remaining).toBe(0);
  });

  it("throws OrgNotFoundError when organization missing", async () => {
    mockOrg.mockResolvedValue(null);
    await expect(getAiJobQuotaStatus("missing")).rejects.toThrow(OrgNotFoundError);
  });

  it("scopes count to this month and org boundary", async () => {
    mockOrg.mockResolvedValue({ quotaAiJobs: 100 });
    mockCount.mockResolvedValue(0);
    await getAiJobQuotaStatus("org1");
    const args = mockCount.mock.calls[0][0];
    expect(args.where.project.client.orgId).toBe("org1");
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    // Start of the month → day=1, hours=0
    const d: Date = args.where.createdAt.gte;
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
  });
});

describe("assertAiJobQuota", () => {
  it("resolves when used < limit", async () => {
    mockOrg.mockResolvedValue({ quotaAiJobs: 100 });
    mockCount.mockResolvedValue(50);
    await expect(assertAiJobQuota("org1")).resolves.toMatchObject({
      used: 50,
      limit: 100,
    });
  });

  it("throws QuotaExceededError when used === limit", async () => {
    mockOrg.mockResolvedValue({ quotaAiJobs: 10 });
    mockCount.mockResolvedValue(10);
    await expect(assertAiJobQuota("org1")).rejects.toThrow(QuotaExceededError);
  });

  it("throws QuotaExceededError when used > limit", async () => {
    mockOrg.mockResolvedValue({ quotaAiJobs: 10 });
    mockCount.mockResolvedValue(11);
    await expect(assertAiJobQuota("org1")).rejects.toThrow(QuotaExceededError);
  });

  it("QuotaExceededError carries used/limit", async () => {
    mockOrg.mockResolvedValue({ quotaAiJobs: 5 });
    mockCount.mockResolvedValue(7);
    try {
      await assertAiJobQuota("org1");
      throw new Error("should not reach");
    } catch (e) {
      expect(e).toBeInstanceOf(QuotaExceededError);
      const err = e as QuotaExceededError;
      expect(err.used).toBe(7);
      expect(err.limit).toBe(5);
      expect(err.code).toBe("QUOTA_EXCEEDED");
    }
  });
});
