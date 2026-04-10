import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockDocument = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const mockChecklistItem = {
  findFirst: vi.fn(),
  update: vi.fn(),
};
const mockClient = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: {
    document: mockDocument,
    checklistItem: mockChecklistItem,
    client: mockClient,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@axle/storage", () => ({
  BUCKETS: { DOCUMENTS: "documents", RECORDINGS: "recordings", EXPORTS: "exports" },
  uploadFromFormData: vi.fn(),
  StorageValidationError: class StorageValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "StorageValidationError";
    }
  },
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";
import { uploadFromFormData } from "@axle/storage";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeJsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeFormDataRequest(url: string, file?: File): Request {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  return new Request(url, { method: "POST", body: formData });
}

// --- POST /api/upload/[token] ---

describe("POST /api/upload/[token]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when token is not found", async () => {
    mockDocument.findUnique.mockResolvedValue(null);

    const { POST } = await import(
      "../../app/api/upload/[token]/route"
    );
    const res = await POST(
      makeFormDataRequest("http://localhost/api/upload/invalid-token") as never,
      { params: Promise.resolve({ token: "invalid-token" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 410 when token is expired", async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    mockDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      uploadToken: "expired-token",
      tokenExpiresAt: yesterday,
      name: "test.pdf",
    });

    const { POST } = await import(
      "../../app/api/upload/[token]/route"
    );
    const res = await POST(
      makeFormDataRequest("http://localhost/api/upload/expired-token") as never,
      { params: Promise.resolve({ token: "expired-token" }) }
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("returns 400 on storage validation error", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    mockDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      uploadToken: "valid-token",
      tokenExpiresAt: tomorrow,
      name: "test.pdf",
    });

    const { StorageValidationError } = await import("@axle/storage");
    vi.mocked(uploadFromFormData).mockRejectedValue(
      new StorageValidationError("File too large")
    );

    const { POST } = await import(
      "../../app/api/upload/[token]/route"
    );
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const res = await POST(
      makeFormDataRequest("http://localhost/api/upload/valid-token", file) as never,
      { params: Promise.resolve({ token: "valid-token" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("uploads file, updates document, and returns data", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const docStub = {
      id: "doc-1",
      uploadToken: "valid-token",
      tokenExpiresAt: tomorrow,
      name: "invoice.pdf",
    };
    mockDocument.findUnique.mockResolvedValue(docStub);

    vi.mocked(uploadFromFormData).mockResolvedValue({
      path: "documents/uuid-invoice.pdf",
      url: "https://storage.example.com/documents/uuid-invoice.pdf",
      size: 1024,
      contentType: "application/pdf",
    });

    const updatedDoc = {
      id: "doc-1",
      name: "invoice.pdf",
      fileUrl: "https://storage.example.com/documents/uuid-invoice.pdf",
    };
    mockDocument.update.mockResolvedValue(updatedDoc);
    mockChecklistItem.findFirst.mockResolvedValue(null); // no linked item

    const { POST } = await import(
      "../../app/api/upload/[token]/route"
    );
    const file = new File(["content"], "invoice.pdf", { type: "application/pdf" });
    const res = await POST(
      makeFormDataRequest("http://localhost/api/upload/valid-token", file) as never,
      { params: Promise.resolve({ token: "valid-token" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      documentId: "doc-1",
      name: "invoice.pdf",
      fileUrl: "https://storage.example.com/documents/uuid-invoice.pdf",
    });
    // Token should be cleared
    expect(mockDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ uploadToken: null, tokenExpiresAt: null }),
      })
    );
  });

  it("updates linked ChecklistItem status to UPLOADED", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    mockDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      uploadToken: "valid-token",
      tokenExpiresAt: tomorrow,
      name: "invoice.pdf",
    });

    vi.mocked(uploadFromFormData).mockResolvedValue({
      path: "documents/uuid-invoice.pdf",
      url: "https://storage.example.com/documents/uuid-invoice.pdf",
      size: 1024,
      contentType: "application/pdf",
    });

    mockDocument.update.mockResolvedValue({
      id: "doc-1",
      name: "invoice.pdf",
      fileUrl: "https://storage.example.com/documents/uuid-invoice.pdf",
    });

    const linkedItem = { id: "item-1", documentId: "doc-1" };
    mockChecklistItem.findFirst.mockResolvedValue(linkedItem);
    mockChecklistItem.update.mockResolvedValue({ ...linkedItem, status: "UPLOADED" });

    const { POST } = await import(
      "../../app/api/upload/[token]/route"
    );
    const file = new File(["content"], "invoice.pdf", { type: "application/pdf" });
    await POST(
      makeFormDataRequest("http://localhost/api/upload/valid-token", file) as never,
      { params: Promise.resolve({ token: "valid-token" }) }
    );

    expect(mockChecklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1" },
        data: expect.objectContaining({ status: "UPLOADED" }),
      })
    );
  });
});

