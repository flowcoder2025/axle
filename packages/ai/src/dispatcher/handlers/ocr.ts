import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { InvalidJobInputError } from "../types.js";
import { loadModule } from "../lazy-import.js";

interface OcrInput {
  imageBase64: string;
  mimeType: string;
}

interface OcrModule {
  parseBusinessCard: (buf: Buffer, mimeType: string) => Promise<unknown>;
}

export const ocrHandler: AiJobHandler<OcrInput, unknown> = {
  type: "OCR",
  async run(input) {
    const rec = asRecord(input, "OCR");
    const imageBase64 = requireString(rec, "imageBase64", "OCR");
    const mimeType = requireString(rec, "mimeType", "OCR");

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
    return mod.parseBusinessCard(buffer, mimeType);
  },
};
