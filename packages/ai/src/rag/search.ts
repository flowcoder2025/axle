import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { generateEmbedding } from "./embeddings.js";
import { vectorParam } from "./vector-utils.js";

export interface SearchResult {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: unknown;
  similarity: number;
}

export interface SemanticSearchOptions {
  /** Filter to a specific source type (e.g. 'document', 'client', 'program') */
  sourceType?: string;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Minimum cosine similarity threshold 0-1 (default: 0.7) */
  threshold?: number;
}

/**
 * Semantic search using pgvector cosine similarity (<=> operator).
 * Returns results with similarity above the threshold, ordered by similarity desc.
 */
export async function semanticSearch(
  query: string,
  options?: SemanticSearchOptions
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);
  const limit = options?.limit ?? 10;
  const threshold = options?.threshold ?? 0.7;
  const vec = vectorParam(queryEmbedding);

  const results: SearchResult[] = await prisma.$queryRaw(
    options?.sourceType
      ? Prisma.sql`
          SELECT
            id,
            "sourceType",
            "sourceId",
            content,
            metadata,
            (1 - (embedding <=> ${vec})) AS similarity
          FROM "DocumentEmbedding"
          WHERE "sourceType" = ${options.sourceType}
            AND (1 - (embedding <=> ${vec})) > ${threshold}
          ORDER BY embedding <=> ${vec}
          LIMIT ${limit}
        `
      : Prisma.sql`
          SELECT
            id,
            "sourceType",
            "sourceId",
            content,
            metadata,
            (1 - (embedding <=> ${vec})) AS similarity
          FROM "DocumentEmbedding"
          WHERE (1 - (embedding <=> ${vec})) > ${threshold}
          ORDER BY embedding <=> ${vec}
          LIMIT ${limit}
        `
  );

  return results;
}

export interface HybridSearchOptions {
  /** Filter to a specific source type */
  sourceType?: string;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
}

/**
 * Hybrid search: combines pgvector cosine similarity with PostgreSQL full-text search.
 * Uses Reciprocal Rank Fusion (RRF) to merge the two result lists.
 * semantic_weight=0.7, keyword_weight=0.3 by default.
 */
export async function hybridSearch(
  query: string,
  options?: HybridSearchOptions
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);
  const limit = options?.limit ?? 10;
  const vec = vectorParam(queryEmbedding);

  // RRF constant — rank 60 is the standard default
  const K = 60;

  const results: SearchResult[] = await prisma.$queryRaw(
    options?.sourceType
      ? Prisma.sql`
          WITH semantic AS (
            SELECT
              id,
              (1 - (embedding <=> ${vec})) AS score,
              ROW_NUMBER() OVER (ORDER BY embedding <=> ${vec}) AS rank
            FROM "DocumentEmbedding"
            WHERE "sourceType" = ${options.sourceType}
            LIMIT 50
          ),
          keyword AS (
            SELECT
              id,
              ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS score,
              ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) DESC) AS rank
            FROM "DocumentEmbedding"
            WHERE "sourceType" = ${options.sourceType}
              AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
            LIMIT 50
          ),
          fused AS (
            SELECT
              COALESCE(s.id, k.id) AS id,
              (0.7 * COALESCE(1.0 / (${K} + s.rank), 0) + 0.3 * COALESCE(1.0 / (${K} + k.rank), 0)) AS rrf_score
            FROM semantic s
            FULL OUTER JOIN keyword k ON s.id = k.id
          )
          SELECT
            d.id,
            d."sourceType",
            d."sourceId",
            d.content,
            d.metadata,
            f.rrf_score AS similarity
          FROM fused f
          JOIN "DocumentEmbedding" d ON d.id = f.id
          ORDER BY f.rrf_score DESC
          LIMIT ${limit}
        `
      : Prisma.sql`
          WITH semantic AS (
            SELECT
              id,
              (1 - (embedding <=> ${vec})) AS score,
              ROW_NUMBER() OVER (ORDER BY embedding <=> ${vec}) AS rank
            FROM "DocumentEmbedding"
            LIMIT 50
          ),
          keyword AS (
            SELECT
              id,
              ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS score,
              ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) DESC) AS rank
            FROM "DocumentEmbedding"
            WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
            LIMIT 50
          ),
          fused AS (
            SELECT
              COALESCE(s.id, k.id) AS id,
              (0.7 * COALESCE(1.0 / (${K} + s.rank), 0) + 0.3 * COALESCE(1.0 / (${K} + k.rank), 0)) AS rrf_score
            FROM semantic s
            FULL OUTER JOIN keyword k ON s.id = k.id
          )
          SELECT
            d.id,
            d."sourceType",
            d."sourceId",
            d.content,
            d.metadata,
            f.rrf_score AS similarity
          FROM fused f
          JOIN "DocumentEmbedding" d ON d.id = f.id
          ORDER BY f.rrf_score DESC
          LIMIT ${limit}
        `
  );

  return results;
}
