/**
 * WI-208 — unit tests for the HWPX template edit pipeline:
 *   - POST /api/hwpx/edit
 *   - fieldMap → HwpxEdit[] translation
 *
 * Prisma, storage (upload/download), and the docgen `editHwpx` facade are all
 * mocked so the test runs without a DB or Supabase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Prisma mock ---
const mockHwpxTemplate = {
  findFirst: vi.fn(),
};
const mockClient = {
  findFirst: vi.fn(),
};
const mockProject = {
  findFirst: vi.fn(),
};
const mockDocument = {
  create: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    hwpxTemplate: mockHwpxTemplate,
    client: mockClient,
    project: mockProject,
    document: mockDocument,
  },
}));

// --- Auth mock ---
vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
  requirePlatformAdmin: vi.fn(),
}));

// --- docgen mock ---
const mockEditHwpx = vi.fn();
vi.mock("@axle/docgen", () => ({
  editHwpx: (options: unknown, edits: unknown) =>
    mockEditHwpx(options, edits),
}));

// --- Storage mock ---
const mockUploadFile = vi.fn();
const mockDownloadFile = vi.fn();
vi.mock("@axle/storage", () => ({
  BUCKETS: {
    DOCUMENTS: "documents",
    RECORDINGS: "recordings",
    EXPORTS: "exports",
  },
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
  StorageValidationError: class extends Error {},
}));

import { getCurrentUser } from "@axle/auth";
import { buildEditsFromFieldMap, FieldMapError } from "../../lib/hwpx/field-map";
import type { HwpxFieldMap } from "../../lib/validations/hwpx-template";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== fieldMap translation ====================

describe("buildEditsFromFieldMap", () => {
  it("translates cell, checkbox, and text entries to HwpxEdit objects", () => {
    const fieldMap: HwpxFieldMap = {
      company_name: { type: "cell", table: 0, row: 1, col: 2 },
      agreed: { type: "checkbox", name: "agree_chk" },
      year: { type: "text", search: "{{YEAR}}" },
    };
    const edits = buildEditsFromFieldMap(fieldMap, {
      company_name: "AXLE Inc",
      agreed: true,
      year: "2026",
    });

    expect(edits).toHaveLength(3);
    expect(edits).toContainEqual({
      type: "set_cell",
      table: 0,
      row: 1,
      col: 2,
      value: "AXLE Inc",
    });
    expect(edits).toContainEqual({
      type: "toggle_checkbox",
      name: "agree_chk",
      checked: true,
    });
    expect(edits).toContainEqual({
      type: "replace_text",
      search: "{{YEAR}}",
      replacement: "2026",
    });
  });

  it("skips fields that are declared in the map but not provided", () => {
    const fieldMap: HwpxFieldMap = {
      a: { type: "cell", table: 0, row: 0, col: 0 },
      b: { type: "cell", table: 0, row: 0, col: 1 },
    };
    const edits = buildEditsFromFieldMap(fieldMap, { a: "hello" });
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ type: "set_cell", value: "hello" });
  });

  it("ignores unknown keys in values (forward-compatible)", () => {
    const fieldMap: HwpxFieldMap = {
      a: { type: "cell", table: 0, row: 0, col: 0 },
    };
    const edits = buildEditsFromFieldMap(fieldMap, {
      a: "x",
      unknown_key: "ignored",
    });
    expect(edits).toHaveLength(1);
  });

  it("rejects type mismatches (cell expects string)", () => {
    const fieldMap: HwpxFieldMap = {
      a: { type: "cell", table: 0, row: 0, col: 0 },
    };
    expect(() =>
      buildEditsFromFieldMap(fieldMap, { a: true as unknown as string })
    ).toThrow(FieldMapError);
  });

  it("rejects type mismatches (checkbox expects boolean)", () => {
    const fieldMap: HwpxFieldMap = {
      a: { type: "checkbox", name: "chk" },
    };
    expect(() =>
      buildEditsFromFieldMap(fieldMap, { a: "yes" as unknown as boolean })
    ).toThrow(FieldMapError);
  });
});

// ==================== POST /api/hwpx/edit ====================

describe("POST /api/hwpx/edit", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const { POST } = await import("../../app/api/hwpx/edit/route");
    const res = await POST(
      jsonRequest("http://localhost/api/hwpx/edit", {
        templateId: "t-1",
        values: {},
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      ...authedUser,
      orgId: null as unknown as string,
    } as never);
    const { POST } = await import("../../app/api/hwpx/edit/route");
    const res = await POST(
      jsonRequest("http://localhost/api/hwpx/edit", {
        templateId: "clxvalidcuid00000000001234",
        values: {},
      }) as never
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body (Zod failure)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(authedUser as never);
    const { POST } = await import("../../app/api/hwpx/edit/route");
    const res = await POST(
      jsonRequest("http://localhost/api/hwpx/edit", {
        // missing templateId
        values: { x: "y" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when template is not visible to the caller", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(authedUser as never);
    mockHwpxTemplate.findFirst.mockResolvedValueOnce(null);

    const { POST } = await import("../../app/api/hwpx/edit/route");
    const res = await POST(
      jsonRequest("http://localhost/api/hwpx/edit", {
        templateId: "clxvalidcuid00000000001234",
        values: { a: "hi" },
        clientId: "clxvalidcuid00000000009999",
      }) as never
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when clientId/projectId is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(authedUser as never);
    mockHwpxTemplate.findFirst.mockResolvedValueOnce({
      id: "clxvalidcuid00000000001234",
      orgId: null,
      name: "Venture Form",
      category: "VENTURE",
      storageKey: "platform/hwpx-templates/form.hwpx",
      fieldMap: { a: { type: "cell", table: 0, row: 0, col: 0 } },
      version: 1,
    });

    const { POST } = await import("../../app/api/hwpx/edit/route");
    const res = await POST(
      jsonRequest("http://localhost/api/hwpx/edit", {
        templateId: "clxvalidcuid00000000001234",
        values: { a: "hi" },
      }) as never
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { message: string } };
    expect(json.error.message).toContain("clientId");
  });

  it("fills template, uploads result, and creates Document row", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(authedUser as never);
    mockHwpxTemplate.findFirst.mockResolvedValueOnce({
      id: "clxvalidcuid00000000001234",
      orgId: null,
      name: "Venture Form",
      category: "VENTURE",
      storageKey: "platform/hwpx-templates/form.hwpx",
      fieldMap: {
        company_name: { type: "cell", table: 0, row: 1, col: 2 },
        agreed: { type: "checkbox", name: "agree_chk" },
      },
      version: 1,
    });
    mockClient.findFirst.mockResolvedValueOnce({ id: "client-1" });
    mockDownloadFile.mockResolvedValueOnce(Buffer.from("TEMPLATE"));
    mockEditHwpx.mockResolvedValueOnce(Buffer.from("FILLED"));
    mockUploadFile.mockResolvedValueOnce({
      path: "org-1/documents/abc-test.hwpx",
      url: "https://storage.test/abc-test.hwpx",
      size: 6,
      contentType: "application/x-hwpx",
    });
    mockDocument.create.mockResolvedValueOnce({
      id: "doc-1",
      fileUrl: "https://storage.test/abc-test.hwpx",
    });

    const { POST } = await import("../../app/api/hwpx/edit/route");
    const res = await POST(
      jsonRequest("http://localhost/api/hwpx/edit", {
        templateId: "clxvalidcuid00000000001234",
        values: { company_name: "AXLE Inc", agreed: true },
        filename: "venture-app.hwpx",
        clientId: "clxvalidcuid00000000009999",
      }) as never
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      documentId: string;
      url: string;
    };
    expect(json.documentId).toBe("doc-1");
    expect(json.url).toBe("https://storage.test/abc-test.hwpx");

    // Download → edit → upload order
    expect(mockDownloadFile).toHaveBeenCalledWith(
      "documents",
      "platform/hwpx-templates/form.hwpx"
    );
    expect(mockEditHwpx).toHaveBeenCalledTimes(1);
    const [, editsArg] = mockEditHwpx.mock.calls[0];
    expect(editsArg).toContainEqual({
      type: "set_cell",
      table: 0,
      row: 1,
      col: 2,
      value: "AXLE Inc",
    });
    expect(editsArg).toContainEqual({
      type: "toggle_checkbox",
      name: "agree_chk",
      checked: true,
    });

    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(mockDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "OUTPUT",
        clientId: "client-1",
        projectId: null,
        fileType: "application/x-hwpx",
      }),
      select: { id: true, fileUrl: true },
    });
  });

  it("returns 400 when fieldMap/values type mismatch is detected", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(authedUser as never);
    mockHwpxTemplate.findFirst.mockResolvedValueOnce({
      id: "clxvalidcuid00000000001234",
      orgId: null,
      name: "Venture Form",
      category: "VENTURE",
      storageKey: "platform/hwpx-templates/form.hwpx",
      // Declared as checkbox but the caller passes a string
      fieldMap: { agreed: { type: "checkbox", name: "chk" } },
      version: 1,
    });

    const { POST } = await import("../../app/api/hwpx/edit/route");
    const res = await POST(
      jsonRequest("http://localhost/api/hwpx/edit", {
        templateId: "clxvalidcuid00000000001234",
        values: { agreed: "yes" },
        clientId: "clxvalidcuid00000000009999",
      }) as never
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockEditHwpx).not.toHaveBeenCalled();
  });
});
