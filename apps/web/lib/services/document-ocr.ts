/**
 * document-ocr.ts
 *
 * Triggers OCR processing for a document via Gemini Vision.
 * Supports image files (image/jpeg, image/png) and PDFs (application/pdf).
 *
 * This function is designed to be fire-and-forget: it must not throw so that
 * errors here never block the document upload response.
 */

import { prisma } from "@axle/db";
import { getSignedUrl, BUCKETS } from "@axle/storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import { extractStoragePath } from "@/lib/utils/storage";

/** File types that are eligible for OCR */
const OCR_SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

/**
 * Parse the Gemini text response as JSON, stripping markdown fences if present.
 */
function parseOcrResponse(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // If not JSON, wrap the raw text so ocrResult is always an object
    return { rawText: cleaned };
  }
}

const OCR_PROMPT = `You are a document OCR assistant. Extract all text content from this document and return a structured JSON object with the following fields:
- text: the full extracted text (string)
- language: detected language code (string, e.g. "ko", "en")
- pages: number of pages if detectable (number or null)
- summary: a brief one-sentence summary of the document content (string or null)
- keyFields: an object containing any structured data fields found (e.g. dates, names, numbers, amounts) — use null if none found

Return ONLY valid JSON with no markdown fences, no extra text.`;

/**
 * Triggers OCR for a single document.
 *
 * Steps:
 * 1. Fetch document from DB
 * 2. Check fileType — only process images (jpeg/png) and PDFs
 * 3. Update ocrStatus to PROCESSING
 * 4. Download file via signed URL
 * 5. Call Gemini Vision for OCR
 * 6. Save ocrResult JSON to document
 * 7. Update ocrStatus to COMPLETED (or FAILED on error)
 */
export async function triggerDocumentOcr(documentId: string): Promise<void> {
  // 1. Fetch document from DB
  let document: {
    id: string;
    fileUrl: string;
    fileType: string;
    ocrStatus: string;
  } | null;

  try {
    document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, fileUrl: true, fileType: true, ocrStatus: true },
    });
  } catch (err) {
    console.error(`[triggerDocumentOcr] DB fetch failed for ${documentId}:`, err);
    return;
  }

  if (!document) {
    console.warn(`[triggerDocumentOcr] Document not found: ${documentId}`);
    return;
  }

  // 2. Check fileType — skip unsupported types silently
  if (!OCR_SUPPORTED_TYPES.has(document.fileType)) {
    return;
  }

  // Skip if already processing or completed
  if (document.ocrStatus === "PROCESSING" || document.ocrStatus === "COMPLETED") {
    return;
  }

  // 3. Update ocrStatus to PROCESSING
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: "PROCESSING" },
    });
  } catch (err) {
    console.error(`[triggerDocumentOcr] Failed to set PROCESSING for ${documentId}:`, err);
    return;
  }

  try {
    // 4. Download file via signed URL
    const storagePath = extractStoragePath(document.fileUrl);
    const { url: signedUrl } = await getSignedUrl(BUCKETS.DOCUMENTS, storagePath);

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 5. Call Gemini Vision for OCR
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const filePart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: document.fileType,
      },
    };

    const result = await model.generateContent([OCR_PROMPT, filePart]);
    const ocrResult = parseOcrResponse(result.response.text());

    // 6 & 7. Save ocrResult and update ocrStatus to COMPLETED
    await prisma.document.update({
      where: { id: documentId },
      data: {
        ocrResult: ocrResult as Prisma.InputJsonValue,
        ocrStatus: "COMPLETED",
      },
    });
  } catch (err) {
    console.error(`[triggerDocumentOcr] OCR failed for ${documentId}:`, err);

    // 7. Update ocrStatus to FAILED on error
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { ocrStatus: "FAILED" },
      });
    } catch (updateErr) {
      console.error(
        `[triggerDocumentOcr] Failed to set FAILED status for ${documentId}:`,
        updateErr
      );
    }
  }
}
