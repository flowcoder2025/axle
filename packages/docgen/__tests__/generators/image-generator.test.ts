import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  data: Buffer.from("fake-image").toString("base64"),
                  mimeType: "image/png",
                },
              }],
            },
          }],
        },
      }),
    }),
  })),
}));

describe("generateImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns buffer and mimeType", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    const { generateImage } = await import("../../src/generators/image-generator.js");
    const result = await generateImage("a chart showing growth");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.mimeType).toBe("image/png");
  });

  it("throws when API key is missing", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const { generateImage } = await import("../../src/generators/image-generator.js");
    await expect(generateImage("test")).rejects.toThrow("GOOGLE_GENERATIVE_AI_API_KEY");
  });
});