// --- POST /api/upload/tokens ---

describe("POST /api/upload/tokens", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const { POST } = await import("../../app/api/upload/tokens/route");
    const res = await POST(
      makeJsonRequest("POST", "http://localhost/api/upload/tokens", {
        checklistItemId: "item-1",
        clientId: "client-1",
      }) as never
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when checklistItemId is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);

    const { POST } = await import("../../app/api/upload/tokens/route");
    const res = await POST(
      makeJsonRequest("POST", "http://localhost/api/upload/tokens", {
        clientId: "client-1",
      }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when clientId is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);

    const { POST } = await import("../../app/api/upload/tokens/route");
    const res = await POST(
      makeJsonRequest("POST", "http://localhost/api/upload/tokens", {
        checklistItemId: "item-1",
      }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when client not found in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClient.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/upload/tokens/route");
    const res = await POST(
      makeJsonRequest("POST", "http://localhost/api/upload/tokens", {
        checklistItemId: "item-1",
        clientId: "client-999",
      }) as never
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when checklist item not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClient.findFirst.mockResolvedValue({ id: "client-1" });
    mockChecklistItem.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/upload/tokens/route");
    const res = await POST(
      makeJsonRequest("POST", "http://localhost/api/upload/tokens", {
        checklistItemId: "item-999",
        clientId: "client-1",
      }) as never
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("creates document stub and returns token when no existing document", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClient.findFirst.mockResolvedValue({ id: "client-1" });
    mockChecklistItem.findFirst.mockResolvedValue({
      id: "item-1",
      name: "사업자등록증",
      documentId: null,
      projectId: "proj-1",
    });

    const newDoc = { id: "doc-new" };
    mockDocument.create.mockResolvedValue(newDoc);
    mockChecklistItem.update.mockResolvedValue({ id: "item-1", status: "REQUESTED" });

    const { POST } = await import("../../app/api/upload/tokens/route");
    const res = await POST(
      makeJsonRequest("POST", "http://localhost/api/upload/tokens", {
        checklistItemId: "item-1",
        clientId: "client-1",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({
      uploadUrl: expect.stringContaining("/api/upload/"),
      documentId: "doc-new",
    });
    expect(typeof body.data.token).toBe("string");
    expect(body.data.expiresAt).toBeDefined();

    // ChecklistItem should be updated to REQUESTED
    expect(mockChecklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REQUESTED", documentId: "doc-new" }),
      })
    );
  });

  it("reuses existing document stub and refreshes token", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClient.findFirst.mockResolvedValue({ id: "client-1" });
    mockChecklistItem.findFirst.mockResolvedValue({
      id: "item-1",
      name: "사업자등록증",
      documentId: "doc-existing",
      projectId: "proj-1",
    });

    mockDocument.update.mockResolvedValue({ id: "doc-existing" });

    const { POST } = await import("../../app/api/upload/tokens/route");
    const res = await POST(
      makeJsonRequest("POST", "http://localhost/api/upload/tokens", {
        checklistItemId: "item-1",
        clientId: "client-1",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.documentId).toBe("doc-existing");

    // Should update (not create) document
    expect(mockDocument.update).toHaveBeenCalled();
    expect(mockDocument.create).not.toHaveBeenCalled();
    // Should NOT update ChecklistItem status again
    expect(mockChecklistItem.update).not.toHaveBeenCalled();
  });
});
