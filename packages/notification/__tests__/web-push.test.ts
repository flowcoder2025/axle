import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockSendNotification = vi.fn();
const mockSetVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}));

// --- Tests ---

const VALID_SUBSCRIPTION = {
  endpoint: "https://push.example.com/endpoint",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

const VALID_ENV = {
  VAPID_PUBLIC_KEY: "public-key",
  VAPID_PRIVATE_KEY: "private-key",
  VAPID_EMAIL: "push@example.com",
};

describe("sendPushNotification()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set required env vars
    Object.assign(process.env, VALID_ENV);
  });

  afterEach(() => {
    // Clean up env vars
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
  });

  it("sets VAPID details and sends the notification", async () => {
    mockSendNotification.mockResolvedValue(undefined);

    const { sendPushNotification } = await import("../src/web-push.js");

    await sendPushNotification(VALID_SUBSCRIPTION, {
      title: "Test Title",
      body: "Test Body",
    });

    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      "mailto:push@example.com",
      "public-key",
      "private-key"
    );

    expect(mockSendNotification).toHaveBeenCalledOnce();
    const [sub, payload] = mockSendNotification.mock.calls[0];
    expect(sub).toEqual(VALID_SUBSCRIPTION);
    const parsed = JSON.parse(payload as string);
    expect(parsed).toEqual({ title: "Test Title", body: "Test Body" });
  });

  it("includes link in payload when provided", async () => {
    mockSendNotification.mockResolvedValue(undefined);

    const { sendPushNotification } = await import("../src/web-push.js");

    await sendPushNotification(VALID_SUBSCRIPTION, {
      title: "Hello",
      body: "World",
      link: "/dashboard",
    });

    const [, payload] = mockSendNotification.mock.calls[0];
    const parsed = JSON.parse(payload as string);
    expect(parsed.link).toBe("/dashboard");
  });

  it("throws when VAPID env vars are missing", async () => {
    delete process.env.VAPID_PUBLIC_KEY;

    const { sendPushNotification } = await import("../src/web-push.js");

    await expect(
      sendPushNotification(VALID_SUBSCRIPTION, { title: "x", body: "y" })
    ).rejects.toThrow("Missing VAPID configuration");
  });

  it("propagates errors from web-push sendNotification", async () => {
    mockSendNotification.mockRejectedValue(new Error("Push delivery failed"));

    const { sendPushNotification } = await import("../src/web-push.js");

    await expect(
      sendPushNotification(VALID_SUBSCRIPTION, { title: "x", body: "y" })
    ).rejects.toThrow("Push delivery failed");
  });
});
