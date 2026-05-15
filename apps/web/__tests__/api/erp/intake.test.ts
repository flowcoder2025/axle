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
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  };
  const product = { findMany: vi.fn() };
  const client = { findMany: vi.fn() };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { intakeDraft, product, client, organization },
  };
});

vi.mock("@axle/ocr", () => ({
  parseReceipt: vi.fn(),
}));

vi.mock("@/lib/erp/blob", () => ({
  uploadReceipt: vi.fn(),
  deleteReceipt: vi.fn(),
  listOrphanReceipts: vi.fn(),
}));

import { prisma } from "@axle/db";
import { parseReceipt } from "@axle/ocr";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";
import { uploadReceipt } from "@/lib/erp/blob";

const draftMock = (prisma as unknown as {
  intakeDraft: Record<string, ReturnType<typeof vi.fn>>;
}).intakeDraft;
const productMock = (prisma as unknown as {
  product: Record<string, ReturnType<typeof vi.fn>>;
}).product;
const clientMock = (prisma as unknown as {
  client: Record<string, ReturnType<typeof vi.fn>>;
}).client;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

import { POST as POST_UPLOAD, GET as GET_LIST } from "../../../app/api/erp/intake/route";
import { GET as GET_DETAIL } from "../../../app/api/erp/intake/[draftId]/route";
import { POST as POST_DISCARD } from "../../../app/api/erp/intake/[draftId]/discard/route";

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function makeFile(content = "abc", type = "image/jpeg", name = "r.jpg"): File {
  return new File([content], name, { type });
}

function uploadReq(file: File | null): Request {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return new Request("http://x/api/erp/intake", { method: "POST", body: fd });
}

function listReq(qs = ""): Request {
  return new Request(`http://x/api/erp/intake${qs}`, { method: "GET" });
}

function detailReq(): Request {
  return new Request("http://x/api/erp/intake/d1", { method: "GET" });
}

function discardReq(): Request {
  return new Request("http://x/api/erp/intake/d1/discard", { method: "POST" });
}

function ctx(draftId = "d1") {
  return { params: Promise.resolve({ draftId }) };
}

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    orgId: "org_test",
    userId: "u1",
    blobUrl: "",
    ocrJson: {},
    parsedJson: {},
    matchSuggestions: {},
    status: "PENDING",
    confirmedOrderId: null,
    errorMsg: null,
    createdAt: new Date("2026-05-15T10:00:00Z"),
    updatedAt: new Date("2026-05-15T10:00:00Z"),
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
  (uploadReceipt as unknown as { mockResolvedValue: Function }).mockResolvedValue(
    "https://blob.example/r1.jpg",
  );
  draftMock.create.mockResolvedValue(makeDraft());
  draftMock.update.mockImplementation(async (args: { data: object }) => ({
    ...makeDraft(),
    ...args.data,
  }));
  draftMock.updateMany.mockResolvedValue({ count: 1 });
  draftMock.findFirst.mockResolvedValue(null);
  draftMock.findMany.mockResolvedValue([]);
  productMock.findMany.mockResolvedValue([]);
  clientMock.findMany.mockResolvedValue([]);
  (parseReceipt as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    vendor: "ACME",
    date: "2026-05-15",
    type: "purchase",
    items: [{ name: "콜라 500ml", qty: 2, unitPrice: 1500, unit: "병" }],
    subtotal: 3000,
    tax: 300,
    total: 3300,
    currency: "KRW",
    confidence: 0.92,
  });
});

describe("POST /api/erp/intake — upload happy path", () => {
  it("creates a PENDING draft, uploads to Blob, runs OCR + fuzzy match, returns 201", async () => {
    productMock.findMany.mockResolvedValueOnce([
      { id: "p1", name: "콜라 500ml", sku: "SKU-1", unit: "병", unitPrice: { toString: () => "1500" } },
    ]);
    clientMock.findMany.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);

    const res = await POST_UPLOAD(uploadReq(makeFile()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.draftId).toBe("d1");

    // Draft created with placeholder blobUrl + scoped to active tenant.
    expect(draftMock.create).toHaveBeenCalledTimes(1);
    const createArgs = draftMock.create.mock.calls[0]?.[0];
    expect(createArgs.data).toMatchObject({
      orgId: "org_test",
      userId: "u1",
      blobUrl: "",
      status: "PENDING",
    });
    expect(createArgs.data.id).toBeUndefined();

    expect(uploadReceipt).toHaveBeenCalledWith(
      "org_test",
      "d1",
      expect.any(Buffer),
      "image/jpeg",
    );
    expect(parseReceipt).toHaveBeenCalledTimes(1);

    // Update writes blobUrl + OCR + match suggestions.
    const updateArgs = draftMock.update.mock.calls[0]?.[0];
    expect(updateArgs.where).toEqual({ id: "d1" });
    expect(updateArgs.data.blobUrl).toBe("https://blob.example/r1.jpg");
    expect(updateArgs.data.errorMsg).toBeNull();
    const ms = updateArgs.data.matchSuggestions as {
      items: { candidates: unknown[] }[];
      counterparty: { candidates: unknown[] };
    };
    expect(ms.items).toHaveLength(1);
    expect(ms.items[0].candidates.length).toBeGreaterThan(0);
    expect(ms.counterparty.candidates.length).toBeGreaterThan(0);
  });

  it("stores OCR failure as errorMsg without breaking the request", async () => {
    (parseReceipt as unknown as { mockRejectedValueOnce: Function }).mockRejectedValueOnce(
      new Error("vision timeout"),
    );

    const res = await POST_UPLOAD(uploadReq(makeFile()));
    expect(res.status).toBe(201);
    const updateArgs = draftMock.update.mock.calls[0]?.[0];
    expect(updateArgs.data.errorMsg).toBe("vision timeout");
    expect(updateArgs.data.matchSuggestions).toEqual({});
    // No product/client lookups when OCR failed
    expect(productMock.findMany).not.toHaveBeenCalled();
    expect(clientMock.findMany).not.toHaveBeenCalled();
  });

  it("stringifies Decimal unitPrice so matchSuggestions is JSON-safe", async () => {
    productMock.findMany.mockResolvedValueOnce([
      { id: "p1", name: "콜라", sku: null, unit: "병", unitPrice: { toString: () => "1500.50" } },
    ]);
    const res = await POST_UPLOAD(uploadReq(makeFile()));
    expect(res.status).toBe(201);
    const ms = draftMock.update.mock.calls[0]?.[0].data.matchSuggestions as {
      items: { candidates: { item: { unitPrice: unknown } }[] }[];
    };
    const firstCandidate = ms.items[0]?.candidates[0];
    expect(typeof firstCandidate?.item.unitPrice).toBe("string");
    expect(firstCandidate?.item.unitPrice).toBe("1500.50");
  });
});

