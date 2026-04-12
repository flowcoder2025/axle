import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ImageGenerateOptions {
  width?: number;
  height?: number;
  style?: "infographic" | "diagram" | "illustration";
}

export async function generateImage(
  prompt: string,
  options?: ImageGenerateOptions
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required for image generation");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const styleHint = options?.style ? ` Style: ${options.style}.` : "";
  const fullPrompt = `Generate an image: ${prompt}.${styleHint} Professional quality, clean design.`;

  const result = await model.generateContent(fullPrompt);
  const candidate = result.response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  if (!part || !("inlineData" in part) || !part.inlineData) {
    throw new Error("No image data in response");
  }

  return {
    buffer: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType || "image/png",
  };
}
