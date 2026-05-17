/**
 * Phase 21 WI-724a-prep — pg_trgm + GIN index migration.
 *
 * Verifies the migration SQL has the two pieces the fuzzy search endpoint
 * (WI-724a) will rely on:
 *   1. `CREATE EXTENSION IF NOT EXISTS pg_trgm` — idempotent on every env.
 *   2. `CREATE INDEX … USING gin ("normalizedName" gin_trgm_ops)` — the
 *      operator class that powers `similarity()` and `%` queries.
 *
 * We assert from the SQL text (no live DB) for parity with the rest of the
 * phase20/phase21 migration tests. EXPLAIN ANALYZE verification is an
 * operational acceptance criterion documented in the WI plan, not a CI test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const PACKAGE_ROOT = resolve(__dirname, "..");
const migrationsDir = resolve(PACKAGE_ROOT, "prisma/migrations");
const migrationFolder = "20260517000004_phase21_pg_trgm_normalized_name_gin";
const sqlPath = resolve(migrationsDir, migrationFolder, "migration.sql");
const sql = existsSync(sqlPath) ? readFileSync(sqlPath, "utf-8") : "";

describe("WI-724a-prep: pg_trgm extension + GIN trigram index", () => {
  it("migration directory exists", () => {
    expect(readdirSync(migrationsDir)).toContain(migrationFolder);
  });

  it("enables pg_trgm idempotently (CREATE EXTENSION IF NOT EXISTS)", () => {
    // IF NOT EXISTS keeps the migration safe to re-run on any environment
    // (local dev, CI shadow db, Supabase managed) without "already exists".
    expect(sql).toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_trgm/i);
  });

  it("creates the GIN index on normalizedName with gin_trgm_ops", () => {
    expect(sql).toMatch(
      /CREATE\s+INDEX\s+"ErpCounterparty_normalizedName_trgm_idx"\s+ON\s+"ErpCounterparty"\s+USING\s+gin\s*\(\s*"normalizedName"\s+gin_trgm_ops\s*\)/i,
    );
  });

  it("RED — does not run CREATE INDEX CONCURRENTLY (Prisma migrations are transactional)", () => {
    // CONCURRENTLY cannot run inside a transaction. Prisma wraps each
    // migration in one. The HNSW pattern (see sql/2026-04-21-pgvector-hnsw-indexes.sql)
    // is the place for CONCURRENTLY when AXLE outgrows the brief lock.
    // Match the executable form only (case-insensitive), not commentary text.
    expect(sql).not.toMatch(/CREATE\s+INDEX\s+CONCURRENTLY/i);
    expect(sql).not.toMatch(/REINDEX\s+(TABLE\s+)?CONCURRENTLY/i);
  });

  it("scope-limited: does not touch unrelated tables", () => {
    // WI-724a-prep只 — index와 extension. Order/IntakeDraft/Product 등은 별도 WI.
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"Order"/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"OrderItem"/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"IntakeDraft"/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"Product"/i);
  });

  it("scope-limited: does not drop or replace the existing B-tree (orgId, normalizedName) index from WI-721", () => {
    // The composite B-tree from WI-721 supports exact equality lookups (the
    // resolver hot path); the new GIN index is additive for similarity. The
    // planner picks whichever fits, but DROP would regress the resolver.
    expect(sql).not.toMatch(/DROP\s+INDEX[^;]*ErpCounterparty_orgId_normalizedName/i);
  });
});
