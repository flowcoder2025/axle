/**
 * Tests for POST /api/cron/certificate-renewal (WI-326).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRunScan, mockVerifyCron } = vi.hoisted(() => ({
  mockRunScan: vi.fn(),
  mockVerifyCron: vi.fn(),
}));

vi.mock("../../../lib/services/certificate-renewal", () => ({
  runCertificateRenewalScan: (...args: unknown[]) => mockRunScan(...args),
}));

vi.mock("../../../lib/cron-auth", () => ({
  verifyCronAuth: (...args: unknown[]) => mockVerifyCron(...args),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/cron/certificate-renewal", () => {
  it("returns 401 when cron auth fails", async () => {
    mockVerifyCron.mockReturnValue(false);
    const { POST } = await import(
      "../../../app/api/cron/certificate-renewal/route"
    );
    const res = await POST(
      new Request("http://localhost/api/cron/certificate-renewal", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(401);
    expect(mockRunScan).not.toHaveBeenCalled();
  });

  it("invokes the scan and returns the report on success", async () => {
    mockVerifyCron.mockReturnValue(true);
    mockRunScan.mockResolvedValue({
      scanned: 3,
      created: 2,
      alreadyInProgress: 1,
      skipped: 0,
    });
    const { POST } = await import(
      "../../../app/api/cron/certificate-renewal/route"
    );
    const res = await POST(
      new Request("http://localhost/api/cron/certificate-renewal", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      scanned: 3,
      created: 2,
      alreadyInProgress: 1,
      skipped: 0,
    });
  });

  it("returns 500 when the scan throws", async () => {
    mockVerifyCron.mockReturnValue(true);
    mockRunScan.mockRejectedValue(new Error("DB down"));
    const { POST } = await import(
      "../../../app/api/cron/certificate-renewal/route"
    );
    const res = await POST(
      new Request("http://localhost/api/cron/certificate-renewal", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(500);
  });
});
