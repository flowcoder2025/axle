-- Phase 21 — ERP Amplification (WI-724a-prep)
-- Enable pg_trgm and prepare a GIN trigram index on ErpCounterparty.normalizedName
-- so the fuzzy search endpoint added in WI-724a can sustain `similarity()` queries
-- under the design SLO (≤200ms over 10k rows).
--
-- Supabase note (design §0):
--   pg_trgm is included in Supabase Postgres. pg_bigm is NOT available on
--   Supabase managed Postgres, which is why WI-724a-prep picks pg_trgm.
--   We confirm extension presence by running CREATE EXTENSION IF NOT EXISTS
--   here — this is idempotent on every environment.
--
-- Why GIN + gin_trgm_ops:
--   - Postgres recommends GIN over GiST when build time is acceptable and
--     read latency is the priority (which is exactly the WI-724a profile).
--   - `gin_trgm_ops` indexes 3-character grams, which works well for both
--     Korean (compatibility-decomposed jamo in normalizedName) and ASCII.
--   - normalizedName is already case-folded + prefix-stripped (WI-721 utils),
--     so the trigram match is comparing the same canonical form the writer
--     stores.
--
-- Why a non-CONCURRENT CREATE INDEX:
--   - Prisma wraps each migration in a single transaction. CONCURRENTLY is
--     incompatible with transactional DDL, so we cannot use it here.
--   - AXLE's prod ErpCounterparty volume is small (<10k rows) at the time
--     this migration deploys, so the brief AccessExclusiveLock is acceptable.
--   - For a future migration that re-builds the index on a much larger
--     table, peel CREATE INDEX out into a separate raw SQL script that runs
--     `CONCURRENTLY` outside the migration transaction (see
--     `packages/db/sql/2026-04-21-pgvector-hnsw-indexes.sql` for the existing
--     pattern used by HNSW).
--
-- No partial WHERE clause:
--   - Soft-deleted rows are rare and already filtered by every read query.
--   - Keeping the index non-partial lets the planner use it for diagnostic
--     queries that don't include `deletedAt IS NULL` (e.g. admin merge
--     suggestions).

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "ErpCounterparty_normalizedName_trgm_idx"
  ON "ErpCounterparty" USING gin ("normalizedName" gin_trgm_ops);
