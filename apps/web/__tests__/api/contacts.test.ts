/**
 * Tests for Contact CRUD API
 * /api/clients/[clientId]/contacts (GET, POST)
 * /api/clients/[clientId]/contacts/[contactId] (GET, PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaContact = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
};

const mockPrismaClient = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
    contact: mockPrismaContact,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };
const CONTACT = {
  id: "contact-1",
  clientId: "client-1",
  name: "Alice",
  position: "CTO",
  department: "Engineering",
  phone: "010-1234-5678",
  email: "alice@example.com",
  isPrimary: true,
  memo: null,
  source: "MANUAL",
  businessCardUrl: null,
  isResearcher: false,
  researchField: null,
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
  mockPrismaClient.findFirst.mockResolvedValue({ id: "client-1" });
});

// ==========================================
// Validation schema tests
// ==========================================

describe("contactCreateSchema", () => {
  it("rejects missing name", async () => {
    const { contactCreateSchema } = await import("../../lib/validations/contact");
    const result = contactCreateSchema.safeParse({ position: "CEO" });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input (name only)", async () => {
    const { contactCreateSchema } = await import("../../lib/validations/contact");
    const result = contactCreateSchema.safeParse({ name: "Alice" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", async () => {
    const { contactCreateSchema } = await import("../../lib/validations/contact");
    const result = contactCreateSchema.safeParse({ name: "Alice", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for optional email", async () => {
    const { contactCreateSchema } = await import("../../lib/validations/contact");
    const result = contactCreateSchema.safeParse({ name: "Alice", email: "" });
    expect(result.success).toBe(true);
  });

  it("defaults isPrimary to false", async () => {
    const { contactCreateSchema } = await import("../../lib/validations/contact");
    const result = contactCreateSchema.safeParse({ name: "Alice" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPrimary).toBe(false);
  });
});

describe("contactUpdateSchema", () => {
  it("allows all fields to be optional", async () => {
    const { contactUpdateSchema } = await import("../../lib/validations/contact");
    const result = contactUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid email even on update", async () => {
    const { contactUpdateSchema } = await import("../../lib/validations/contact");
    const result = contactUpdateSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

// ==========================================
// Collection routes: GET + POST
// ==========================================

describe("GET /api/clients/[clientId]/contacts", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/clients/[clientId]/contacts/route");
    const req = makeRequest("GET", "http://localhost/api/clients/client-1/contacts");
    const res = await GET(req as never, { params: Promise.resolve({ clientId: "client-1" }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when client does not belong to user org", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { GET } = await import("../../app/api/clients/[clientId]/contacts/route");
    const req = makeRequest("GET", "http://localhost/api/clients/wrong/contacts");
    const res = await GET(req as never, { params: Promise.resolve({ clientId: "wrong" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns paginated contacts for valid client", async () => {
    mockPrismaContact.findMany.mockResolvedValue([CONTACT]);
    mockPrismaContact.count.mockResolvedValue(1);
    const { GET } = await import("../../app/api/clients/[clientId]/contacts/route");
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/contacts?page=1&pageSize=20",
    );
    const res = await GET(req as never, { params: Promise.resolve({ clientId: "client-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });
});

describe("POST /api/clients/[clientId]/contacts", () => {
  it("returns 422 for missing required name", async () => {
    const { POST } = await import("../../app/api/clients/[clientId]/contacts/route");
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/contacts",
      { position: "CEO" },
    );
    const res = await POST(req as never, { params: Promise.resolve({ clientId: "client-1" }) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a contact and returns 201", async () => {
    mockPrismaContact.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaContact.create.mockResolvedValue(CONTACT);
    const { POST } = await import("../../app/api/clients/[clientId]/contacts/route");
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/contacts",
      { name: "Alice", isPrimary: true },
    );
    const res = await POST(req as never, { params: Promise.resolve({ clientId: "client-1" }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Alice");
  });

  it("demotes existing primary before setting new primary", async () => {
    mockPrismaContact.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaContact.create.mockResolvedValue({ ...CONTACT, id: "contact-2" });
    const { POST } = await import("../../app/api/clients/[clientId]/contacts/route");
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/contacts",
      { name: "Bob", isPrimary: true },
    );
    await POST(req as never, { params: Promise.resolve({ clientId: "client-1" }) });
    expect(mockPrismaContact.updateMany).toHaveBeenCalledWith({
      where: { clientId: "client-1", isPrimary: true },
      data: { isPrimary: false },
    });
  });
});

// ==========================================
// Item routes: GET, PATCH, DELETE
// ==========================================

describe("GET /api/clients/[clientId]/contacts/[contactId]", () => {
  it("returns single contact", async () => {
    mockPrismaContact.findFirst.mockResolvedValue(CONTACT);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/contacts/[contactId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/contacts/contact-1",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", contactId: "contact-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("contact-1");
  });

  it("returns 404 when contact not found", async () => {
    mockPrismaContact.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/contacts/[contactId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/contacts/ghost",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", contactId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/clients/[clientId]/contacts/[contactId]", () => {
  it("updates and returns the contact", async () => {
    const updated = { ...CONTACT, position: "CEO" };
    mockPrismaContact.findFirst.mockResolvedValue(CONTACT);
    mockPrismaContact.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaContact.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/contacts/[contactId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/contacts/contact-1",
      { position: "CEO" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", contactId: "contact-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.position).toBe("CEO");
  });

  it("demotes other primaries when isPrimary is set to true", async () => {
    mockPrismaContact.findFirst.mockResolvedValue(CONTACT);
    mockPrismaContact.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaContact.update.mockResolvedValue(CONTACT);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/contacts/[contactId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/contacts/contact-1",
      { isPrimary: true },
    );
    await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", contactId: "contact-1" }),
    });
    expect(mockPrismaContact.updateMany).toHaveBeenCalledWith({
      where: { clientId: "client-1", isPrimary: true, id: { not: "contact-1" } },
      data: { isPrimary: false },
    });
  });
});

describe("DELETE /api/clients/[clientId]/contacts/[contactId]", () => {
  it("deletes contact and returns 204", async () => {
    mockPrismaContact.findFirst.mockResolvedValue(CONTACT);
    mockPrismaContact.delete.mockResolvedValue(CONTACT);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/contacts/[contactId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/contacts/contact-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", contactId: "contact-1" }),
    });
    expect(res.status).toBe(204);
    expect(mockPrismaContact.delete).toHaveBeenCalledWith({
      where: { id: "contact-1" },
    });
  });

  it("returns 404 when contact does not exist", async () => {
    mockPrismaContact.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/contacts/[contactId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/contacts/ghost",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", contactId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });
});
