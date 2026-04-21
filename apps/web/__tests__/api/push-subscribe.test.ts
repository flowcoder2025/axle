/**
 * Tests for /api/push/subscribe (WI-226)
 *
 * Covers:
 *   - POST: auth guard, validation, upsert by endpoint
 *   - DELETE: auth guard, endpoint validation, deleteMany call
 *   - GET /api/push/vapid-public-key: success + missing env fallback
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPushSubscription = {
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    pushSubscription: mockPushSubscription,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };

function makeRequest(method: string, body?: unknown, ua?: string): Request {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (ua) headers["user-agent"] = ua;

  return new Request("http://localhost/api/push/subscribe", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
  mockPushSubscription.upsert.mockResolvedValue({ id: "sub-1" });
  mockPushSubscription.deleteMany.mockResolvedValue({ count: 1 });
});

// ==========================================
// POST /api/push/subscribe
// ==========================================

describe("POST /api/push/subscribe", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const { POST } = await import("../../app/api/push/subscribe/route");
    const res = await POST(
      makeRequest("POST", {
        endpoint: "https://push.example/e",
        keys: { p256dh: "p", auth: "a" },
      }) as never
    );

    expect(res.status).toBe(401);
    expect(mockPushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when endpoint is missing", async () => {
    const { POST } = await import("../../app/api/push/subscribe/route");
    const res = await POST(
      makeRequest("POST", { keys: { p256dh: "p", auth: "a" } }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when keys are incomplete", async () => {
    const { POST } = await import("../../app/api/push/subscribe/route");
    const res = await POST(
      makeRequest("POST", {
        endpoint: "https://push.example/e",
        keys: { p256dh: "p" },
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("upserts the subscription by endpoint and returns 201", async () => {
    const { POST } = await import("../../app/api/push/subscribe/route");
    const res = await POST(
      makeRequest(
        "POST",
        {
          endpoint: "https://push.example/ep-123",
          keys: { p256dh: "p256", auth: "auth-val" },
        },
        "Mozilla/5.0 (Test)"
      ) as never
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(mockPushSubscription.upsert).toHaveBeenCalledTimes(1);
    const call = mockPushSubscription.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ endpoint: "https://push.example/ep-123" });
    expect(call.create).toMatchObject({
      userId: "user-1",
      endpoint: "https://push.example/ep-123",
      p256dh: "p256",
      auth: "auth-val",
      userAgent: "Mozilla/5.0 (Test)",
    });
    expect(call.update).toMatchObject({
      userId: "user-1",
      p256dh: "p256",
      auth: "auth-val",
      userAgent: "Mozilla/5.0 (Test)",
    });
  });
});

// ==========================================
// DELETE /api/push/subscribe
// ==========================================

describe("DELETE /api/push/subscribe", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const { DELETE } = await import("../../app/api/push/subscribe/route");
    const res = await DELETE(
      makeRequest("DELETE", { endpoint: "https://push.example/e" }) as never
    );

    expect(res.status).toBe(401);
    expect(mockPushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 when endpoint is missing from body", async () => {
    const { DELETE } = await import("../../app/api/push/subscribe/route");
    const res = await DELETE(makeRequest("DELETE", {}) as never);
    expect(res.status).toBe(400);
    expect(mockPushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes by endpoint and returns 200", async () => {
    const { DELETE } = await import("../../app/api/push/subscribe/route");
    const res = await DELETE(
      makeRequest("DELETE", {
        endpoint: "https://push.example/ep-abc",
      }) as never
    );

    expect(res.status).toBe(200);
    expect(mockPushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example/ep-abc" },
    });
  });
});

// ==========================================
// GET /api/push/vapid-public-key
// ==========================================

describe("GET /api/push/vapid-public-key", () => {
  it("returns the public key when configured", async () => {
    process.env.VAPID_PUBLIC_KEY = "public-key-value";
    const { GET } = await import("../../app/api/push/vapid-public-key/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.publicKey).toBe("public-key-value");
    delete process.env.VAPID_PUBLIC_KEY;
  });

  it("returns 503 when VAPID_PUBLIC_KEY is unset", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const { GET } = await import("../../app/api/push/vapid-public-key/route");
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
