/**
 * One-off script to apply pgvector HNSW indexes on DocumentEmbedding.
 * Prisma cannot express pgvector operator classes in schema.prisma, so the
 * index must be applied via raw SQL after `prisma db push`.
 *
 * Run:  npx tsx packages/db/scripts/apply-pgvector-hnsw.ts
 *
 * Idempotent — IF NOT EXISTS guards re-runs. CONCURRENTLY avoids exclusive
 * locks but requires running outside a transaction, so we use $executeRawUnsafe
 * which does not wrap DDL in an implicit tx.
 */

import { Client } from "pg";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("[pgvector-hnsw] creating HNSW index on DocumentEmbedding.embedding...");
    await client.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "DocumentEmbedding_embedding_cosine_hnsw_idx" ON "DocumentEmbedding" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`
    );
    console.log("[pgvector-hnsw] ✓ HNSW index ready");

    console.log("[pgvector-hnsw] creating btree on DocumentEmbedding.sourceType...");
    await client.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "DocumentEmbedding_sourceType_idx" ON "DocumentEmbedding" ("sourceType")`
    );
    console.log("[pgvector-hnsw] ✓ sourceType btree ready");

    const { rows } = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'DocumentEmbedding' ORDER BY indexname`
    );
    console.log("[pgvector-hnsw] current indexes on DocumentEmbedding:");
    for (const { indexname } of rows) {
      console.log(`  - ${indexname}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[pgvector-hnsw] FAILED:", err);
  process.exit(1);
});