describe("POST /api/erp/intake — validation", () => {
  it("400 when no file field is present", async () => {
    const res = await POST_UPLOAD(uploadReq(null));
    expect(res.status).toBe(400);
    expect(draftMock.create).not.toHaveBeenCalled();
  });

  it("400 when uploaded file is not an image", async () => {
    const res = await POST_UPLOAD(
      uploadReq(makeFile("not-an-image", "application/pdf", "x.pdf")),
    );
    expect(res.status).toBe(400);
    expect(draftMock.create).not.toHaveBeenCalled();
  });

  it("413 when file exceeds 10MB", async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    const res = await POST_UPLOAD(uploadReq(big));
    expect(res.status).toBe(413);
    expect(draftMock.create).not.toHaveBeenCalled();
  });

  it("401 when no user is authenticated", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await POST_UPLOAD(uploadReq(makeFile()));
    expect(res.status).toBe(401);
    expect(draftMock.create).not.toHaveBeenCalled();
  });

  it("403 when erp:write scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await POST_UPLOAD(uploadReq(makeFile()));
    expect(res.status).toBe(403);
    expect(draftMock.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/erp/intake — list", () => {
  it("returns tenant-scoped drafts sorted desc by createdAt, capped at 50", async () => {
    draftMock.findMany.mockResolvedValueOnce([makeDraft(), makeDraft({ id: "d2" })]);
    const res = await GET_LIST(listReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);
    const args = draftMock.findMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({ orgId: "org_test" });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.take).toBe(50);
  });

  it("applies status filter when valid", async () => {
    await GET_LIST(listReq("?status=PENDING"));
    const args = draftMock.findMany.mock.calls[0]?.[0];
    expect(args.where).toMatchObject({ orgId: "org_test", status: "PENDING" });
  });

  it("ignores unknown status filter", async () => {
    await GET_LIST(listReq("?status=NOPE"));
    const args = draftMock.findMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({ orgId: "org_test" });
  });

  it("403 when erp:read scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET_LIST(listReq());
    expect(res.status).toBe(403);
    expect(draftMock.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/erp/intake/[draftId] — detail", () => {
  it("returns the draft when scoped to the active tenant", async () => {
    draftMock.findFirst.mockResolvedValueOnce(makeDraft());
    const res = await GET_DETAIL(detailReq(), ctx());
    expect(res.status).toBe(200);
    const args = draftMock.findFirst.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "d1", orgId: "org_test" });
  });

  it("404 when draftId is in another tenant", async () => {
    draftMock.findFirst.mockResolvedValueOnce(null);
    const res = await GET_DETAIL(detailReq(), ctx("foreign"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/erp/intake/[draftId]/discard", () => {
  it("PENDING → DISCARDED (count=1) returns 200", async () => {
    draftMock.updateMany.mockResolvedValueOnce({ count: 1 });
    const res = await POST_DISCARD(discardReq(), ctx());
    expect(res.status).toBe(200);
    const args = draftMock.updateMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "d1", status: "PENDING", orgId: "org_test" });
    expect(args.data).toEqual({ status: "DISCARDED" });
  });

  it("CONFIRMED draft → 409 (count=0)", async () => {
    draftMock.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await POST_DISCARD(discardReq(), ctx());
    expect(res.status).toBe(409);
  });

  it("Cross-tenant draftId → 409", async () => {
    draftMock.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await POST_DISCARD(discardReq(), ctx("foreign"));
    expect(res.status).toBe(409);
  });

  it("403 when erp:write scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await POST_DISCARD(discardReq(), ctx());
    expect(res.status).toBe(403);
    expect(draftMock.updateMany).not.toHaveBeenCalled();
  });
});
