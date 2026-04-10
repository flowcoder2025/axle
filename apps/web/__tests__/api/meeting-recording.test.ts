import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockMeetingOps = {
  findFirst: vi.fn(),
  update: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    meeting: mockMeetingOps,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

const mockUploadFromFormData = vi.fn();

vi.mock("@axle/storage", () => ({
  STORAGE_PACKAGE: "@axle/storage",
  BUCKETS: { DOCUMENTS: "documents", RECORDINGS: "recordings", EXPORTS: "exports" },
  uploadFromFormData: mockUploadFromFormData,
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

function makeFormRequest(url: string, fields: Record<string, string | File>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request(url, { method: "POST", body: formData });
}

function makeRequest(method: string, url: string): Request {
  return new Request(url, { method });
}

// --- POST /api/meetings/[meetingId]/recording ---

describe("POST /api/meetings/[meetingId]/recording", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/recording/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/recording") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" } as never);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/recording/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/recording") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when meeting not in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/recording/route"
    );
    const file = new File(["audio data"], "recording.mp3", { type: "audio/mpeg" });
    const res = await POST(
      makeFormRequest("http://localhost/api/meetings/m1/recording", { file }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when file field is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/recording/route"
    );
    const res = await POST(
      makeFormRequest("http://localhost/api/meetings/m1/recording", {
        other: "value",
      }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for unsupported file type", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/recording/route"
    );
    const file = new File(["data"], "recording.txt", { type: "text/plain" });
    const res = await POST(
      makeFormRequest("http://localhost/api/meetings/m1/recording", { file }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Unsupported file type");
  });

  it("uploads file and updates recordingUrl, returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockUploadFromFormData.mockResolvedValue({
      url: "https://storage.example.com/recordings/m1/audio.mp3",
      path: "org-1/recordings/uuid-audio.mp3",
      size: 1024,
      contentType: "audio/mpeg",
    });
    mockMeetingOps.update.mockResolvedValue({
      id: "m1",
      recordingUrl: "https://storage.example.com/recordings/m1/audio.mp3",
    });
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/recording/route"
    );
    const file = new File(["audio data"], "recording.mp3", { type: "audio/mpeg" });
    const res = await POST(
      makeFormRequest("http://localhost/api/meetings/m1/recording", { file }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.recordingUrl).toBe("https://storage.example.com/recordings/m1/audio.mp3");
    expect(mockUploadFromFormData).toHaveBeenCalledWith(
      "recordings",
      expect.any(FormData),
      "file",
      { orgId: "org-1" }
    );
  });

  it("returns 400 when storage raises StorageValidationError", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const { StorageValidationError } = await import("@axle/storage");
    mockUploadFromFormData.mockRejectedValue(
      new StorageValidationError("File size exceeds limit")
    );
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/recording/route"
    );
    const file = new File(["audio data"], "recording.mp3", { type: "audio/mpeg" });
    const res = await POST(
      makeFormRequest("http://localhost/api/meetings/m1/recording", { file }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
