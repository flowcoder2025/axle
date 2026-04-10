import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockCreateSignedUrl = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
const mockList = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemove,
        list: mockList,
      })),
    },
  })),
}));

// ── Module imports (after mock) ──────────────────────────────────────────────
import { resetStorageClient } from "../src/client.js";
import {
  getSignedUrl,
  getPublicUrl,
  deleteFile,
  getFileMetadata,
} from "../src/download.js";

// ── Tests ────────────────────────────────────────────────────────────────────
describe("getSignedUrl", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    resetStorageClient();
    vi.clearAllMocks();
  });

  it("returns a signed URL with expiresAt", async () => {
    const signedUrl = "https://test.supabase.co/storage/v1/sign/documents/uuid-file.pdf?token=abc";
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl },
      error: null,
    });

    const before = new Date();
    const result = await getSignedUrl("documents", "uuid-file.pdf");
    const after = new Date();

    expect(result.url).toBe(signedUrl);
    // expiresAt should be ~1 hour in the future (default)
    const deltaMs = result.expiresAt.getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(3590 * 1000);
    expect(deltaMs).toBeLessThan(3610 * 1000);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before.getTime() + 3590 * 1000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after.getTime() + 3610 * 1000);
  });

  it("respects a custom expiresIn value", async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed" },
      error: null,
    });

    const result = await getSignedUrl("recordings", "uuid-audio.mp3", 300);
    const deltaMs = result.expiresAt.getTime() - Date.now();

    expect(mockCreateSignedUrl).toHaveBeenCalledWith("uuid-audio.mp3", 300);
    expect(deltaMs).toBeGreaterThan(295 * 1000);
    expect(deltaMs).toBeLessThan(305 * 1000);
  });

  it("throws when Supabase returns an error", async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });

    await expect(getSignedUrl("documents", "missing.pdf")).rejects.toThrow(
      "Failed to create signed URL: Object not found"
    );
  });
});

describe("getPublicUrl", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    resetStorageClient();
    vi.clearAllMocks();
  });

  it("returns the public URL string", () => {
    const publicUrl = "https://test.supabase.co/storage/v1/object/public/exports/report.csv";
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl } });

    const result = getPublicUrl("exports", "report.csv");

    expect(result).toBe(publicUrl);
    expect(mockGetPublicUrl).toHaveBeenCalledWith("report.csv");
  });
});

describe("deleteFile", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    resetStorageClient();
    vi.clearAllMocks();
  });

  it("calls remove with the correct path and resolves on success", async () => {
    mockRemove.mockResolvedValue({ data: [{ name: "uuid-file.pdf" }], error: null });

    await expect(deleteFile("documents", "uuid-file.pdf")).resolves.toBeUndefined();
    expect(mockRemove).toHaveBeenCalledWith(["uuid-file.pdf"]);
  });

  it("throws when Supabase returns an error", async () => {
    mockRemove.mockResolvedValue({
      data: null,
      error: { message: "Delete forbidden" },
    });

    await expect(deleteFile("documents", "uuid-file.pdf")).rejects.toThrow(
      "Failed to delete file: Delete forbidden"
    );
  });
});

describe("getFileMetadata", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    resetStorageClient();
    vi.clearAllMocks();
  });

  it("returns metadata for an existing file", async () => {
    const updatedAt = "2024-06-01T12:00:00.000Z";
    mockList.mockResolvedValue({
      data: [
        {
          name: "uuid-report.pdf",
          updated_at: updatedAt,
          metadata: { size: 2048, mimetype: "application/pdf" },
        },
      ],
      error: null,
    });

    const meta = await getFileMetadata("documents", "org-1/uuid-report.pdf");

    expect(meta.size).toBe(2048);
    expect(meta.contentType).toBe("application/pdf");
    expect(meta.lastModified).toEqual(new Date(updatedAt));
    expect(mockList).toHaveBeenCalledWith("org-1", { search: "uuid-report.pdf", limit: 1 });
  });

  it("handles a top-level path with no directory component", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          name: "file.csv",
          updated_at: "2024-01-01T00:00:00.000Z",
          metadata: { size: 512, mimetype: "text/csv" },
        },
      ],
      error: null,
    });

    const meta = await getFileMetadata("exports", "file.csv");
    expect(meta.size).toBe(512);
    expect(mockList).toHaveBeenCalledWith("", { search: "file.csv", limit: 1 });
  });

  it("throws when the file is not found in the listing", async () => {
    mockList.mockResolvedValue({ data: [], error: null });

    await expect(getFileMetadata("documents", "missing.pdf")).rejects.toThrow(
      "File not found: documents/missing.pdf"
    );
  });

  it("throws when Supabase returns an error", async () => {
    mockList.mockResolvedValue({
      data: null,
      error: { message: "Access denied" },
    });

    await expect(getFileMetadata("documents", "uuid-file.pdf")).rejects.toThrow(
      "Failed to retrieve file metadata: Access denied"
    );
  });
});
