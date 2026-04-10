import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseBusinessCard } from "../src/business-card.js";

// Mock @google/generative-ai
vi.mock("@google/generative-ai", () => {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
  }));
  const MockGoogleGenerativeAI = vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }));

  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    _mockGenerateContent: mockGenerateContent,
  };
});

async function getMock() {
  const mod = await import("@google/generative-ai");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod as any)._mockGenerateContent as ReturnType<typeof vi.fn>;
}

function makeImageBuffer(): Buffer {
  return Buffer.from("fake-image-data");
}

describe("parseBusinessCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("parses a fully-filled business card response", async () => {
    const mockGenerateContent = await getMock();
    const cardData = {
      name: "홍길동",
      position: "대표이사",
      department: "경영팀",
      phone: "010-1234-5678",
      email: "hong@example.com",
      company: "(주)예시",
      address: "서울시 강남구 테헤란로 123",
    };
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(cardData) },
    });

    const result = await parseBusinessCard(makeImageBuffer(), "image/jpeg");

    expect(result).toEqual(cardData);
  });

  it("returns null fields for missing values", async () => {
    const mockGenerateContent = await getMock();
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            name: "김철수",
            position: null,
            department: null,
            phone: "02-555-1234",
            email: null,
            company: "테스트(주)",
            address: null,
          }),
      },
    });

    const result = await parseBusinessCard(makeImageBuffer(), "image/png");

    expect(result.name).toBe("김철수");
    expect(result.position).toBeNull();
    expect(result.department).toBeNull();
    expect(result.email).toBeNull();
    expect(result.address).toBeNull();
    expect(result.company).toBe("테스트(주)");
  });

  it("strips markdown code fences from model response", async () => {
    const mockGenerateContent = await getMock();
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          '```json\n{"name":"이영희","position":"팀장","department":null,"phone":null,"email":"lee@co.kr","company":"ABC","address":null}\n```',
      },
    });

    const result = await parseBusinessCard(makeImageBuffer(), "image/jpeg");
    expect(result.name).toBe("이영희");
    expect(result.email).toBe("lee@co.kr");
  });

  it("throws when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      parseBusinessCard(makeImageBuffer(), "image/jpeg")
    ).rejects.toThrow("GEMINI_API_KEY");
  });

  it("throws when model returns non-JSON", async () => {
    const mockGenerateContent = await getMock();
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => "sorry, I cannot read this image" },
    });

    process.env.GEMINI_API_KEY = "test-key";
    await expect(
      parseBusinessCard(makeImageBuffer(), "image/jpeg")
    ).rejects.toThrow("non-JSON");
  });
});
