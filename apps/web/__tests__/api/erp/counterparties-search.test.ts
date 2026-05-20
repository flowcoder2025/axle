/**
 * Phase 21 WI-724a — fuzzy search route tests.
 *
 * The route emits raw SQL (the pg_trgm GIN index is the load-bearing
 * piece), so we assert on the SQL Prisma builds rather than on row shapes
 * from a real database. The contract under test:
 *
 *   1. set_limit(0.3) is called inside the same $transaction (matches the
 *      WI-724a AC of similarity ≥ 0.3 and prevents GUC drift on pooled
 *      connections).
 *   2. The WHERE clause uses `normalizedName % $q` so the GIN index can
 *      satisfy the lookup.
 *   3. When q canonicalizes to a 10-digit bizRegNo the SELECT projection
 *      uses an exact-match boost (sim=1.0 via CASE), and the WHERE clause
 *      grows an `OR "bizRegNo" = $canonical` arm.
 *   4. q is normalized (Korean company prefixes stripped) before being
 *      passed to similarity().
 *   5. Type filter is injected via Prisma.sql parameter, not concatenated.
 *   6. RED: empty / whitespace-only q → 400.
 *   7. RED: missing erp:read → 403.
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
  // The route opens a single $transaction → 2 sequential $queryRaw calls:
  // first set_limit, second the search SELECT. The mock fans both calls
  // through a shared `$queryRaw` spy so tests can assert on either.
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

import { GET } from "../../../app/api/erp/counterparties/search/route";

const queryRawMock = (prisma as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
}).$queryRaw;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function searchReq(qs: string): Request {
  return new Request(`http://x/api/erp/counterparties/search?${qs}`);
}

function asSql(call: unknown): Prisma.Sql {
  const args = (call as { 0: unknown })[0];
  return args as Prisma.Sql;
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

  // Default mock sequence: first call = set_limit, second = SELECT results
  queryRawMock.mockReset();
  queryRawMock
    .mockResolvedValueOnce([{ set_limit: 0.3 }])
    .mockResolvedValueOnce([
      {
        id: "cp1",
        name: "(주)에이비씨",
        normalizedName: "에이비씨",
        bizRegNo: "1234567890",
        type: "CUSTOMER",
        defaultCoaCode: null,
        sim: 0.85,
        matched_by: "name",
      },
    ]);
});

describe("GET /api/erp/counterparties/search — happy paths", () => {
  it("returns 200 with serialized matches and echoes the parsed query", async () => {
    const res = await GET(searchReq("q=%EC%97%90%EC%9D%B4%EB%B9%84%EC%94%A8"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; similarity: number; matchedBy: string }>;
      query: { normalized: string; threshold: number; bizRegLookup: string | null };
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "cp1",
      similarity: 0.85,
      matchedBy: "name",
    });
    expect(body.query.normalized).toBe("에이비씨");
    expect(body.query.threshold).toBe(0.3);
    expect(body.query.bizRegLookup).toBeNull();
  });

  it("pins pg_trgm.similarity_threshold to 0.3 via set_limit inside the transaction", async () => {
    await GET(searchReq("q=%EC%97%90%EC%9D%B4%EB%B9%84%EC%94%A8"));
    expect(queryRawMock).toHaveBeenCalledTimes(2);
    const setLimitSql = asSql(queryRawMock.mock.calls[0]);
    expect(setLimitSql.sql).toMatch(/SELECT set_limit\(/);
    expect(setLimitSql.values).toContain(0.3);
  });

  it("normalizes Korean company prefixes before passing q to similarity()", async () => {
    // "(주)에이비씨" → "에이비씨"
    await GET(searchReq("q=%28%EC%A3%BC%29%EC%97%90%EC%9D%B4%EB%B9%84%EC%94%A8"));
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    expect(selectSql.values).toContain("에이비씨");
    expect(selectSql.sql).toMatch(/similarity\("normalizedName",/);
    // The GIN-using `%` operator must be present.
    expect(selectSql.sql).toMatch(/"normalizedName"\s+%\s+/);
  });

  it("scopes by orgId and excludes soft-deleted rows", async () => {
    await GET(searchReq("q=%ED%95%9C%EC%86%94%EB%AC%BC%EB%A5%98"));
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    // Prisma.sql renders parameters as `?` placeholders in the rendered SQL,
    // with the actual values exposed via `selectSql.values` — assert both.
    expect(selectSql.sql).toMatch(/"orgId"\s*=\s*\?/);
    expect(selectSql.sql).toMatch(/"deletedAt"\s+IS\s+NULL/);
    expect(selectSql.values).toContain("org_test");
  });

  it("type=SUPPLIER injects a typed param, not a string concat", async () => {
    await GET(searchReq("q=%ED%95%9C%EC%86%94%EB%AC%BC%EB%A5%98&type=SUPPLIER"));
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    expect(selectSql.sql).toMatch(/"type"\s*=\s*\?::"CounterpartyType"/);
    expect(selectSql.values).toContain("SUPPLIER");
  });

  it("limit is clamped via Zod (max 50)", async () => {
    const res = await GET(searchReq("q=test&limit=1000"));
    expect(res.status).toBe(400);
  });

  it("limit defaults to 20 when omitted", async () => {
    await GET(searchReq("q=test"));
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    expect(selectSql.values).toContain(20);
  });
});

describe("GET /api/erp/counterparties/search — bizRegNo boost", () => {
  it("10-digit canonical input triggers exact-match projection (sim=1.0) + OR arm", async () => {
    queryRawMock.mockReset();
    queryRawMock
      .mockResolvedValueOnce([{ set_limit: 0.3 }])
      .mockResolvedValueOnce([
        {
          id: "cp_biz",
          name: "에이비씨",
          normalizedName: "에이비씨",
          bizRegNo: "1234567890",
          type: "CUSTOMER",
          defaultCoaCode: null,
          sim: 1,
          matched_by: "bizRegNo",
        },
      ]);

    const res = await GET(searchReq("q=123-45-67890"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ matchedBy: string; similarity: number }>;
      query: { bizRegLookup: string };
    };
    expect(body.query.bizRegLookup).toBe("1234567890");
    expect(body.items[0]).toMatchObject({
      matchedBy: "bizRegNo",
      similarity: 1,
    });

    const selectSql = asSql(queryRawMock.mock.calls[1]);
    expect(selectSql.sql).toMatch(/CASE WHEN "bizRegNo"\s*=\s*\?/);
    expect(selectSql.sql).toMatch(/OR "bizRegNo"\s*=\s*\?/);
    expect(selectSql.values).toContain("1234567890");
  });

  it("non-canonical numeric (e.g. 9 digits) does NOT trigger bizRegNo boost", async () => {
    await GET(searchReq("q=123456789"));
    const selectSql = asSql(queryRawMock.mock.calls[1]);
    expect(selectSql.sql).not.toMatch(/OR "bizRegNo"\s*=/);
  });
});

describe("GET /api/erp/counterparties/search — RED cases", () => {
  it("RED — empty q → 400 (Zod min(1))", async () => {
    const res = await GET(searchReq("q="));
    expect(res.status).toBe(400);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("RED — whitespace-only q → 400 (Zod trims first)", async () => {
    const res = await GET(searchReq("q=%20%20%20"));
    expect(res.status).toBe(400);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("RED — q that normalizes to empty (e.g. '(주)' alone) → 400 (no useless scan)", async () => {
    // "(주)" normalizes to "" after prefix strip
    const res = await GET(searchReq("q=%28%EC%A3%BC%29"));
    expect(res.status).toBe(400);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("RED — missing erp:read scope → 403", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(false);
    const res = await GET(searchReq("q=test"));
    expect(res.status).toBe(403);
  });

  it("RED — unauthenticated → 401", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await GET(searchReq("q=test"));
    expect(res.status).toBe(401);
  });

  it("RED — invalid type param → 400 (Zod enum)", async () => {
    const res = await GET(searchReq("q=test&type=GARBAGE"));
    expect(res.status).toBe(400);
  });
});
