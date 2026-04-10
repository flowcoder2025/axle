import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { generateEmbedding } from "./embeddings.js";
import { vectorParam } from "./vector-utils.js";

export interface EmbeddingRecord {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: unknown;
}

/**
 * Create or update a DocumentEmbedding for the given source.
 * Upserts on (sourceType, sourceId).
 */
export async function upsertEmbedding(
  sourceType: string,
  sourceId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const embedding = await generateEmbedding(content);
  const metadataJson = metadata !== undefined ? JSON.stringify(metadata) : null;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "DocumentEmbedding" (id, "sourceType", "sourceId", content, embedding, metadata)
      VALUES (
        gen_random_uuid()::text,
        ${sourceType},
        ${sourceId},
        ${content},
        ${vectorParam(embedding)},
        ${metadataJson}::jsonb
      )
      ON CONFLICT ("sourceType", "sourceId") DO UPDATE SET
        content   = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata  = EXCLUDED.metadata
    `
  );
}

/**
 * Delete the embedding for a given source.
 */
export async function deleteEmbedding(
  sourceType: string,
  sourceId: string
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "DocumentEmbedding"
    WHERE "sourceType" = ${sourceType}
      AND "sourceId"   = ${sourceId}
  `;
}

/**
 * List all embeddings that match the given sourceType and optionally sourceId.
 * Returns rows without the embedding vector (too large for routine display).
 */
export async function getEmbeddingsBySource(
  sourceType: string,
  sourceId?: string
): Promise<EmbeddingRecord[]> {
  if (sourceId !== undefined) {
    return prisma.$queryRaw<EmbeddingRecord[]>`
      SELECT id, "sourceType", "sourceId", content, metadata
      FROM "DocumentEmbedding"
      WHERE "sourceType" = ${sourceType}
        AND "sourceId"   = ${sourceId}
    `;
  }

  return prisma.$queryRaw<EmbeddingRecord[]>`
    SELECT id, "sourceType", "sourceId", content, metadata
    FROM "DocumentEmbedding"
    WHERE "sourceType" = ${sourceType}
  `;
}
