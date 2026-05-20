/**
 * Phase 21 WI-724b — duplicates report route tests.
 *
 * Contract under test:
 *
 *   1. set_limit($threshold) runs inside the $transaction (so the `%`
 *      operator uses the WI-724b threshold, not a stale pooled GUC).
 *   2. The SELECT is a self-join with the `a.id < b.id` guard so each
 *      pair is emitted exactly once and no row pairs with itself.
 *   3. Order counts come from a single CTE keyed by counterpartyId — not
 *      two correlated subqueries.
 *   4. The pair includes a `suggestedTargetId` chosen by Order-count
 *      heuristic (more orders wins; deterministic tie-break).
 *   5. Empty result → 200 with `items: []` (RED case per AC).
 *   6. threshold / limit are validated (clamped via Zod).
 *   7. erp:read is required.
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
  const $queryRaw = vi.fn();
  const $transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ $queryRaw }),
  );
  return {
    DB_PACKAGE: "@axle/db",
    prisma: {
      $transaction,
      $queryRaw,
      organization: { findUnique: vi.fn() },
    },
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";

import { GET } from "../../../app/api/erp/counterparties/duplicates/route";

const queryRawMock = (prisma as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
}).$queryRaw;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function dupReq(qs = ""): Request {
  return new Request(`http://x/api/erp/counterparties/duplicates${qs ? `?${qs}` : ""}`);
}

function asSql(call: unknown): Prisma.Sql {
  const args = (call as { 0: unknown })[0];
  return args as Prisma.Sql;
}

function pairRow(overrides: Record<string, unknown> = {}) {
  return {
    a_id: "cp_a",
    a_name: "에이비씨 A",
    a_biz: null,
    a_type: "CUSTOMER" as const,
    a_coa: null,
    a_count: BigInt(4),
    b_id: "cp_b",
    b_name: "에이비씨",
    b_biz: null,
    b_type: "CUSTOMER" as const,
    b_coa: null,
    b_count: BigInt(2),
    sim: 0.82,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(authedUser);
  (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(true);
  (getActiveTenant as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    id: "org_test",
    isManaged: false,
    name: "test-org",
  });
  organizationMock.findUnique.mockResolvedValue({ name: "test-org" });
  queryRawMock.mockReset();
});

// ─────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────

describe("GET /api/erp/counterparties/duplicates — happy path", () => {
  it("returns 200 with serialized pairs and echoes query parameters", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.7 }])
      .mockResolvedValueOnce([pairRow()]);

    const res = await GET(dupReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ similarity: number; suggestedTargetId: string; a: { orderCount: number }; b: { orderCount: number } }>;
      query: { threshold: number; limit: number };
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      similarity: expect.closeTo(0.82, 2),
      suggestedTargetId: "cp_a", // a has more orders
    });
    expect(body.items[0].a.orderCount).toBe(4); // bigint serialized to number
    expect(body.items[0].b.orderCount).toBe(2);
    expect(body.query).toEqual({ threshold: 0.7, limit: 50 });
  });

  it("set_limit is called with the threshold and runs inside the transaction", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.85 }])
      .mockResolvedValueOnce([]);

    await GET(dupReq("threshold=0.85"));

    expect(queryRawMock).toHaveBeenCalledTimes(2);
    const setLimitSql = asSql(queryRawMock.mock.calls[0]);
    expect(setLimitSql.sql).toMatch(/SELECT set_limit\(/);
    expect(setLimitSql.values).toContain(0.85);
  });

  it("self-join uses `a.id < b.id` (each pair once, no self-pair) and the GIN `%` operator", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.7 }])
      .mockResolvedValueOnce([]);

    await GET(dupReq());
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    expect(selectSql.sql).toMatch(/a\."id"\s*<\s*b\."id"/);
    expect(selectSql.sql).toMatch(/a\."normalizedName"\s+%\s+b\."normalizedName"/);
  });

  it("uses a single order_counts CTE rather than correlated subqueries", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.7 }])
      .mockResolvedValueOnce([]);

    await GET(dupReq());
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    expect(selectSql.sql).toMatch(/WITH order_counts AS \(/);
    expect(selectSql.sql).toMatch(/LEFT JOIN order_counts oa/);
    expect(selectSql.sql).toMatch(/LEFT JOIN order_counts ob/);
  });

  it("scopes by orgId on both sides and excludes soft-deleted rows", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.7 }])
      .mockResolvedValueOnce([]);

    await GET(dupReq());
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    // Outer WHERE on a + b.orgId match in JOIN condition.
    expect(selectSql.sql).toMatch(/a\."orgId"\s*=\s*\?/);
    expect(selectSql.sql).toMatch(/b\."orgId"\s*=\s*a\."orgId"/);
    expect(selectSql.sql).toMatch(/a\."deletedAt"\s+IS\s+NULL/);
    expect(selectSql.sql).toMatch(/b\."deletedAt"\s+IS\s+NULL/);
    expect(selectSql.values).toContain("org_test");
  });
});

// ─────────────────────────────────────────────────────────────
// suggestedTargetId heuristic
// ─────────────────────────────────────────────────────────────

describe("suggestedTargetId heuristic", () => {
  it("picks the side with more orders", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.7 }])
      .mockResolvedValueOnce([
        pairRow({ a_id: "cp_a", a_count: BigInt(1), b_id: "cp_b", b_count: BigInt(9) }),
      ]);

    const res = await GET(dupReq());
    const body = (await res.json()) as { items: Array<{ suggestedTargetId: string }> };
    expect(body.items[0].suggestedTargetId).toBe("cp_b");
  });

  it("ties → lexicographically smaller id (deterministic)", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.7 }])
      .mockResolvedValueOnce([
        pairRow({ a_id: "cp_z", a_count: BigInt(3), b_id: "cp_a", b_count: BigInt(3) }),
      ]);

    const res = await GET(dupReq());
    const body = (await res.json()) as { items: Array<{ suggestedTargetId: string }> };
    expect(body.items[0].suggestedTargetId).toBe("cp_a");
  });
});

// ─────────────────────────────────────────────────────────────
// Empty / invalid cases
// ─────────────────────────────────────────────────────────────

describe("empty + invalid input", () => {
  it("RED — empty result → 200 with items=[] (never 404)", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.7 }])
      .mockResolvedValueOnce([]);

    const res = await GET(dupReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("RED — threshold below 0.5 → 400", async () => {
    const res = await GET(dupReq("threshold=0.3"));
    expect(res.status).toBe(400);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("RED — threshold above 1.0 → 400", async () => {
    const res = await GET(dupReq("threshold=1.5"));
    expect(res.status).toBe(400);
  });

  it("RED — limit above 200 → 400", async () => {
    const res = await GET(dupReq("limit=500"));
    expect(res.status).toBe(400);
  });

  it("RED — missing erp:read scope → 403", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(false);
    const res = await GET(dupReq());
    expect(res.status).toBe(403);
  });

  it("RED — unauthenticated → 401", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await GET(dupReq());
    expect(res.status).toBe(401);
  });
});
