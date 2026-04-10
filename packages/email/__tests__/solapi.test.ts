import { describe, it, expect, vi, beforeEach } from "vitest";

// ── fetch mock ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Module imports ────────────────────────────────────────────────────────────
import { sendSms, sendAlimTalk, formatKoreanPhone } from "../src/solapi.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function stubSolapiEnv() {
  vi.stubEnv("SOLAPI_API_KEY", "test-api-key");
  vi.stubEnv("SOLAPI_API_SECRET", "test-api-secret");
  vi.stubEnv("SOLAPI_SENDER_PHONE", "01012345678");
}

function makeOkResponse(body: unknown = {}) {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeErrorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

// ── formatKoreanPhone tests ───────────────────────────────────────────────────
describe("formatKoreanPhone", () => {
  it("strips dashes from 010-1234-5678", () => {
    expect(formatKoreanPhone("010-1234-5678")).toBe("01012345678");
  });

  it("accepts already-clean 01012345678", () => {
    expect(formatKoreanPhone("01012345678")).toBe("01012345678");
  });

  it("strips country code 82", () => {
    expect(formatKoreanPhone("+82-10-1234-5678")).toBe("01012345678");
    expect(formatKoreanPhone("821012345678")).toBe("01012345678");
  });

  it("throws on invalid number", () => {
    expect(() => formatKoreanPhone("123456789")).toThrow("Invalid Korean phone number");
    expect(() => formatKoreanPhone("02-1234-5678")).toThrow("Invalid Korean phone number");
  });
});

// ── sendSms tests ─────────────────────────────────────────────────────────────
describe("sendSms", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("throws when SOLAPI_SENDER_PHONE is missing (checked first)", async () => {
    // sendSms checks SOLAPI_SENDER_PHONE before calling solapiRequest
    await expect(sendSms("01012345678", "Hello")).rejects.toThrow(
      "SOLAPI_SENDER_PHONE"
    );
  });

  it("throws when SOLAPI_API_KEY is missing (checked inside solapiRequest)", async () => {
    vi.stubEnv("SOLAPI_SENDER_PHONE", "01012345678");
    // No API_KEY set → solapiRequest throws
    await expect(sendSms("01012345678", "Hello")).rejects.toThrow(
      "SOLAPI_API_KEY"
    );
  });

  it("sends SMS successfully", async () => {
    stubSolapiEnv();
    mockFetch.mockResolvedValue(makeOkResponse({ groupId: "g-1" }));

    await expect(sendSms("010-1234-5678", "Hello")).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/messages/v4/send");
    const body = JSON.parse(init.body as string) as {
      message: { to: string; type: string };
    };
    expect(body.message.to).toBe("01012345678");
  });

  it("sends LMS for text > 90 chars", async () => {
    stubSolapiEnv();
    mockFetch.mockResolvedValue(makeOkResponse());

    const longText = "가".repeat(91);
    await sendSms("01012345678", longText);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      message: { type: string };
    };
    expect(body.message.type).toBe("LMS");
  });

  it("sends SMS for short text", async () => {
    stubSolapiEnv();
    mockFetch.mockResolvedValue(makeOkResponse());

    await sendSms("01012345678", "짧은 메시지");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      message: { type: string };
    };
    expect(body.message.type).toBe("SMS");
  });

  it("throws on Solapi API error", async () => {
    stubSolapiEnv();
    mockFetch.mockResolvedValue(
      makeErrorResponse(400, {
        errorCode: "InvalidRecipient",
        errorMessage: "Invalid recipient",
      })
    );

    await expect(sendSms("01012345678", "Hello")).rejects.toThrow(
      "Invalid recipient"
    );
  });
});

// ── sendAlimTalk tests ────────────────────────────────────────────────────────
describe("sendAlimTalk", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("sends AlimTalk with correct payload", async () => {
    stubSolapiEnv();
    mockFetch.mockResolvedValue(makeOkResponse({ groupId: "g-2" }));

    await sendAlimTalk("01012345678", "TPL_001", {
      name: "홍길동",
      amount: "10,000",
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/messages/v4/send");

    const body = JSON.parse(init.body as string) as {
      message: {
        type: string;
        kakaoOptions: { templateId: string; variables: Record<string, string> };
      };
    };
    expect(body.message.type).toBe("ATA");
    expect(body.message.kakaoOptions.templateId).toBe("TPL_001");
    expect(body.message.kakaoOptions.variables).toEqual({
      name: "홍길동",
      amount: "10,000",
    });
  });

  it("throws when SOLAPI_SENDER_PHONE is missing", async () => {
    vi.stubEnv("SOLAPI_API_KEY", "key");
    vi.stubEnv("SOLAPI_API_SECRET", "secret");
    await expect(
      sendAlimTalk("01012345678", "TPL_001", {})
    ).rejects.toThrow("SOLAPI_SENDER_PHONE");
  });
});
