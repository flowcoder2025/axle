import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// --- Tests ---

const BOT_TOKEN = "123456:TEST_TOKEN";
const CHAT_ID = "999888777";

function makeOkResponse() {
  return {
    ok: true,
    json: async () => ({ ok: true }),
    text: async () => '{"ok":true}',
  } as Response;
}

function makeErrorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response;
}

describe("sendTelegramNotification()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("posts to the correct Telegram API URL", async () => {
    mockFetch.mockResolvedValue(makeOkResponse());

    const { sendTelegramNotification } = await import("../src/telegram.js");
    await sendTelegramNotification(CHAT_ID, "Hello Telegram");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    );
  });

  it("sends the correct JSON body", async () => {
    mockFetch.mockResolvedValue(makeOkResponse());

    const { sendTelegramNotification } = await import("../src/telegram.js");
    await sendTelegramNotification(CHAT_ID, "Test message");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      chat_id: CHAT_ID,
      text: "Test message",
      parse_mode: "HTML",
    });
  });

  it("throws when TELEGRAM_BOT_TOKEN is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    const { sendTelegramNotification } = await import("../src/telegram.js");
    await expect(
      sendTelegramNotification(CHAT_ID, "Hello")
    ).rejects.toThrow("Missing TELEGRAM_BOT_TOKEN");
  });

  it("throws on non-OK response from Telegram", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(400, '{"description":"Bad Request"}'));

    const { sendTelegramNotification } = await import("../src/telegram.js");
    await expect(
      sendTelegramNotification(CHAT_ID, "Hello")
    ).rejects.toThrow("Telegram API error 400");
  });
});

describe("sendTelegramToDefault()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("uses TELEGRAM_CHAT_ID as the recipient", async () => {
    mockFetch.mockResolvedValue(makeOkResponse());

    const { sendTelegramToDefault } = await import("../src/telegram.js");
    await sendTelegramToDefault("Default message");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe(CHAT_ID);
    expect(body.text).toBe("Default message");
  });

  it("throws when TELEGRAM_CHAT_ID is missing", async () => {
    delete process.env.TELEGRAM_CHAT_ID;

    const { sendTelegramToDefault } = await import("../src/telegram.js");
    await expect(sendTelegramToDefault("Hello")).rejects.toThrow(
      "Missing TELEGRAM_CHAT_ID"
    );
  });
});
