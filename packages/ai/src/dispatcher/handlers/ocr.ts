import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { InvalidJobInputError } from "../types.js";
import { loadModule } from "../lazy-import.js";

interface OcrInput {
  imageBase64: string;
  mimeType: string;
  /**
   * Selects which @axle/ocr entry point handles the image. Defaults to
   * "business-card" so that existing callers (clients, business cards) keep
   * their current behavior. Use "receipt" for Phase 20 영수증 OCR intake
   * (WI-709a parseReceipt).
   */
  mode?: "business-card" | "receipt";
}

interface OcrModule {
  parseBusinessCard: (buf: Buffer, mimeType: string) => Promise<unknown>;
  parseReceipt: (buf: Buffer, mimeType: string) => Promise<unknown>;
}

function readMode(rec: Record<string, unknown>): "business-card" | "receipt" {
  const raw = rec.mode;
  if (raw === undefined || raw === null) return "business-card";
  if (raw === "business-card" || raw === "receipt") return raw;
  throw new InvalidJobInputError(
    `OCR handler: 'mode' must be 'business-card' or 'receipt', got ${JSON.stringify(raw)}`,
  );
}

export const ocrHandler: AiJobHandler<OcrInput, unknown> = {
  type: "OCR",
  async run(input) {
    const rec = asRecord(input, "OCR");
    const imageBase64 = requireString(rec, "imageBase64", "OCR");
    const mimeType = requireString(rec, "mimeType", "OCR");
    const mode = readMode(rec);

    let buffer: Buffer;
    try {
      buffer = Buffer.from(imageBase64, "base64");
    } catch {
      throw new InvalidJobInputError("OCR handler: imageBase64 is not valid base64");
    }
    if (buffer.length === 0) {
      throw new InvalidJobInputError("OCR handler: decoded image buffer is empty");
    }

    const mod = await loadModule<OcrModule>("@axle/ocr");
    if (mode === "receipt") {
      return mod.parseReceipt(buffer, mimeType);
    }
    return mod.parseBusinessCard(buffer, mimeType);
  },
};
