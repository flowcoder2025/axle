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
  const intakeDraft = {
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const product = {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const order = { create: vi.fn() };
  const inventoryMovement = { create: vi.fn() };
  const organization = { findUnique: vi.fn() };

  const $transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({ intakeDraft, product, order, inventoryMovement });
  });

  return {
    DB_PACKAGE: "@axle/db",
    prisma: { intakeDraft, product, order, inventoryMovement, organization, $transaction },
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";

const draftMock = (prisma as unknown as {
  intakeDraft: Record<string, ReturnType<typeof vi.fn>>;
}).intakeDraft;
const productMock = (prisma as unknown as {
  product: Record<string, ReturnType<typeof vi.fn>>;
}).product;
const orderMock = (prisma as unknown as {
  order: Record<string, ReturnType<typeof vi.fn>>;
}).order;
const movementMock = (prisma as unknown as {
  inventoryMovement: Record<string, ReturnType<typeof vi.fn>>;
}).inventoryMovement;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;
const txMock = (prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
}).$transaction;

import { POST } from "../../../app/api/erp/intake/[draftId]/confirm/route";

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

interface ConfirmBodyItem {
  productId?: string | null;
  productName: string;
  sku?: string | null;
  qty: number;
  unitPrice: number;
  unit?: string;
  shouldRegister?: boolean;
}

function confirmReq(body: Record<string, unknown>): Request {
  return new Request("http://x/api/erp/intake/d1/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(draftId = "d1") {
  return { params: Promise.resolve({ draftId }) };
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "PURCHASE",
    counterpartyName: "ACME",
    occurredAt: "2026-05-15T10:00:00Z",
    total: 3300,
    tax: 300,
    items: [
      {
        productName: "콜라 500ml",
        qty: 2,
        unitPrice: 1500,
        sku: "SKU-1",
        unit: "병",
        shouldRegister: true,
      },
    ] as ConfirmBodyItem[],
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

  // Default to "lock acquired"
  draftMock.updateMany.mockResolvedValue({ count: 1 });
  draftMock.update.mockResolvedValue({ id: "d1", confirmedOrderId: "ord_1" });

  productMock.upsert.mockImplementation(async (args: { create?: { sku?: string } }) => ({
    id: `p_${args.create?.sku ?? "x"}`,
    sku: args.create?.sku ?? null,
  }));
  productMock.findFirst.mockResolvedValue(null);
  productMock.create.mockImplementation(async (args: { data: { name: string } }) => ({
    id: `p_new_${args.data.name}`,
  }));

  orderMock.create.mockResolvedValue({
    id: "ord_1",
    orgId: "org_test",
    status: "CONFIRMED",
  });
  movementMock.create.mockResolvedValue({});

  txMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({
      intakeDraft: draftMock,
      product: productMock,
      order: orderMock,
      inventoryMovement: movementMock,
    });
  });
});

