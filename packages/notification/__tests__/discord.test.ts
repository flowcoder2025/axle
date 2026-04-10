import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// --- Tests ---

const WEBHOOK_URL = "https://discord.com/api/webhooks/123/test-token";

function makeOkResponse() {
  // Discord returns 204 No Content on success
  return { ok: true, status: 204, text: async () => "" } as unknown as Response;
}

function makeErrorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response;
}

describe("sendDiscordNotification()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DISCORD_WEBHOOK_URL = WEBHOOK_URL;
  });

  afterEach(() => {
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  it("posts a plain message to the webhook URL", async () => {
    mockFetch.mockResolvedValue(makeOkResponse());

    const { sendDiscordNotification } = await import("../src/discord.js");
    await sendDiscordNotification("Hello Discord");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(WEBHOOK_URL);
    const body = JSON.parse(init.body as string);
    expect(body.content).toBe("Hello Discord");
  });

  it("includes username and avatar_url when provided", async () => {
    mockFetch.mockResolvedValue(makeOkResponse());

    const { sendDiscordNotification } = await import("../src/discord.js");
    await sendDiscordNotification("Hello", {
      username: "AXLE Bot",
      avatarUrl: "https://example.com/avatar.png",
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.username).toBe("AXLE Bot");
    expect(body.avatar_url).toBe("https://example.com/avatar.png");
  });

  it("includes embeds when provided", async () => {
    mockFetch.mockResolvedValue(makeOkResponse());

    const embed = {
      title: "New Task",
      description: "A task was created",
      color: 0x5865f2,
    };

    const { sendDiscordNotification } = await import("../src/discord.js");
    await sendDiscordNotification("", { embeds: [embed] });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.embeds).toEqual([embed]);
  });

  it("omits optional fields when not provided", async () => {
    mockFetch.mockResolvedValue(makeOkResponse());

    const { sendDiscordNotification } = await import("../src/discord.js");
    await sendDiscordNotification("Simple message");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("username");
    expect(body).not.toHaveProperty("avatar_url");
    expect(body).not.toHaveProperty("embeds");
  });

  it("throws when DISCORD_WEBHOOK_URL is missing", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;

    const { sendDiscordNotification } = await import("../src/discord.js");
    await expect(sendDiscordNotification("Hello")).rejects.toThrow(
      "Missing DISCORD_WEBHOOK_URL"
    );
  });

  it("throws on non-OK response from Discord", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(429, '{"message":"rate limited"}'));

    const { sendDiscordNotification } = await import("../src/discord.js");
    await expect(sendDiscordNotification("Hello")).rejects.toThrow(
      "Discord Webhook error 429"
    );
  });
});
