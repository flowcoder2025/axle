import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Anthropic SDK before any imports of receipt.ts
vi.mock("@anthropic-ai/sdk", () => {
  const create = vi.fn();
  class MockAnthropic {
    messages = { create };
  }
  return { default: MockAnthropic };
});

async function getCreateMock() {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const inst = new Anthropic();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return inst.messages.create as unknown as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("parseReceipt", () => {
  it("parses well-formed JSON response", async () => {
    const create = await getCreateMock();
    create.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            vendor: "GS25",
            date: "2026-05-15",
            type: "purchase",
            items: [{ name: "콜라", qty: 1, unitPrice: 1500, unit: "캔" }],
            subtotal: 1500,
            tax: 150,
            total: 1650,
            currency: "KRW",
            confidence: 0.9,
          }),
        },
      ],
    });

    const { parseReceipt } = await import("../src/receipt.js");
    const r = await parseReceipt(Buffer.from("fake"), "image/jpeg");

    expect(r.vendor).toBe("GS25");
    expect(r.items).toHaveLength(1);
    expect(r.confidence).toBe(0.9);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries once on JSON parse failure with feedback", async () => {
    const create = await getCreateMock();
    create.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json" }],
    });
    create.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            vendor: "X",
            date: null,
            type: "unknown",
            items: [],
            subtotal: null,
            tax: null,
            total: null,
            currency: "KRW",
            confidence: 0.3,
          }),
        },
      ],
    });

    const { parseReceipt } = await import("../src/receipt.js");
    const r = await parseReceipt(Buffer.from("fake"), "image/jpeg");

    expect(r.vendor).toBe("X");
    expect(create).toHaveBeenCalledTimes(2);
    const secondCall = create.mock.calls[1][0];
    expect(JSON.stringify(secondCall)).toContain("not valid JSON");
  });

  it("throws ParseReceiptError after 2 failures", async () => {
    const create = await getCreateMock();
    create
      .mockResolvedValueOnce({ content: [{ type: "text", text: "garbage1" }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "garbage2" }] });

    const { parseReceipt, ParseReceiptError } = await import(
      "../src/receipt.js"
    );
    await expect(
      parseReceipt(Buffer.from("fake"), "image/jpeg")
    ).rejects.toBeInstanceOf(ParseReceiptError);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
