import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockDocumentOps = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockClientOps = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    document: mockDocumentOps,
    client: mockClientOps,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

const mockUploadFromFormData = vi.fn();
const mockGetSignedUrl = vi.fn();
const mockDeleteFile = vi.fn();

vi.mock("@axle/storage", () => ({
  STORAGE_PACKAGE: "@axle/storage",
  BUCKETS: { DOCUMENTS: "documents", RECORDINGS: "recordings", EXPORTS: "exports" },
  uploadFromFormData: mockUploadFromFormData,
  getSignedUrl: mockGetSignedUrl,
  deleteFile: mockDeleteFile,
  StorageValidationError: class StorageValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "StorageValidationError";
    }
  },
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeFormRequest(url: string, fields: Record<string, string | File>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request(url, { method: "POST", body: formData });
}

// --- Validation schema tests ---

describe("documentUploadSchema", () => {
  it("accepts valid upload input", async () => {
    const { documentUploadSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentUploadSchema.safeParse({
      clientId: "client-1",
      category: "INPUT",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", async () => {
    const { documentUploadSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentUploadSchema.safeParse({ category: "INPUT" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", async () => {
    const { documentUploadSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentUploadSchema.safeParse({
      clientId: "client-1",
      category: "INVALID",
    });
    expect(result.success).toBe(false);
  });
});

describe("documentSearchSchema", () => {
  it("applies defaults when params are absent", async () => {
    const { documentSearchSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentSearchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("coerces string page/pageSize to numbers", async () => {
    const { documentSearchSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentSearchSchema.safeParse({ page: "2", pageSize: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(5);
    }
  });

  it("rejects invalid ocrStatus", async () => {
    const { documentSearchSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentSearchSchema.safeParse({ ocrStatus: "UNKNOWN" });
    expect(result.success).toBe(false);
  });
});

describe("documentUpdateSchema", () => {
  it("accepts all optional fields", async () => {
    const { documentUpdateSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentUpdateSchema.safeParse({
      category: "OUTPUT",
      expiresAt: "2025-12-31T00:00:00.000Z",
      autoRenew: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all optional)", async () => {
    const { documentUpdateSchema } = await import(
      "../../lib/validations/document"
    );
    const result = documentUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// --- GET /api/documents ---

describe("GET /api/documents", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/documents/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/documents") as never
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      orgId: null,
      email: "a@test.com",
    });
    const { GET } = await import("../../app/api/documents/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/documents") as never
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated list of documents", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeDocs = [{ id: "doc-1", name: "test.pdf", category: "INPUT" }];
    mockDocumentOps.findMany.mockResolvedValue(fakeDocs);
    mockDocumentOps.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/documents/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/documents") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ data: fakeDocs, total: 1, page: 1, pageSize: 20 });
  });

  it("filters by clientId when provided", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findMany.mockResolvedValue([]);
    mockDocumentOps.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/documents/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/documents?clientId=client-1"
      ) as never
    );

    expect(mockDocumentOps.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: "client-1" }),
      })
    );
  });
});

// --- POST /api/documents ---

describe("POST /api/documents", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/documents/route");
    const res = await POST(
      makeFormRequest("http://localhost/api/documents", {
        clientId: "client-1",
        category: "INPUT",
        file: new File(["content"], "test.pdf", { type: "application/pdf" }),
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when file is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClientOps.findFirst.mockResolvedValue({ id: "client-1" });

    const { POST } = await import("../../app/api/documents/route");
    // FormData without file field
    const formData = new FormData();
    formData.append("clientId", "client-1");
    formData.append("category", "INPUT");
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when client does not belong to org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClientOps.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/documents/route");
    const res = await POST(
      makeFormRequest("http://localhost/api/documents", {
        clientId: "client-999",
        category: "INPUT",
        file: new File(["content"], "test.pdf", { type: "application/pdf" }),
      }) as never
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("uploads file and creates document record on success", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClientOps.findFirst.mockResolvedValue({ id: "client-1" });
    mockUploadFromFormData.mockResolvedValue({
      path: "org-1/documents/uuid-test.pdf",
      url: "https://example.supabase.co/storage/v1/object/public/documents/org-1/documents/uuid-test.pdf",
      size: 1024,
      contentType: "application/pdf",
    });
    const createdDoc = {
      id: "doc-1",
      clientId: "client-1",
      name: "test.pdf",
      fileUrl: "https://example.supabase.co/storage/v1/object/public/documents/org-1/documents/uuid-test.pdf",
      fileType: "application/pdf",
      category: "INPUT",
    };
    mockDocumentOps.create.mockResolvedValue(createdDoc);

    const { POST } = await import("../../app/api/documents/route");
    const res = await POST(
      makeFormRequest("http://localhost/api/documents", {
        clientId: "client-1",
        category: "INPUT",
        file: new File(["content"], "test.pdf", { type: "application/pdf" }),
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject(createdDoc);
    expect(mockUploadFromFormData).toHaveBeenCalledWith(
      "documents",
      expect.any(FormData),
      "file",
      expect.objectContaining({ path: expect.stringContaining("org-1/documents/") })
    );
  });
});

// --- GET /api/documents/[documentId] ---

describe("GET /api/documents/[documentId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when document not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue(null);
    mockGetSignedUrl.mockResolvedValue({ url: "https://signed.url/doc", expiresAt: new Date() });

    const { GET } = await import("../../app/api/documents/[documentId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/documents/doc-999") as never,
      { params: Promise.resolve({ documentId: "doc-999" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns document with signed URL", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeDoc = {
      id: "doc-1",
      name: "test.pdf",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/documents/uuid-test.pdf",
      fileType: "application/pdf",
      category: "INPUT",
    };
    mockDocumentOps.findFirst.mockResolvedValue(fakeDoc);
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/doc-1",
      expiresAt,
    });

    const { GET } = await import("../../app/api/documents/[documentId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/documents/doc-1") as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.signedUrl).toBe("https://signed.url/doc-1");
  });
});

// --- PATCH /api/documents/[documentId] ---

describe("PATCH /api/documents/[documentId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if document does not belong to org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue(null);

    const { PATCH } = await import(
      "../../app/api/documents/[documentId]/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/documents/doc-x", {
        category: "OUTPUT",
      }) as never,
      { params: Promise.resolve({ documentId: "doc-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates document metadata and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue({ id: "doc-1" });
    const updated = { id: "doc-1", category: "OUTPUT", autoRenew: true };
    mockDocumentOps.update.mockResolvedValue(updated);

    const { PATCH } = await import(
      "../../app/api/documents/[documentId]/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/documents/doc-1", {
        category: "OUTPUT",
        autoRenew: true,
      }) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.category).toBe("OUTPUT");
  });
});

// --- DELETE /api/documents/[documentId] ---

describe("DELETE /api/documents/[documentId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if document not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue(null);

    const { DELETE } = await import(
      "../../app/api/documents/[documentId]/route"
    );
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/documents/doc-999") as never,
      { params: Promise.resolve({ documentId: "doc-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes file from storage and DB, returns deleted:true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue({
      id: "doc-1",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/documents/uuid-test.pdf",
    });
    mockDeleteFile.mockResolvedValue(undefined);
    mockDocumentOps.delete.mockResolvedValue({ id: "doc-1" });

    const { DELETE } = await import(
      "../../app/api/documents/[documentId]/route"
    );
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/documents/doc-1") as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockDeleteFile).toHaveBeenCalledWith(
      "documents",
      "org-1/documents/uuid-test.pdf"
    );
    expect(mockDocumentOps.delete).toHaveBeenCalledWith({
      where: { id: "doc-1" },
    });
  });
});

// --- GET /api/documents/[documentId]/download ---

describe("GET /api/documents/[documentId]/download", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/documents/[documentId]/download/route"
    );
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/documents/doc-1/download"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns JSON with signed URL", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue({
      id: "doc-1",
      name: "test.pdf",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/documents/uuid-test.pdf",
      fileType: "application/pdf",
    });
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/download",
      expiresAt,
    });

    const { GET } = await import(
      "../../app/api/documents/[documentId]/download/route"
    );
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/documents/doc-1/download"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.url).toBe("https://signed.url/download");
    expect(body.data.name).toBe("test.pdf");
  });

  it("redirects when ?redirect=true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue({
      id: "doc-1",
      name: "test.pdf",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/documents/uuid-test.pdf",
      fileType: "application/pdf",
    });
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/download",
      expiresAt: new Date(),
    });

    const { GET } = await import(
      "../../app/api/documents/[documentId]/download/route"
    );
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/documents/doc-1/download?redirect=true"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.url/download");
  });
});
