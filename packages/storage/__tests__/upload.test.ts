import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  })),
}));

// ── Module imports (after mock) ──────────────────────────────────────────────
import { resetStorageClient } from "../src/client.js";
import {
  uploadFile,
  uploadFromFormData,
  StorageValidationError,
} from "../src/upload.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeBuffer = (bytes: number): Buffer => Buffer.alloc(bytes, 0x42);

function setupMocksSuccess(path = "documents/uuid-file.pdf") {
  mockUpload.mockResolvedValue({ data: { path }, error: null });
  mockGetPublicUrl.mockReturnValue({
    data: { publicUrl: `https://supabase.test/storage/v1/object/public/${path}` },
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("uploadFile", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    resetStorageClient();
    vi.clearAllMocks();
  });

  it("uploads a valid PDF buffer and returns UploadResult", async () => {
    setupMocksSuccess("documents/uuid-report.pdf");

    const buffer = makeBuffer(1024);
    const result = await uploadFile("documents", "report.pdf", buffer, {
      contentType: "application/pdf",
      orgId: "org-1",
    });

    expect(result.path).toBe("documents/uuid-report.pdf");
    expect(result.url).toContain("documents/uuid-report.pdf");
    expect(result.size).toBe(1024);
    expect(result.contentType).toBe("application/pdf");
    expect(mockUpload).toHaveBeenCalledOnce();
  });

  it("throws StorageValidationError when file exceeds maxSize", async () => {
    const buffer = makeBuffer(51 * 1024 * 1024); // 51 MB > 50 MB limit

    await expect(
      uploadFile("documents", "huge.pdf", buffer, { contentType: "application/pdf" })
    ).rejects.toThrow(StorageValidationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("throws StorageValidationError for disallowed MIME type", async () => {
    const buffer = makeBuffer(1024);

    await expect(
      uploadFile("documents", "script.exe", buffer, { contentType: "application/x-executable" })
    ).rejects.toThrow(StorageValidationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("accepts audio files in the recordings bucket", async () => {
    setupMocksSuccess("recordings/uuid-meeting.mp3");

    const buffer = makeBuffer(2048);
    const result = await uploadFile("recordings", "meeting.mp3", buffer, {
      contentType: "audio/mpeg",
    });

    expect(result.contentType).toBe("audio/mpeg");
    expect(mockUpload).toHaveBeenCalledOnce();
  });

  it("throws StorageValidationError for audio file in documents bucket", async () => {
    const buffer = makeBuffer(1024);

    await expect(
      uploadFile("documents", "audio.mp3", buffer, { contentType: "audio/mpeg" })
    ).rejects.toThrow(StorageValidationError);
  });

  it("propagates Supabase upload errors", async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: "Bucket not found" },
    });

    const buffer = makeBuffer(1024);
    await expect(
      uploadFile("documents", "file.pdf", buffer, { contentType: "application/pdf" })
    ).rejects.toThrow("Storage upload failed: Bucket not found");
  });

  it("uses custom path when options.path is provided", async () => {
    setupMocksSuccess("custom/path/file.pdf");

    const buffer = makeBuffer(512);
    const result = await uploadFile("documents", "file.pdf", buffer, {
      contentType: "application/pdf",
      path: "custom/path/file.pdf",
    });

    expect(result.path).toBe("custom/path/file.pdf");
    expect(mockUpload).toHaveBeenCalledWith(
      "custom/path/file.pdf",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf" })
    );
  });

  it("respects per-call config override for maxSize", async () => {
    // Allow only 100 bytes
    const buffer = makeBuffer(200);

    await expect(
      uploadFile("documents", "file.pdf", buffer, {
        contentType: "application/pdf",
        config: { maxSize: 100 },
      })
    ).rejects.toThrow(StorageValidationError);
  });
});

describe("uploadFromFormData", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    resetStorageClient();
    vi.clearAllMocks();
  });

  it("extracts file from FormData and uploads", async () => {
    setupMocksSuccess("documents/uuid-form-upload.pdf");

    const bytes = new Uint8Array(512).fill(0x55);
    const file = new File([bytes], "form-upload.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("attachment", file);

    const result = await uploadFromFormData("documents", formData, "attachment");

    expect(result.size).toBe(512);
    expect(result.contentType).toBe("application/pdf");
    expect(mockUpload).toHaveBeenCalledOnce();
  });

  it("throws StorageValidationError when field is missing", async () => {
    const formData = new FormData();

    await expect(
      uploadFromFormData("documents", formData, "missing_field")
    ).rejects.toThrow(StorageValidationError);
  });

  it("throws StorageValidationError when field is a string, not a File", async () => {
    const formData = new FormData();
    formData.append("file", "not-a-file");

    await expect(
      uploadFromFormData("documents", formData, "file")
    ).rejects.toThrow(StorageValidationError);
  });
});
