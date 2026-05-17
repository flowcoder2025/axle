/**
 * Phase 21 WI-723b — /api/erp/backfill route tests.
 *
 * The route is a thin orchestrator around `runBackfillChunk`; we mock the
 * engine directly to keep test surface small and assert the route's auth +
 * tenant-scoping contract:
 *   - GET requires `erp:read`, scopes by orgId
 *   - POST requires `erp:write` (RED: 403 without it)
 *   - POST surfaces `lockBusy` as a 400, not a silent success
 *   - resolve route requires `erp:write` and 404s on tenant mismatch
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
  checkModulePermission: vi.fn(),
}));

vi.mock("@/src/lib/tenant-context", () => ({
  getActiveTenant: vi.fn(),
}));

vi.mock("@axle/db", () => {
  const counterpartyBackfillBatch = {
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const erpCounterparty = {
    findFirst: vi.fn(),
  };
  const order = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: {
      counterpartyBackfillBatch,
      erpCounterparty,
      order,
      organization: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) =>
        fn({
          counterpartyBackfillBatch,
          erpCounterparty,
          order,
          $queryRaw: vi.fn(async () => [{ acquired: true }]),
        }),
      ),
    },
  };
});

vi.mock("@/lib/erp/backfill", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/erp/backfill")>(
    "../../../lib/erp/backfill",
  );
  return {
    ...actual,
    runBackfillChunk: vi.fn(),
    startOrResumeBatch: vi.fn(),
    listPendingGroups: vi.fn(),
    resolvePendingGroup: vi.fn(),
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";
import {
  runBackfillChunk,
  startOrResumeBatch,
  listPendingGroups,
  resolvePendingGroup,
} from "@/lib/erp/backfill";

import { GET as GET_LIST, POST as POST_START } from "../../../app/api/erp/backfill/route";
import { GET as GET_ONE } from "../../../app/api/erp/backfill/[batchId]/route";
import { GET as GET_PENDING } from "../../../app/api/erp/backfill/pending/route";
import { POST as POST_RESOLVE } from "../../../app/api/erp/backfill/resolve/route";

const batchMock = (
  prisma as unknown as {
    counterpartyBackfillBatch: Record<string, ReturnType<typeof vi.fn>>;
  }
).counterpartyBackfillBatch;

const orgMock = (
  prisma as unknown as { organization: Record<string, ReturnType<typeof vi.fn>> }
).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    orgId: "org_test",
    status: "RUNNING",
    totalOrders: 0,
    processedOrders: 0,
    matchedCount: 0,
    pendingReview: 0,
    lastOrderId: null,
    startedAt: new Date("2026-05-17"),
    completedAt: null,
    notes: null,
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
  orgMock.findUnique.mockResolvedValue({ name: "test-org" });
});

// ─────────────────────────────────────────────────────────────
// GET /api/erp/backfill (list)
// ─────────────────────────────────────────────────────────────

describe("GET /api/erp/backfill", () => {
  it("returns 200 with serialized batches", async () => {
    batchMock.findMany.mockResolvedValueOnce([makeBatch()]);
    const res = await GET_LIST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ status: string; startedAt: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].status).toBe("RUNNING");
    expect(typeof body.items[0].startedAt).toBe("string");
  });

  it("returns 403 when erp:read is missing (RED)", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(false);
    const res = await GET_LIST();
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/erp/backfill (start + run one chunk)
// ─────────────────────────────────────────────────────────────

describe("POST /api/erp/backfill", () => {
  it("runs one chunk and returns batch + chunk envelope", async () => {
    (startOrResumeBatch as unknown as { mockResolvedValue: Function }).mockResolvedValue({
      batchId: "b1",
      resumed: false,
    });
    (runBackfillChunk as unknown as { mockResolvedValue: Function }).mockResolvedValue({
      processed: 3,
      matched: 2,
      pendingReview: 1,
      finished: true,
      lastOrderId: "o3",
      lockBusy: false,
    });
    batchMock.findFirstOrThrow.mockResolvedValueOnce(
      makeBatch({ processedOrders: 3, matchedCount: 2, pendingReview: 1 }),
    );

    const res = await POST_START(
      jsonReq("http://x/api/erp/backfill", "POST", { dryRun: false }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      batch: { id: string };
      chunk: { matched: number; finished: boolean };
      resumed: boolean;
    };
    expect(body.batch.id).toBe("b1");
    expect(body.chunk.matched).toBe(2);
    expect(body.chunk.finished).toBe(true);
    expect(body.resumed).toBe(false);
  });

  it("returns 400 when another backfill holds the advisory lock", async () => {
    (startOrResumeBatch as unknown as { mockResolvedValue: Function }).mockResolvedValue({
      batchId: "b1",
      resumed: true,
    });
    (runBackfillChunk as unknown as { mockResolvedValue: Function }).mockResolvedValue({
      processed: 0,
      matched: 0,
      pendingReview: 0,
      finished: false,
      lastOrderId: null,
      lockBusy: true,
    });
    const res = await POST_START(jsonReq("http://x/api/erp/backfill", "POST", {}));
    expect(res.status).toBe(400);
  });

  it("returns 403 when erp:write is missing (RED)", async () => {
    (checkModulePermission as unknown as { mockImplementation: Function }).mockImplementation(
      async (_uid: string, _orgId: string, scope: string) => scope === "erp:read",
    );
    const res = await POST_START(jsonReq("http://x/api/erp/backfill", "POST", {}));
    expect(res.status).toBe(403);
  });

  it("validates chunkSize range (400 on > 5000)", async () => {
    const res = await POST_START(
      jsonReq("http://x/api/erp/backfill", "POST", { chunkSize: 100000 }),
    );
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/erp/backfill/[batchId]
// ─────────────────────────────────────────────────────────────

describe("GET /api/erp/backfill/[batchId]", () => {
  it("returns the batch when it belongs to the active tenant", async () => {
    batchMock.findFirst.mockResolvedValueOnce(makeBatch());
    const res = await GET_ONE(jsonReq("http://x/api/erp/backfill/b1", "GET"), {
      params: Promise.resolve({ batchId: "b1" }),
    });
    expect(res.status).toBe(200);
  });

  it("404 when not in tenant", async () => {
    batchMock.findFirst.mockResolvedValueOnce(null);
    const res = await GET_ONE(jsonReq("http://x/api/erp/backfill/b1", "GET"), {
      params: Promise.resolve({ batchId: "b1" }),
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/erp/backfill/pending
// ─────────────────────────────────────────────────────────────

describe("GET /api/erp/backfill/pending", () => {
  it("returns the pending groups from the engine", async () => {
    (listPendingGroups as unknown as { mockResolvedValue: Function }).mockResolvedValue([
      { normalizedName: "에이비씨", sampleName: "(주)에이비씨", orderCount: 4 },
    ]);
    const res = await GET_PENDING(
      jsonReq("http://x/api/erp/backfill/pending?limit=50", "GET"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ normalizedName: string }> };
    expect(body.items[0].normalizedName).toBe("에이비씨");
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/erp/backfill/resolve
// ─────────────────────────────────────────────────────────────

describe("POST /api/erp/backfill/resolve", () => {
  it("returns linked count from the engine", async () => {
    (resolvePendingGroup as unknown as { mockResolvedValue: Function }).mockResolvedValue({
      linked: 4,
    });
    const res = await POST_RESOLVE(
      jsonReq("http://x/api/erp/backfill/resolve", "POST", {
        normalizedName: "에이비씨",
        counterpartyId: "cp1",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ linked: 4 });
  });

  it("maps engine 'counterparty not found' to 404", async () => {
    (resolvePendingGroup as unknown as { mockRejectedValue: Function }).mockRejectedValue(
      new Error("counterparty not found in tenant"),
    );
    const res = await POST_RESOLVE(
      jsonReq("http://x/api/erp/backfill/resolve", "POST", {
        normalizedName: "x",
        counterpartyId: "ghost",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when erp:write is missing (RED)", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(false);
    const res = await POST_RESOLVE(
      jsonReq("http://x/api/erp/backfill/resolve", "POST", {
        normalizedName: "x",
        counterpartyId: "cp1",
      }),
    );
    expect(res.status).toBe(403);
  });
});
