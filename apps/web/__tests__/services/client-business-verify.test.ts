/**
 * Tests for client-business-verify service (WI-219)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const { mockClientUpdate, mockVerifyBusinessNumber } = vi.hoisted(() => ({
  mockClientUpdate: vi.fn(),
  mockVerifyBusinessNumber: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: {
      update: mockClientUpdate,
    },
  },
}));

vi.mock("@axle/ocr", () => ({
  verifyBusinessNumber: mockVerifyBusinessNumber,
}));

import { verifyAndStoreBusinessStatus } from "../../lib/services/client-business-verify";

describe("verifyAndStoreBusinessStatus", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockClientUpdate.mockReset();
    mockVerifyBusinessNumber.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists status and verifiedAt timestamp on successful verification", async () => {
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockClientUpdate.mockResolvedValue({});

    await verifyAndStoreBusinessStatus("client-1", "1234567890");

    expect(mockVerifyBusinessNumber).toHaveBeenCalledWith("1234567890");
    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
    const arg = mockClientUpdate.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "client-1" });
    expect(arg.data.businessStatus).toBe("정상");
    expect(arg.data.businessVerifiedAt).toBeInstanceOf(Date);
  });

  it("writes 폐업 status when API marks the business as closed", async () => {
    mockVerifyBusinessNumber.mockResolvedValue({ valid: false, status: "폐업" });
    mockClientUpdate.mockResolvedValue({});

    await verifyAndStoreBusinessStatus("client-2", "123-45-67890");

    const arg = mockClientUpdate.mock.calls[0][0];
    expect(arg.data.businessStatus).toBe("폐업");
  });

  it("swallows verifyBusinessNumber errors without calling update", async () => {
    mockVerifyBusinessNumber.mockRejectedValue(
      new Error("NTS API request failed: 500 Internal Server Error")
    );

    await expect(
      verifyAndStoreBusinessStatus("client-3", "1234567890")
    ).resolves.toBeUndefined();

    expect(mockClientUpdate).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });

  it("swallows invalid format errors from verifyBusinessNumber", async () => {
    mockVerifyBusinessNumber.mockRejectedValue(
      new Error('Invalid business number format: "abc". Must be 10 digits.')
    );

    await expect(
      verifyAndStoreBusinessStatus("client-4", "abc")
    ).resolves.toBeUndefined();

    expect(mockClientUpdate).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const [label, err] = consoleErrorSpy.mock.calls[0];
    expect(String(label)).toContain("client-4");
    expect((err as Error).message).toContain("Invalid business number format");
  });

  it("swallows DB update failures after successful API call", async () => {
    mockVerifyBusinessNumber.mockResolvedValue({ valid: true, status: "정상" });
    mockClientUpdate.mockRejectedValue(new Error("connection lost"));

    await expect(
      verifyAndStoreBusinessStatus("client-5", "1234567890")
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});
