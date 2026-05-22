/**
 * Phase 21 WI-728-prep — refresh-erp-mv cron route tests.
 *
 * Asserts the auth gate + the two refresh paths (CONCURRENTLY + the
 * one-time non-CONCURRENTLY fallback when the view has never been
 * populated).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/db", () => {
  const $executeRawUnsafe = vi.fn();
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { $executeRawUnsafe },
  };
});

import { prisma } from "@axle/db";
import { POST, MV_NAME } from "../../../app/api/cron/refresh-erp-mv/route";

const executeRawUnsafeMock = (prisma as unknown as {
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
}).$executeRawUnsafe;

function cronReq(token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://x/api/cron/refresh-erp-mv", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

describe("POST /api/cron/refresh-erp-mv — auth", () => {
  it("401 without Bearer token", async () => {
    const res = await POST(cronReq());
    expect(res.status).toBe(401);
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it("401 with wrong Bearer token", async () => {
    const res = await POST(cronReq("wrong"));
    expect(res.status).toBe(401);
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/cron/refresh-erp-mv — refresh path", () => {
  it("issues REFRESH CONCURRENTLY against the canonical view name", async () => {
    executeRawUnsafeMock.mockResolvedValueOnce(undefined);
    const res = await POST(cronReq("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.view).toBe(MV_NAME);
    expect(typeof body.durationMs).toBe("number");
    expect(executeRawUnsafeMock).toHaveBeenCalledTimes(1);
    expect(executeRawUnsafeMock.mock.calls[0]?.[0]).toBe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY "${MV_NAME}"`,
    );
  });

  it("falls back to non-CONCURRENTLY refresh when the view has not been populated", async () => {
    // First call: throws the populate error. Second call: succeeds.
    executeRawUnsafeMock
      .mockRejectedValueOnce(
        new Error('materialized view "mv_erp_monthly_summary" has not been populated'),
      )
      .mockResolvedValueOnce(undefined);
    const res = await POST(cronReq("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("initial");
    expect(executeRawUnsafeMock).toHaveBeenCalledTimes(2);
    expect(executeRawUnsafeMock.mock.calls[1]?.[0]).toBe(
      `REFRESH MATERIALIZED VIEW "${MV_NAME}"`,
    );
  });

  it("500 on a non-recoverable error (e.g. permission denied)", async () => {
    executeRawUnsafeMock.mockRejectedValueOnce(new Error("permission denied"));
    const res = await POST(cronReq("test-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("permission denied");
  });
});
