import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Resend mock ───────────────────────────────────────────────────────────────
const mockEmailsSend = vi.fn();
const mockBatchSend = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockEmailsSend },
    batch: { send: mockBatchSend },
  })),
}));

// ── Module imports (after mock) ───────────────────────────────────────────────
import { sendEmail, sendBatch, resetResendClient } from "../src/client.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function stubEnvKey() {
  vi.stubEnv("RESEND_API_KEY", "test-api-key");
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("sendEmail", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetResendClient();
    vi.clearAllMocks();
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    await expect(
      sendEmail({ to: "user@example.com", subject: "Hello", text: "Hi" })
    ).rejects.toThrow("RESEND_API_KEY");
  });

  it("sends an email and returns {id}", async () => {
    stubEnvKey();
    mockEmailsSend.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({ id: "email-123" });
    expect(mockEmailsSend).toHaveBeenCalledOnce();
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Test",
        html: "<p>Hello</p>",
      })
    );
  });

  it("accepts array of recipients", async () => {
    stubEnvKey();
    mockEmailsSend.mockResolvedValue({ data: { id: "email-456" }, error: null });

    const result = await sendEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "Batch",
      text: "Hi all",
    });

    expect(result.id).toBe("email-456");
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["a@example.com", "b@example.com"] })
    );
  });

  it("uses custom from and replyTo", async () => {
    stubEnvKey();
    mockEmailsSend.mockResolvedValue({ data: { id: "email-789" }, error: null });

    await sendEmail({
      to: "user@example.com",
      subject: "Custom",
      text: "Hi",
      from: "custom@axle.app",
      replyTo: "support@axle.app",
    });

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "custom@axle.app",
        replyTo: "support@axle.app",
      })
    );
  });

  it("throws on Resend API error", async () => {
    stubEnvKey();
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded" },
    });

    await expect(
      sendEmail({ to: "user@example.com", subject: "Test", text: "Hi" })
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("uses default from when not specified", async () => {
    stubEnvKey();
    mockEmailsSend.mockResolvedValue({ data: { id: "email-def" }, error: null });

    await sendEmail({ to: "user@example.com", subject: "Default from", text: "Hi" });

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "AXLE <noreply@axle.app>" })
    );
  });
});

describe("sendBatch", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetResendClient();
    vi.clearAllMocks();
  });

  it("returns empty ids for empty array", async () => {
    stubEnvKey();
    const result = await sendBatch([]);
    expect(result).toEqual({ ids: [] });
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("sends a batch and returns ids", async () => {
    stubEnvKey();
    // Resend batch.send returns { data: CreateBatchSuccessResponse, error: null }
    // where CreateBatchSuccessResponse = { data: { id: string }[] }
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: "b-1" }, { id: "b-2" }] },
      error: null,
    });

    const result = await sendBatch([
      { to: "a@example.com", subject: "A", text: "Hello A" },
      { to: "b@example.com", subject: "B", text: "Hello B" },
    ]);

    expect(result).toEqual({ ids: ["b-1", "b-2"] });
    expect(mockBatchSend).toHaveBeenCalledOnce();
  });

  it("throws on batch API error", async () => {
    stubEnvKey();
    mockBatchSend.mockResolvedValue({
      data: null,
      error: { message: "Server error" },
    });

    await expect(
      sendBatch([{ to: "a@example.com", subject: "Test", text: "Hi" }])
    ).rejects.toThrow("Server error");
  });
});
