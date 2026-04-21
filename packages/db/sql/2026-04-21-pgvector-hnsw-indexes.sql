-- pgvector HNSW indexes for DocumentEmbedding.embedding
-- Created: 2026-04-21 (WI-229 / Phase 17 review follow-up H2)
--
-- Problem: kNN search on DocumentEmbedding.embedding was seqscanning,
-- which makes RAG (rag-draft, semantic search) unusable above ~10k rows.
-- Prisma's @@index cannot express pgvector operator classes, so this
-- migration is applied out-of-band via `prisma db push` + this SQL.
--
-- Cosine distance operator class is vector_cosine_ops (matches our
-- search.ts `ORDER BY embedding <=> vec`).
--
-- HNSW chosen over IVFFlat because:
--  - No training step required (IVFFlat needs representative data)
--  - Better recall/latency at our expected scale (<10M vectors)
--  - Updates/inserts don't require rebuild
--
-- Parameters: m=16 (default, good for 1536 dims), ef_construction=64
-- (default). Query-time ef_search left at session default (40); tune
-- via SET if recall drops.
--
-- Apply: psql "$DIRECT_URL" -f 2026-04-21-pgvector-hnsw-indexes.sql
-- CONCURRENTLY is safe here (no exclusive lock) but cannot run in a
-- transaction, so this file must be executed outside a tx wrapper.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "DocumentEmbedding_embedding_cosine_hnsw_idx"
  ON "DocumentEmbedding"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Helpful btree for the metadata-filter-then-search pattern used by
-- `searchClientDocuments` / `searchPastPlans` in rag-draft.ts.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DocumentEmbedding_sourceType_idx"
  ON "DocumentEmbedding" ("sourceType");