describe("POST /api/erp/intake/[draftId]/confirm — happy path", () => {
  it("PURCHASE: locks draft, upserts product by sku, creates Order + 1 InventoryMovement(IN), links draft", async () => {
    const res = await POST(confirmReq(validBody()), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderId).toBe("ord_1");

    // Atomic lock with full predicate
    expect(draftMock.updateMany).toHaveBeenCalledTimes(1);
    expect(draftMock.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "d1", status: "PENDING", orgId: "org_test" },
      data: { status: "CONFIRMED" },
    });

    // Product upsert on orgId_sku — restores archived=false
    expect(productMock.upsert).toHaveBeenCalledTimes(1);
    expect(productMock.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { orgId_sku: { orgId: "org_test", sku: "SKU-1" } },
      update: { archived: false },
      create: {
        orgId: "org_test",
        sku: "SKU-1",
        name: "콜라 500ml",
        unit: "병",
        unitPrice: 1500,
      },
    });

    // Order created with RECEIPT_INTAKE source linked to draftId
    expect(orderMock.create).toHaveBeenCalledTimes(1);
    const orderArgs = orderMock.create.mock.calls[0]?.[0];
    expect(orderArgs.data).toMatchObject({
      orgId: "org_test",
      type: "PURCHASE",
      counterpartyName: "ACME",
      status: "CONFIRMED",
      source: "RECEIPT_INTAKE",
      sourceId: "d1",
    });
    expect(orderArgs.data.items.create).toHaveLength(1);
    expect(orderArgs.data.items.create[0]).toMatchObject({
      productId: "p_SKU-1",
      productName: "콜라 500ml",
      qty: 2,
      unitPrice: 1500,
      lineTotal: 3000,
    });

    // InventoryMovement: PURCHASE → IN
    expect(movementMock.create).toHaveBeenCalledTimes(1);
    expect(movementMock.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        orgId: "org_test",
        productId: "p_SKU-1",
        type: "IN",
        qty: 2,
        unitCost: 1500,
        source: "ORDER",
        sourceId: "ord_1",
      },
    });

    // Final link
    expect(draftMock.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { confirmedOrderId: "ord_1" },
    });
  });

  it("SALE: InventoryMovement direction flips to OUT", async () => {
    const res = await POST(confirmReq(validBody({ type: "SALE" })), ctx());
    expect(res.status).toBe(200);
    expect(movementMock.create).toHaveBeenCalledTimes(1);
    expect(movementMock.create.mock.calls[0]?.[0].data.type).toBe("OUT");
  });

  it("does NOT emit a movement for items without a resolved productId (shouldRegister=false, no productId)", async () => {
    const res = await POST(
      confirmReq(
        validBody({
          items: [
            {
              productName: "ad-hoc 화환",
              qty: 1,
              unitPrice: 50000,
              sku: null,
              unit: "개",
              shouldRegister: false,
            },
          ],
        }),
      ),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(productMock.upsert).not.toHaveBeenCalled();
    expect(productMock.create).not.toHaveBeenCalled();
    expect(movementMock.create).not.toHaveBeenCalled();
    // Order item still created with productId: null
    expect(orderMock.create.mock.calls[0]?.[0].data.items.create[0]).toMatchObject({
      productId: null,
      productName: "ad-hoc 화환",
    });
  });

  it("reuses pre-existing productId without upsert", async () => {
    const res = await POST(
      confirmReq(
        validBody({
          items: [
            {
              productId: "p_existing",
              productName: "기존 상품",
              qty: 3,
              unitPrice: 1000,
              shouldRegister: true,
            },
          ],
        }),
      ),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(productMock.upsert).not.toHaveBeenCalled();
    expect(productMock.create).not.toHaveBeenCalled();
    expect(movementMock.create).toHaveBeenCalledTimes(1);
    expect(movementMock.create.mock.calls[0]?.[0].data.productId).toBe(
      "p_existing",
    );
  });
});

describe("POST confirm — idempotency / invalid state", () => {
  it("double confirm: second call → 409, no extra Order created", async () => {
    // 1st call: lock acquired
    draftMock.updateMany.mockResolvedValueOnce({ count: 1 });
    const res1 = await POST(confirmReq(validBody()), ctx());
    expect(res1.status).toBe(200);
    expect(orderMock.create).toHaveBeenCalledTimes(1);

    // 2nd call: lock denied (draft already CONFIRMED)
    draftMock.updateMany.mockResolvedValueOnce({ count: 0 });
    const res2 = await POST(confirmReq(validBody()), ctx());
    expect(res2.status).toBe(409);
    // Total order creates still 1, no second
    expect(orderMock.create).toHaveBeenCalledTimes(1);
    expect(movementMock.create).toHaveBeenCalledTimes(1);
  });

  it("DISCARDED draft → 409 (lock fails)", async () => {
    draftMock.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await POST(confirmReq(validBody()), ctx());
    expect(res.status).toBe(409);
    expect(orderMock.create).not.toHaveBeenCalled();
    expect(productMock.upsert).not.toHaveBeenCalled();
    expect(movementMock.create).not.toHaveBeenCalled();
  });

  it("cross-tenant draftId → 409 (orgId is in lock predicate)", async () => {
    draftMock.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await POST(confirmReq(validBody()), ctx("foreign"));
    expect(res.status).toBe(409);
    expect(orderMock.create).not.toHaveBeenCalled();
  });
});

