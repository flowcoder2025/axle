import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (declared before route imports) ---

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
  checkModulePermission: vi.fn(),
}));

vi.mock("@/src/lib/tenant-context", () => ({
  getActiveTenant: vi.fn(),
}));

vi.mock("@axle/db", () => {
  const erpCounterparty = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { erpCounterparty, organization },
  };
});

import { prisma } from "@axle/db";
const cpMock = (
  prisma as unknown as { erpCounterparty: Record<string, ReturnType<typeof vi.fn>> }
).erpCounterparty;
const organizationMock = (
  prisma as unknown as { organization: Record<string, ReturnType<typeof vi.fn>> }
).organization;

import { GET, POST } from "../../../app/api/erp/counterparties/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "../../../app/api/erp/counterparties/[counterpartyId]/route";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeCp(overrides: Record<string, unknown> = {}) {
  return {
    id: "cp1",
    orgId: "org_test",
    name: "에이비씨",
    normalizedName: "에이비씨",
    bizRegNo: null,
    address: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    type: "CUSTOMER",
    defaultCoaCode: null,
    deletedAt: null,
    mergedIntoId: null,
    createdAt: new Date("2026-05-17"),
    updatedAt: new Date("2026-05-17"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
    authedUser,
  );
  (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
    true,
  );
  (getActiveTenant as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    id: "org_test",
    isManaged: false,
    name: "test-org",
  });
  organizationMock.findUnique.mockResolvedValue({ name: "test-org" });
  cpMock.findMany.mockResolvedValue([]);
  cpMock.findFirst.mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────
// GET /api/erp/counterparties
// ─────────────────────────────────────────────────────────────

