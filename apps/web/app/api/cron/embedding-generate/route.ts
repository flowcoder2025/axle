import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { generateEmbedding, upsertEmbedding } from "@axle/ai";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

const SOURCE_TYPE = "document";
const BATCH_SIZE = 20;

// POST /api/cron/embedding-generate
// Scheduled: 0 2 * * * (daily at 02:00 UTC)
// Find Documents that have no DocumentEmbedding and generate embeddings via @axle/ai.
// Processes up to BATCH_SIZE documents per run to avoid timeout.
// Note: upsertEmbedding internally calls generateEmbedding; here we pre-generate
// so we can detect failures per document before upserting.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find documents without an embedding
    const existingEmbeddings = await prisma.documentEmbedding.findMany({
      where: { sourceType: SOURCE_TYPE },
      select: { sourceId: true },
    });
    const embeddedIds = new Set(existingEmbeddings.map((e) => e.sourceId));

    const documents = await prisma.document.findMany({
      where: { id: { notIn: [...embeddedIds] } },
      select: { id: true, name: true, ocrResult: true, category: true },
      take: BATCH_SIZE,
    });

    let processed = 0;

    for (const doc of documents) {
      // Build text content from OCR result or document name as fallback
      let content = doc.name;
      if (doc.ocrResult) {
        const ocr = doc.ocrResult as Record<string, unknown>;
        if (typeof ocr.text === "string" && ocr.text.length > 0) {
          content = ocr.text;
        }
      }

      // Pre-check: generateEmbedding to surface per-doc failures before upsert
      const canEmbed = await generateEmbedding(content).then(
        () => true,
        (err: unknown) => {
          console.error(`embedding-generate: generateEmbedding failed for doc ${doc.id}`, err);
          return false;
        }
      );
      if (!canEmbed) continue;

      // upsertEmbedding(sourceType, sourceId, content, metadata?) — positional args
      await upsertEmbedding(
        SOURCE_TYPE,
        doc.id,
        content,
        { category: doc.category, name: doc.name }
      ).catch((err: unknown) => {
        console.error(`embedding-generate: upsertEmbedding failed for doc ${doc.id}`, err);
      });

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    return handleInternalError(err);
  }
}
