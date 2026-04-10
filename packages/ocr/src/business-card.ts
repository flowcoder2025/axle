import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BusinessCardData } from "./types.js";

const PARSE_PROMPT = `You are a business card OCR assistant. Extract contact information from the business card image and return a JSON object with exactly these fields:
- name: person's full name (string or null)
- position: job title/position (string or null)
- department: department or team name (string or null)
- phone: phone number including mobile/fax (string or null, prefer mobile if multiple)
- email: email address (string or null)
- company: company or organization name (string or null)
- address: full address (string or null)

Return ONLY valid JSON with no markdown fences, no extra text. Example:
{"name":"홍길동","position":"대표이사","department":null,"phone":"010-1234-5678","email":"hong@example.com","company":"(주)예시","address":"서울시 강남구 테헤란로 123"}`;

function parseJsonSafe(text: string): BusinessCardData {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error(`Gemini returned non-JSON response: ${text.slice(0, 200)}`);
  }

  return {
    name: typeof parsed.name === "string" ? parsed.name : null,
    position: typeof parsed.position === "string" ? parsed.position : null,
    department:
      typeof parsed.department === "string" ? parsed.department : null,
    phone: typeof parsed.phone === "string" ? parsed.phone : null,
    email: typeof parsed.email === "string" ? parsed.email : null,
    company: typeof parsed.company === "string" ? parsed.company : null,
    address: typeof parsed.address === "string" ? parsed.address : null,
  };
}

export async function parseBusinessCard(
  imageBuffer: Buffer,
  mimeType: string
): Promise<BusinessCardData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };

  const result = await model.generateContent([PARSE_PROMPT, imagePart]);
  const response = result.response;
  const text = response.text();

  return parseJsonSafe(text);
}
