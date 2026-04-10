/**
 * Unit tests for triggerDocumentOcr service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockDocumentOps = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    document: mockDocumentOps,
  },
}));

const mockGetSignedUrl = vi.fn();

vi.mock("@axle/storage", () => ({
  STORAGE_PACKAGE: "@axle/storage",
  BUCKETS: { DOCUMENTS: "documents", RECORDINGS: "recordings", EXPORTS: "exports" },
  getSignedUrl: mockGetSignedUrl,
}));

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

// --- Tests ---

describe("triggerDocumentOcr", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("skips silently when document is not found", async () => {
    mockDocumentOps.findUnique.mockResolvedValue(null);

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await expect(triggerDocumentOcr("nonexistent")).resolves.toBeUndefined();
    expect(mockDocumentOps.update).not.toHaveBeenCalled();
  });

  it("skips unsupported file types without updating DB", async () => {
    mockDocumentOps.findUnique.mockResolvedValue({
      id: "doc-1",
      fileUrl: "https://storage/doc.docx",
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ocrStatus: "NONE",
    });

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-1");
    expect(mockDocumentOps.update).not.toHaveBeenCalled();
  });

  it("skips when ocrStatus is already COMPLETED", async () => {
    mockDocumentOps.findUnique.mockResolvedValue({
      id: "doc-1",
      fileUrl: "https://storage/doc.pdf",
      fileType: "application/pdf",
      ocrStatus: "COMPLETED",
    });

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-1");
    expect(mockDocumentOps.update).not.toHaveBeenCalled();
  });

  it("skips when ocrStatus is already PROCESSING", async () => {
    mockDocumentOps.findUnique.mockResolvedValue({
      id: "doc-1",
      fileUrl: "https://storage/doc.pdf",
      fileType: "application/pdf",
      ocrStatus: "PROCESSING",
    });

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-1");
    expect(mockDocumentOps.update).not.toHaveBeenCalled();
  });

  it("sets PROCESSING then COMPLETED on successful OCR of a PDF", async () => {
    const fakeDoc = {
      id: "doc-1",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/doc.pdf",
      fileType: "application/pdf",
      ocrStatus: "NONE",
    };
    mockDocumentOps.findUnique.mockResolvedValue(fakeDoc);
    mockDocumentOps.update.mockResolvedValue({});
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/doc",
      expiresAt: new Date(),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
    } as unknown as Response);

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          '{"text":"Invoice 2025","language":"ko","pages":2,"summary":"Invoice document","keyFields":{"amount":50000}}',
      },
    });

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-1");

    expect(mockDocumentOps.update).toHaveBeenCalledTimes(2);
    // First call: set PROCESSING
    expect(mockDocumentOps.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ ocrStatus: "PROCESSING" }),
      })
    );
    // Second call: set COMPLETED with ocrResult
    expect(mockDocumentOps.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          ocrStatus: "COMPLETED",
          ocrResult: expect.objectContaining({ text: "Invoice 2025" }),
        }),
      })
    );
  });

  it("sets PROCESSING then COMPLETED on successful OCR of a JPEG", async () => {
    const fakeDoc = {
      id: "doc-img",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/scan.jpg",
      fileType: "image/jpeg",
      ocrStatus: "NONE",
    };
    mockDocumentOps.findUnique.mockResolvedValue(fakeDoc);
    mockDocumentOps.update.mockResolvedValue({});
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/scan",
      expiresAt: new Date(),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as Response);

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '{"text":"Business registration","language":"ko","pages":1,"summary":null,"keyFields":null}',
      },
    });

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-img");

    expect(mockDocumentOps.update).toHaveBeenCalledTimes(2);
    expect(mockDocumentOps.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ ocrStatus: "COMPLETED" }),
      })
    );
  });

  it("sets FAILED when Gemini call throws", async () => {
    const fakeDoc = {
      id: "doc-1",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/doc.png",
      fileType: "image/png",
      ocrStatus: "NONE",
    };
    mockDocumentOps.findUnique.mockResolvedValue(fakeDoc);
    mockDocumentOps.update.mockResolvedValue({});
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/doc",
      expiresAt: new Date(),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as Response);

    mockGenerateContent.mockRejectedValue(new Error("Gemini API error"));

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-1");

    expect(mockDocumentOps.update).toHaveBeenCalledTimes(2);
    expect(mockDocumentOps.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ ocrStatus: "FAILED" }),
      })
    );
  });

  it("sets FAILED when file download returns non-OK response", async () => {
    const fakeDoc = {
      id: "doc-1",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/doc.pdf",
      fileType: "application/pdf",
      ocrStatus: "NONE",
    };
    mockDocumentOps.findUnique.mockResolvedValue(fakeDoc);
    mockDocumentOps.update.mockResolvedValue({});
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/doc",
      expiresAt: new Date(),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    } as unknown as Response);

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-1");

    expect(mockDocumentOps.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ ocrStatus: "FAILED" }),
      })
    );
  });

  it("wraps non-JSON Gemini response as rawText field", async () => {
    const fakeDoc = {
      id: "doc-1",
      fileUrl:
        "https://proj.supabase.co/storage/v1/object/public/documents/org-1/doc.pdf",
      fileType: "application/pdf",
      ocrStatus: "NONE",
    };
    mockDocumentOps.findUnique.mockResolvedValue(fakeDoc);
    mockDocumentOps.update.mockResolvedValue({});
    mockGetSignedUrl.mockResolvedValue({
      url: "https://signed.url/doc",
      expiresAt: new Date(),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as Response);

    // Gemini returns plain text instead of JSON
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "This is a plain text response not JSON",
      },
    });

    const { triggerDocumentOcr } = await import(
      "../../lib/services/document-ocr"
    );
    await triggerDocumentOcr("doc-1");

    expect(mockDocumentOps.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          ocrStatus: "COMPLETED",
          ocrResult: expect.objectContaining({ rawText: expect.any(String) }),
        }),
      })
    );
  });
});