describe("GET /api/erp/counterparties", () => {
  it("returns 200 with empty list when nothing matches", async () => {
    const res = await GET(jsonReq("http://x/api/erp/counterparties", "GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it("scopes query to active tenant + hides soft-deleted rows by default", async () => {
    cpMock.findMany.mockResolvedValueOnce([makeCp()]);
    await GET(jsonReq("http://x/api/erp/counterparties", "GET"));
    const args = cpMock.findMany.mock.calls[0]?.[0];
    expect(args.where.orgId).toBe("org_test");
    expect(args.where.deletedAt).toBeNull();
  });

  it("includeDeleted=1 lifts the deletedAt filter", async () => {
    await GET(jsonReq("http://x/api/erp/counterparties?includeDeleted=1", "GET"));
    const args = cpMock.findMany.mock.calls[0]?.[0];
    expect("deletedAt" in args.where).toBe(false);
  });

  it("type=SUPPLIER filters by type", async () => {
    await GET(jsonReq("http://x/api/erp/counterparties?type=SUPPLIER", "GET"));
    const args = cpMock.findMany.mock.calls[0]?.[0];
    expect(args.where.type).toBe("SUPPLIER");
  });

  it("invalid type param is silently ignored (no 400)", async () => {
    const res = await GET(jsonReq("http://x/api/erp/counterparties?type=GARBAGE", "GET"));
    expect(res.status).toBe(200);
    const args = cpMock.findMany.mock.calls[0]?.[0];
    expect("type" in args.where).toBe(false);
  });

  it("q normalizes input before substring search (Korean prefix strip)", async () => {
    await GET(jsonReq("http://x/api/erp/counterparties?q=%28%EC%A3%BC%29%EC%97%90%EC%9D%B4%EB%B9%84%EC%94%A8", "GET"));
    // q = "(주)에이비씨" → normalized = "에이비씨"
    const args = cpMock.findMany.mock.calls[0]?.[0];
    expect(args.where.OR[0].normalizedName.contains).toBe("에이비씨");
  });

  it("returns 401 when no user", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await GET(jsonReq("http://x/api/erp/counterparties", "GET"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when erp:read scope is missing (RED case)", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET(jsonReq("http://x/api/erp/counterparties", "GET"));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/erp/counterparties
// ─────────────────────────────────────────────────────────────

describe("POST /api/erp/counterparties", () => {
  it("creates with computed normalizedName + canonicalized bizRegNo", async () => {
    cpMock.create.mockResolvedValueOnce(
      makeCp({
        name: "(주)한솔물류",
        normalizedName: "한솔물류",
        bizRegNo: "1234567890",
        type: "SUPPLIER",
      }),
    );
    const res = await POST(
      jsonReq("http://x/api/erp/counterparties", "POST", {
        name: "(주)한솔물류",
        bizRegNo: "123-45-67890",
        type: "SUPPLIER",
      }),
    );
    expect(res.status).toBe(201);
    const args = cpMock.create.mock.calls[0]?.[0]?.data;
    expect(args.normalizedName).toBe("한솔물류");
    expect(args.bizRegNo).toBe("1234567890"); // dashes stripped
    expect(args.orgId).toBe("org_test");
  });

  it("rejects bizRegNo with non-10-digit length (400)", async () => {
    const res = await POST(
      jsonReq("http://x/api/erp/counterparties", "POST", {
        name: "ABC",
        bizRegNo: "12345",
        type: "CUSTOMER",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts null bizRegNo (partial unique allows multiple NULL)", async () => {
    cpMock.create.mockResolvedValueOnce(makeCp());
    const res = await POST(
      jsonReq("http://x/api/erp/counterparties", "POST", {
        name: "에이비씨",
        bizRegNo: null,
        type: "CUSTOMER",
      }),
    );
    expect(res.status).toBe(201);
  });

  it("returns 409 on partial-unique violation (P2002)", async () => {
    const { Prisma } = await import("@prisma/client");
    cpMock.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "7.0.0",
      }),
    );
    const res = await POST(
      jsonReq("http://x/api/erp/counterparties", "POST", {
        name: "에이비씨",
        bizRegNo: "1234567890",
        type: "CUSTOMER",
      }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 on missing required fields", async () => {
    const res = await POST(
      jsonReq("http://x/api/erp/counterparties", "POST", { name: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when erp:write scope is missing (RED case)", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await POST(
      jsonReq("http://x/api/erp/counterparties", "POST", {
        name: "ABC",
        type: "CUSTOMER",
      }),
    );
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/erp/counterparties/[id]
// ─────────────────────────────────────────────────────────────

describe("GET /api/erp/counterparties/[id]", () => {
  it("returns 200 + serialized row", async () => {
    cpMock.findFirst.mockResolvedValueOnce(makeCp());
    const res = await GET_ONE(jsonReq("http://x/api/erp/counterparties/cp1", "GET"), {
      params: Promise.resolve({ counterpartyId: "cp1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("cp1");
    expect(json.createdAt).toMatch(/^2026-05-17/); // Date → ISO
  });

  it("returns 404 when not found in active tenant", async () => {
    const res = await GET_ONE(jsonReq("http://x/api/erp/counterparties/cp404", "GET"), {
      params: Promise.resolve({ counterpartyId: "cp404" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for soft-deleted row by default; includeDeleted=1 reveals it", async () => {
    cpMock.findFirst.mockResolvedValueOnce(null); // default filter excludes deletedAt
    const res1 = await GET_ONE(jsonReq("http://x/api/erp/counterparties/cp1", "GET"), {
      params: Promise.resolve({ counterpartyId: "cp1" }),
    });
    expect(res1.status).toBe(404);

    cpMock.findFirst.mockResolvedValueOnce(makeCp({ deletedAt: new Date("2026-05-10") }));
    const res2 = await GET_ONE(
      jsonReq("http://x/api/erp/counterparties/cp1?includeDeleted=1", "GET"),
      { params: Promise.resolve({ counterpartyId: "cp1" }) },
    );
    expect(res2.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/erp/counterparties/[id]
// ─────────────────────────────────────────────────────────────

describe("PATCH /api/erp/counterparties/[id]", () => {
  it("recomputes normalizedName when name changes", async () => {
    cpMock.findFirst.mockResolvedValueOnce({ id: "cp1" });
    cpMock.update.mockResolvedValueOnce(makeCp({ name: "(주)한솔", normalizedName: "한솔" }));
    await PATCH(
      jsonReq("http://x/api/erp/counterparties/cp1", "PATCH", { name: "(주)한솔" }),
      { params: Promise.resolve({ counterpartyId: "cp1" }) },
    );
    const args = cpMock.update.mock.calls[0]?.[0]?.data;
    expect(args.name).toBe("(주)한솔");
    expect(args.normalizedName).toBe("한솔");
  });

  it("does NOT touch normalizedName when name is not in the body", async () => {
    cpMock.findFirst.mockResolvedValueOnce({ id: "cp1" });
    cpMock.update.mockResolvedValueOnce(makeCp());
    await PATCH(
      jsonReq("http://x/api/erp/counterparties/cp1", "PATCH", { contactPhone: "010-..." }),
      { params: Promise.resolve({ counterpartyId: "cp1" }) },
    );
    const args = cpMock.update.mock.calls[0]?.[0]?.data;
    expect("normalizedName" in args).toBe(false);
  });

  it("returns 404 for unknown id in active tenant", async () => {
    const res = await PATCH(
      jsonReq("http://x/api/erp/counterparties/cp404", "PATCH", { name: "x" }),
      { params: Promise.resolve({ counterpartyId: "cp404" }) },
    );
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/erp/counterparties/[id]
// ─────────────────────────────────────────────────────────────

describe("DELETE /api/erp/counterparties/[id]", () => {
  it("performs soft-delete (sets deletedAt, does not call delete)", async () => {
    cpMock.findFirst.mockResolvedValueOnce({ id: "cp1" });
    cpMock.update.mockResolvedValueOnce(
      makeCp({ deletedAt: new Date("2026-05-17") }),
    );
    const res = await DELETE(jsonReq("http://x/api/erp/counterparties/cp1", "DELETE"), {
      params: Promise.resolve({ counterpartyId: "cp1" }),
    });
    expect(res.status).toBe(200);
    const args = cpMock.update.mock.calls[0]?.[0]?.data;
    expect(args.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 404 if already soft-deleted or unknown", async () => {
    const res = await DELETE(
      jsonReq("http://x/api/erp/counterparties/cp404", "DELETE"),
      { params: Promise.resolve({ counterpartyId: "cp404" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when erp:write scope is missing (RED case)", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await DELETE(jsonReq("http://x/api/erp/counterparties/cp1", "DELETE"), {
      params: Promise.resolve({ counterpartyId: "cp1" }),
    });
    expect(res.status).toBe(403);
  });
});
