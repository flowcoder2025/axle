import OpenAI from "openai";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

/** Reset client (useful in tests) */
export function resetOpenAIClient(): void {
  _openai = null;
}

/**
 * Safely formats a number[] as a pgvector literal.
 * All values are validated to be finite numbers to prevent injection.
 */
function toVectorLiteral(embedding: number[]): string {
  if (embedding.some((v) => !Number.isFinite(v))) {
    throw new Error("Embedding contains non-finite values");
  }
  return `[${embedding.join(",")}]`;
}

/**
 * Generate an embedding vector for the given text using OpenAI text-embedding-3-small.
 * Returns a 1536-dimensional float array.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Insert or update a DocumentEmbedding row using raw SQL (pgvector requires it).
 * ON CONFLICT on (sourceType, sourceId) updates the content and embedding.
 */
export async function createDocumentEmbedding(
  sourceType: string,
  sourceId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const embedding = await generateEmbedding(content);
  const vectorLiteral = toVectorLiteral(embedding);
  const metadataJson = metadata !== undefined ? JSON.stringify(metadata) : null;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "DocumentEmbedding" (id, "sourceType", "sourceId", content, embedding, metadata)
      VALUES (
        gen_random_uuid()::text,
        ${sourceType},
        ${sourceId},
        ${content},
        ${Prisma.raw(`'${vectorLiteral}'::vector`)},
        ${metadataJson}::jsonb
      )
      ON CONFLICT ("sourceType", "sourceId") DO UPDATE SET
        content   = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata  = EXCLUDED.metadata
    `
  );
}
