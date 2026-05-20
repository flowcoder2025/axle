/**
 * Phase 21 WI-725 — ChartOfAccounts CRUD route tests.
 *
 * Contract under test:
 *   - GET lazily seeds the NTS standard chart on first call
 *   - POST creates user-defined rows with isSystem=false
 *   - (orgId, code) collision → 409 CONFLICT (P2002 mapped)
 *   - PATCH/DELETE refuse isSystem=true rows with 400 SYSTEM_ROW_READONLY
 *   - 404 when row not in tenant
 *   - RBAC: read needs erp:read, mutate needs erp:write
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
  checkModulePermission: vi.fn(),
}));

vi.mock("@/src/lib/tenant-context", () => ({
  getActiveTenant: vi.fn(),
}));

vi.mock("@axle/db", () => {
  const chartOfAccounts = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: {
      chartOfAccounts,
      organization: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/erp/coa-seed", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/erp/coa-seed")>(
    "../../../lib/erp/coa-seed",
  );
  return {
    ...actual,
    seedSystemChartOfAccounts: vi.fn(),
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";
import { seedSystemChartOfAccounts } from "@/lib/erp/coa-seed";

import { GET, POST } from "../../../app/api/erp/chart-of-accounts/route";
import {
  PATCH,
  DELETE,
} from "../../../app/api/erp/chart-of-accounts/[coaId]/route";

const coaMock = (prisma as unknown as {
  chartOfAccounts: Record<string, ReturnType<typeof vi.fn>>;
}).chartOfAccounts;
const orgMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function ctx(coaId: string) {
  return { params: Promise.resolve({ coaId }) };
}

function makeCoa(overrides: Record<string, unknown> = {}) {
  return {
    id: "coa_1",
    orgId: "org_test",
    code: "608",
    name: "운반비",
    category: "OPEX",
    parentCode: null,
    source: "국세청 표준재무제표 v2024",
    isSystem: false,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  // `resetAllMocks` (not `clearAllMocks`) flushes the queued
  // mockResolvedValueOnce values between tests. A queued Once that the
  // route never consumed in the prior test would otherwise leak into
  // this one and silently change the response — see the DELETE flakes
  // when we used clearAllMocks.
  vi.resetAllMocks();
  (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(authedUser);
  (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(true);
  (getActiveTenant as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    id: "org_test",
    isManaged: false,
    name: "test-org",
  });
  orgMock.findUnique.mockResolvedValue({ name: "test-org" });
  coaMock.findMany.mockResolvedValue([]);
  coaMock.findFirst.mockResolvedValue(null);
  (seedSystemChartOfAccounts as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    inserted: 30,
    existed: 0,
  });
});

// ─────────────────────────────────────────────────────────────
// GET — list + lazy seed
// ─────────────────────────────────────────────────────────────

describe("GET /api/erp/chart-of-accounts", () => {
  it("runs the lazy seed for the active tenant BEFORE listing", async () => {
    coaMock.findMany.mockResolvedValueOnce([makeCoa({ isSystem: true })]);
    const res = await GET(jsonReq("http://x/api/erp/chart-of-accounts", "GET"));
    expect(res.status).toBe(200);

    expect(seedSystemChartOfAccounts).toHaveBeenCalledWith(prisma, "org_test");
    // The list query is scoped to the active tenant + sorted by category, code.
    const listArgs = coaMock.findMany.mock.calls[0]?.[0];
    expect(listArgs.where.orgId).toBe("org_test");
    expect(listArgs.orderBy).toEqual([{ category: "asc" }, { code: "asc" }]);
  });

  it("category filter goes through Zod enum (invalid is silently dropped, no 400)", async () => {
    await GET(jsonReq("http://x/api/erp/chart-of-accounts?category=OPEX", "GET"));
    let args = coaMock.findMany.mock.calls[0]?.[0];
    expect(args.where.category).toBe("OPEX");

    coaMock.findMany.mockClear();
    await GET(jsonReq("http://x/api/erp/chart-of-accounts?category=GARBAGE", "GET"));
    args = coaMock.findMany.mock.calls[0]?.[0];
    expect("category" in args.where).toBe(false);
  });

  it("serializes effectiveFrom + effectiveTo as ISO strings (RSC-safe)", async () => {
    coaMock.findMany.mockResolvedValueOnce([
      makeCoa({
        effectiveFrom: new Date("2026-04-01T00:00:00Z"),
        effectiveTo: new Date("2026-09-30T23:59:59Z"),
      }),
    ]);
    const res = await GET(jsonReq("http://x/api/erp/chart-of-accounts", "GET"));
    const body = (await res.json()) as {
      items: Array<{ effectiveFrom: string; effectiveTo: string | null }>;
    };
    expect(body.items[0].effectiveFrom).toBe("2026-04-01T00:00:00.000Z");
    expect(body.items[0].effectiveTo).toBe("2026-09-30T23:59:59.000Z");
  });

  it("RED — erp:read missing → 403, seed does NOT run", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(false);
    const res = await GET(jsonReq("http://x/api/erp/chart-of-accounts", "GET"));
    expect(res.status).toBe(403);
    expect(seedSystemChartOfAccounts).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// POST — user-defined create
// ─────────────────────────────────────────────────────────────

describe("POST /api/erp/chart-of-accounts", () => {
  it("creates with isSystem=false and tenant-scoped orgId", async () => {
    coaMock.create.mockResolvedValueOnce(
      makeCoa({ code: "777", name: "특수비", category: "OPEX", isSystem: false }),
    );
    const res = await POST(
      jsonReq("http://x/api/erp/chart-of-accounts", "POST", {
        code: "777",
        name: "특수비",
        category: "OPEX",
      }),
    );
    expect(res.status).toBe(201);
    const args = coaMock.create.mock.calls[0]?.[0]?.data;
    expect(args.orgId).toBe("org_test");
    expect(args.isSystem).toBe(false);
    expect(args.source).toBe("user");
  });

  it("RED — duplicate (orgId, code) → 409 CONFLICT (P2002 mapped)", async () => {
    coaMock.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const res = await POST(
      jsonReq("http://x/api/erp/chart-of-accounts", "POST", {
        code: "608",
        name: "운반비",
        category: "OPEX",
      }),
    );
    expect(res.status).toBe(409);
  });

  it("RED — invalid category enum → 400", async () => {
    const res = await POST(
      jsonReq("http://x/api/erp/chart-of-accounts", "POST", {
        code: "608",
        name: "x",
        category: "GARBAGE",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("RED — code with unsafe chars → 400 (regex)", async () => {
    const res = await POST(
      jsonReq("http://x/api/erp/chart-of-accounts", "POST", {
        code: "608'); DROP TABLE--",
        name: "x",
        category: "OPEX",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("RED — erp:write missing → 403", async () => {
    (checkModulePermission as unknown as { mockImplementation: Function }).mockImplementation(
      async (_u: string, _o: string, scope: string) => scope === "erp:read",
    );
    const res = await POST(
      jsonReq("http://x/api/erp/chart-of-accounts", "POST", {
        code: "608",
        name: "x",
        category: "OPEX",
      }),
    );
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH — isSystem guard
// ─────────────────────────────────────────────────────────────

describe("PATCH /api/erp/chart-of-accounts/[coaId]", () => {
  it("updates a user-defined row", async () => {
    coaMock.findFirst.mockResolvedValueOnce({ id: "coa_user", isSystem: false });
    coaMock.update.mockResolvedValueOnce(
      makeCoa({ id: "coa_user", name: "수정된 이름", isSystem: false }),
    );
    const res = await PATCH(
      jsonReq("http://x/api/erp/chart-of-accounts/coa_user", "PATCH", {
        name: "수정된 이름",
      }),
      ctx("coa_user"),
    );
    expect(res.status).toBe(200);
    const args = coaMock.update.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "coa_user" });
    expect(args.data).toEqual({ name: "수정된 이름" });
  });

  it("RED — isSystem=true row → 400 SYSTEM_ROW_READONLY (no UPDATE runs)", async () => {
    coaMock.findFirst.mockResolvedValueOnce({ id: "coa_sys", isSystem: true });
    const res = await PATCH(
      jsonReq("http://x/api/erp/chart-of-accounts/coa_sys", "PATCH", {
        name: "강제 수정",
      }),
      ctx("coa_sys"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SYSTEM_ROW_READONLY");
    expect(coaMock.update).not.toHaveBeenCalled();
  });

  it("RED — row not in tenant → 404", async () => {
    coaMock.findFirst.mockResolvedValueOnce(null);
    const res = await PATCH(
      jsonReq("http://x/api/erp/chart-of-accounts/coa_ghost", "PATCH", {
        name: "x",
      }),
      ctx("coa_ghost"),
    );
    expect(res.status).toBe(404);
    expect(coaMock.update).not.toHaveBeenCalled();
  });

  it("RED — empty patch (no fields) → 400", async () => {
    coaMock.findFirst.mockResolvedValueOnce({ id: "coa_user", isSystem: false });
    const res = await PATCH(
      jsonReq("http://x/api/erp/chart-of-accounts/coa_user", "PATCH", {}),
      ctx("coa_user"),
    );
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE — isSystem guard
// ─────────────────────────────────────────────────────────────

describe("DELETE /api/erp/chart-of-accounts/[coaId]", () => {
  it("deletes a user-defined row (204)", async () => {
    coaMock.findFirst.mockResolvedValueOnce({ id: "coa_user", isSystem: false });
    coaMock.delete.mockResolvedValueOnce({ id: "coa_user" });
    const res = await DELETE(
      jsonReq("http://x/api/erp/chart-of-accounts/coa_user", "DELETE"),
      ctx("coa_user"),
    );
    expect(res.status).toBe(204);
    expect(coaMock.delete).toHaveBeenCalledWith({ where: { id: "coa_user" } });
  });

  it("RED — isSystem=true row → 400 SYSTEM_ROW_READONLY (no DELETE runs)", async () => {
    coaMock.findFirst.mockResolvedValueOnce({ id: "coa_sys", isSystem: true });
    const res = await DELETE(
      jsonReq("http://x/api/erp/chart-of-accounts/coa_sys", "DELETE"),
      ctx("coa_sys"),
    );
    expect(res.status).toBe(400);
    expect(coaMock.delete).not.toHaveBeenCalled();
  });

  it("RED — not in tenant → 404", async () => {
    coaMock.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE(
      jsonReq("http://x/api/erp/chart-of-accounts/coa_ghost", "DELETE"),
      ctx("coa_ghost"),
    );
    expect(res.status).toBe(404);
  });
});