describe("POST confirm — product upsert + dedup", () => {
  it("same SKU twice in one draft → exactly one upsert call (in-tx cache)", async () => {
    const res = await POST(
      confirmReq(
        validBody({
          items: [
            { productName: "콜라", qty: 1, unitPrice: 1500, sku: "SKU-DUP", shouldRegister: true },
            { productName: "콜라", qty: 2, unitPrice: 1500, sku: "SKU-DUP", shouldRegister: true },
          ],
        }),
      ),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(productMock.upsert).toHaveBeenCalledTimes(1);
    // Both items resolved to the same productId
    expect(movementMock.create).toHaveBeenCalledTimes(2);
    const pids = movementMock.create.mock.calls.map(
      (c) => (c[0] as { data: { productId: string } }).data.productId,
    );
    expect(pids[0]).toBe(pids[1]);
  });

  it("same NAME (no sku) twice in one draft → exactly one product created", async () => {
    // findFirst returns null both times (product doesn't exist yet);
    // the in-tx cache should still dedup so create runs only once.
    productMock.findFirst.mockResolvedValue(null);

    const res = await POST(
      confirmReq(
        validBody({
          items: [
            { productName: "사과", qty: 1, unitPrice: 500, sku: null, shouldRegister: true },
            { productName: "사과", qty: 3, unitPrice: 500, sku: null, shouldRegister: true },
          ],
        }),
      ),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(productMock.create).toHaveBeenCalledTimes(1);
    expect(productMock.upsert).not.toHaveBeenCalled();
    expect(movementMock.create).toHaveBeenCalledTimes(2);
    const pids = movementMock.create.mock.calls.map(
      (c) => (c[0] as { data: { productId: string } }).data.productId,
    );
    expect(pids[0]).toBe(pids[1]);
  });

  it("name-only path uses findFirst → returns existing if present (no create)", async () => {
    productMock.findFirst.mockResolvedValueOnce({
      id: "p_existing_byname",
      name: "사과",
    });
    const res = await POST(
      confirmReq(
        validBody({
          items: [
            { productName: "사과", qty: 1, unitPrice: 500, sku: null, shouldRegister: true },
          ],
        }),
      ),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(productMock.create).not.toHaveBeenCalled();
    expect(productMock.upsert).not.toHaveBeenCalled();
    expect(movementMock.create.mock.calls[0]?.[0].data.productId).toBe(
      "p_existing_byname",
    );
  });

  it("sku-collision: upsert update.archived=false restores soft-deleted product", async () => {
    productMock.upsert.mockResolvedValueOnce({ id: "p_existing_sku", sku: "SKU-RES" });
    const res = await POST(
      confirmReq(
        validBody({
          items: [
            { productName: "재활성", qty: 1, unitPrice: 100, sku: "SKU-RES", shouldRegister: true },
          ],
        }),
      ),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(productMock.upsert).toHaveBeenCalledTimes(1);
    expect(productMock.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { orgId_sku: { orgId: "org_test", sku: "SKU-RES" } },
      update: { archived: false },
    });
    expect(productMock.create).not.toHaveBeenCalled();
  });
});

describe("POST confirm — validation + auth", () => {
  it("400 when body fails Zod validation", async () => {
    const res = await POST(confirmReq({ type: "INVALID" }), ctx());
    expect(res.status).toBe(400);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("400 when items is empty", async () => {
    const res = await POST(confirmReq(validBody({ items: [] })), ctx());
    expect(res.status).toBe(400);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("401 when no user is authenticated", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await POST(confirmReq(validBody()), ctx());
    expect(res.status).toBe(401);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("403 when erp:write scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await POST(confirmReq(validBody()), ctx());
    expect(res.status).toBe(403);
    expect(txMock).not.toHaveBeenCalled();
  });
});
