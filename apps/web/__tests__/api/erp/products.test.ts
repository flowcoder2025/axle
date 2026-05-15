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
  const product = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { product, organization },
  };
});

import { prisma } from "@axle/db";
const productMock = (prisma as unknown as { product: Record<string, ReturnType<typeof vi.fn>> })
  .product;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

import { GET, POST } from "../../../app/api/erp/products/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "../../../app/api/erp/products/[productId]/route";
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

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    orgId: "org_test",
    sku: null,
    name: "콜라",
    unit: "캔",
    unitPrice: 1500,
    category: null,
    archived: false,
    createdAt: new Date("2026-05-15"),
    updatedAt: new Date("2026-05-15"),
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
  productMock.findMany.mockResolvedValue([]);
  productMock.findFirst.mockResolvedValue(null);
});

describe("GET /api/erp/products", () => {
  it("returns 200 with an empty list when nothing matches", async () => {
    const res = await GET(jsonReq("http://x/api/erp/products", "GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it("scopes the prisma query to the active tenant orgId and filters archived by default", async () => {
    productMock.findMany.mockResolvedValueOnce([makeProduct()]);
    const res = await GET(jsonReq("http://x/api/erp/products", "GET"));
    expect(res.status).toBe(200);
    const args = productMock.findMany.mock.calls[0]?.[0];
    expect(args.where.orgId).toBe("org_test");
    expect(args.where.archived).toBe(false);
  });

  it("includes archived when ?includeArchived=1", async () => {
    await GET(jsonReq("http://x/api/erp/products?includeArchived=1", "GET"));
    const args = productMock.findMany.mock.calls[0]?.[0];
    expect(args.where.archived).toBeUndefined();
  });

  it("returns 401 when no user", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      null,
    );
    const res = await GET(jsonReq("http://x/api/erp/products", "GET"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET(jsonReq("http://x/api/erp/products", "GET"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/erp/products", () => {
  it("creates a product and returns 201 with serialized output", async () => {
    productMock.create.mockResolvedValueOnce(
      makeProduct({ name: "콜라", unit: "캔" }),
    );
    const res = await POST(
      jsonReq("http://x/api/erp/products", "POST", { name: "콜라", unit: "캔" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("p1");
    expect(body.name).toBe("콜라");
    // Decimal-shaped output should be a string after serialization.
    expect(typeof body.unitPrice).toBe("string");

    const createArgs = productMock.create.mock.calls[0]?.[0];
    expect(createArgs.data.orgId).toBe("org_test");
    expect(createArgs.data.name).toBe("콜라");
  });

  it("returns 400 on invalid body", async () => {
    const res = await POST(
      jsonReq("http://x/api/erp/products", "POST", { unit: "캔" }), // missing name
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when erp:write scope missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await POST(
      jsonReq("http://x/api/erp/products", "POST", { name: "콜라", unit: "캔" }),
    );
    expect(res.status).toBe(403);
  });

  it("maps Prisma P2002 unique-violation to 409 CONFLICT with field info", async () => {
    // Recreate the prisma KnownRequestError shape without depending on the
    // runtime class (the mocked `@axle/db` doesn't import Prisma's error
    // classes). `lib/erp/auth.ts:toResponse` matches with
    // `err instanceof Prisma.PrismaClientKnownRequestError`, so we
    // construct via the real class.
    const { Prisma } = await import("@prisma/client");
    const err = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`sku`)",
      { code: "P2002", clientVersion: "x.y", meta: { target: ["sku"] } },
    );
    productMock.create.mockRejectedValueOnce(err);

    const res = await POST(
      jsonReq("http://x/api/erp/products", "POST", { name: "콜라", unit: "캔", sku: "DUP" }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.fields).toEqual(["sku"]);
  });
});

describe("GET /api/erp/products/[productId]", () => {
  it("returns the product when it exists in the active tenant", async () => {
    productMock.findFirst.mockResolvedValueOnce(makeProduct());
    const res = await GET_ONE(jsonReq("http://x/api/erp/products/p1", "GET"), {
      params: Promise.resolve({ productId: "p1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("p1");

    const args = productMock.findFirst.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "p1", orgId: "org_test" });
  });

  it("returns 404 when not found", async () => {
    productMock.findFirst.mockResolvedValueOnce(null);
    const res = await GET_ONE(jsonReq("http://x/api/erp/products/missing", "GET"), {
      params: Promise.resolve({ productId: "missing" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/erp/products/[productId]", () => {
  it("updates fields and returns serialized product", async () => {
    productMock.findFirst.mockResolvedValueOnce({ id: "p1" });
    productMock.update.mockResolvedValueOnce(
      makeProduct({ name: "사이다", unitPrice: 1800 }),
    );
    const res = await PATCH(
      jsonReq("http://x/api/erp/products/p1", "PATCH", { name: "사이다", unitPrice: 1800 }),
      { params: Promise.resolve({ productId: "p1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("사이다");
    const args = productMock.update.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "p1" });
    expect(args.data.name).toBe("사이다");
    expect(args.data.unitPrice).toBe(1800);
  });

  it("returns 404 when target doesn't belong to active tenant", async () => {
    productMock.findFirst.mockResolvedValueOnce(null);
    const res = await PATCH(
      jsonReq("http://x/api/erp/products/p1", "PATCH", { name: "x" }),
      { params: Promise.resolve({ productId: "p1" }) },
    );
    expect(res.status).toBe(404);
    expect(productMock.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/erp/products/[productId]", () => {
  it("soft deletes (archived=true) instead of hard delete", async () => {
    productMock.findFirst.mockResolvedValueOnce({ id: "p1" });
    productMock.update.mockResolvedValueOnce(makeProduct({ archived: true }));
    const res = await DELETE(jsonReq("http://x/api/erp/products/p1", "DELETE"), {
      params: Promise.resolve({ productId: "p1" }),
    });
    expect(res.status).toBe(200);
    const args = productMock.update.mock.calls[0]?.[0];
    expect(args.data).toEqual({ archived: true });
    const body = await res.json();
    expect(body.archived).toBe(true);
  });

  it("returns 403 when scope missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await DELETE(jsonReq("http://x/api/erp/products/p1", "DELETE"), {
      params: Promise.resolve({ productId: "p1" }),
    });
    expect(res.status).toBe(403);
  });
});
