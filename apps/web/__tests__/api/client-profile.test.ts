import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so the factory can reference the mock objects
// ---------------------------------------------------------------------------

const { mockPrismaClient, mockVerifyBusinessNumber } = vi.hoisted(() => {
  const mockPrismaClient = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const mockVerifyBusinessNumber = vi.fn();
  return { mockPrismaClient, mockVerifyBusinessNumber };
});

vi.mock("@axle/db", () => ({
  prisma: {
    client: mockPrismaClient,
  },
}));

vi.mock("@axle/ocr", () => ({
  verifyBusinessNumber: mockVerifyBusinessNumber,
}));

import { generateMasterProfile } from "../../lib/services/client-profile";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-1",
    name: "테스트기업",
    businessNumber: "1234567890",
    ceoName: "홍길동",
    industry: "제조업",
    region: "서울",
    address: "서울시 강남구",
    phone: "02-0000-0000",
    email: "test@example.com",
    website: "https://example.com",
    employeeCount: 50,
    foundedDate: new Date("2010-03-15"),
    isVenture: true,
    isInnoBiz: false,
    isMainBiz: false,
    isSocial: false,
    ventureValidUntil: new Date("2025-12-31"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateMasterProfile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does nothing when client is not found", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(null);

    await generateMasterProfile("nonexistent");

    expect(mockPrismaClient.update).not.toHaveBeenCalled();
  });

  it("calls verifyBusinessNumber when businessNumber is present", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(makeClient());
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-1");

    expect(mockVerifyBusinessNumber).toHaveBeenCalledWith("1234567890");
  });

  it("skips verifyBusinessNumber when businessNumber is absent", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(
      makeClient({ businessNumber: null })
    );
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-1");

    expect(mockVerifyBusinessNumber).not.toHaveBeenCalled();
  });

  it("continues even if verifyBusinessNumber throws", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(makeClient());
    mockVerifyBusinessNumber.mockRejectedValue(new Error("NTS API unavailable"));
    mockPrismaClient.update.mockResolvedValue({});

    await expect(generateMasterProfile("c-1")).resolves.not.toThrow();
    expect(mockPrismaClient.update).toHaveBeenCalled();
  });

  it("persists masterProfile with correct businessInfo shape", async () => {
    const client = makeClient();
    mockPrismaClient.findUnique.mockResolvedValue(client);
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-1");

    const [callArg] = mockPrismaClient.update.mock.calls;
    const { masterProfile, profileBlocks } = callArg[0].data as {
      masterProfile: Record<string, unknown>;
      profileBlocks: unknown[];
    };

    expect(masterProfile).toMatchObject({
      businessInfo: {
        name: "테스트기업",
        ceoName: "홍길동",
        businessNumber: "1234567890",
        status: "정상",
        industry: "제조업",
        region: "서울",
      },
      certifications: {
        isVenture: true,
        isInnoBiz: false,
        isMainBiz: false,
        isSocial: false,
      },
    });

    expect(typeof (masterProfile as { summary?: string }).summary).toBe("string");
    expect((masterProfile as { summary?: string }).summary!.length).toBeGreaterThan(0);
    expect(Array.isArray(profileBlocks)).toBe(true);
    expect(profileBlocks.length).toBe(3);
  });

  it("persists profileBlocks with expected block types", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(makeClient());
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-1");

    const [callArg] = mockPrismaClient.update.mock.calls;
    const { profileBlocks } = callArg[0].data as {
      profileBlocks: Array<{ type: string; title: string }>;
    };

    const types = profileBlocks.map((b) => b.type);
    expect(types).toContain("info");
    expect(types).toContain("cert");
    expect(types).toContain("financial");
  });

  it("preserves organizationChart when regenerating (WI-327-1-fix)", async () => {
    // Regression: WI-327 started storing org-chart data in the same JSON
    // column as masterProfile. Regenerating the profile must not destroy it.
    const preserved = {
      companyName: "주식회사 제이이티",
      ceo: { name: "김희수", position: "대표이사" },
      departments: [{ name: "연구개발전담부서", members: [] }],
      updatedAt: "2026-04-24T00:00:00Z",
    };
    mockPrismaClient.findUnique.mockResolvedValue(
      makeClient({
        masterProfile: {
          organizationChart: preserved,
          // Also include a key owned by the profile editor to confirm it is
          // still overwritten (only whitelisted keys are preserved).
          businessInfo: { name: "stale" },
        },
      }),
    );
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-1");

    const [callArg] = mockPrismaClient.update.mock.calls;
    const { masterProfile } = callArg[0].data as {
      masterProfile: { organizationChart?: unknown; businessInfo?: { name?: string } };
    };
    expect(masterProfile.organizationChart).toEqual(preserved);
    // Freshly generated businessInfo must win over the stale one.
    expect(masterProfile.businessInfo?.name).toBe("테스트기업");
  });

  it("builds summary that includes company name", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(
      makeClient({ businessNumber: null })
    );
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-1");

    const [callArg] = mockPrismaClient.update.mock.calls;
    const { masterProfile } = callArg[0].data as {
      masterProfile: { summary: string };
    };

    expect(masterProfile.summary).toContain("테스트기업");
  });

  it("formats foundedDate as YYYY-MM-DD string", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(makeClient());
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-1");

    const [callArg] = mockPrismaClient.update.mock.calls;
    const { masterProfile } = callArg[0].data as {
      masterProfile: { businessInfo: { foundedDate: string } };
    };

    expect(masterProfile.businessInfo.foundedDate).toBe("2010-03-15");
  });

  it("updates the correct client by id", async () => {
    mockPrismaClient.findUnique.mockResolvedValue(makeClient({ id: "c-42" }));
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockPrismaClient.update.mockResolvedValue({});

    await generateMasterProfile("c-42");

    expect(mockPrismaClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c-42" } })
    );
  });
});
