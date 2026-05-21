/**
 * Phase 21 WI-726 — Product.coaCode + OrderItem.coaCode columns + indexes.
 *
 * File-based migration SQL inspection (parity with phase20/phase21
 * migration tests; no live DB). Verifies:
 *   1. The migration directory + file exist.
 *   2. ALTER TABLE adds the two coaCode columns as nullable TEXT.
 *   3. Supporting indexes are created so reports can scan by coaCode
 *      without sequential scans.
 *   4. Schema mirror — both columns + indexes show up in schema.prisma
 *      so Prisma client types include them.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const PACKAGE_ROOT = resolve(__dirname, "..");
const schemaPath = resolve(PACKAGE_ROOT, "prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

const migrationsDir = resolve(PACKAGE_ROOT, "prisma/migrations");
const migrationFolder = "20260521000001_phase21_product_orderitem_coacode";
const sqlPath = resolve(migrationsDir, migrationFolder, "migration.sql");
const sql = existsSync(sqlPath) ? readFileSync(sqlPath, "utf-8") : "";

describe("WI-726: Product.coaCode + OrderItem.coaCode columns", () => {
  describe("migration", () => {
    it("migration directory exists", () => {
      expect(readdirSync(migrationsDir)).toContain(migrationFolder);
    });

    it("adds Product.coaCode as nullable TEXT", () => {
      expect(sql).toMatch(
        /ALTER\s+TABLE\s+"Product"\s+ADD\s+COLUMN\s+"coaCode"\s+TEXT/i,
      );
      // RED — no NOT NULL on either coaCode column (existing rows have null)
      expect(sql).not.toMatch(/"Product"[\s\S]*"coaCode"\s+TEXT\s+NOT\s+NULL/i);
    });

    it("adds OrderItem.coaCode as nullable TEXT", () => {
      expect(sql).toMatch(
        /ALTER\s+TABLE\s+"OrderItem"\s+ADD\s+COLUMN\s+"coaCode"\s+TEXT/i,
      );
      expect(sql).not.toMatch(/"OrderItem"[\s\S]*"coaCode"\s+TEXT\s+NOT\s+NULL/i);
    });

    it("creates Product_orgId_coaCode_idx for product-level lookups", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+"Product_orgId_coaCode_idx"\s+ON\s+"Product"\("orgId",\s*"coaCode"\)/i,
      );
    });

    it("creates OrderItem_coaCode_idx for income-statement rollup", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+"OrderItem_coaCode_idx"\s+ON\s+"OrderItem"\("coaCode"\)/i,
      );
    });

    it("RED — no CREATE INDEX CONCURRENTLY (Prisma migrations are transactional)", () => {
      expect(sql).not.toMatch(/CREATE\s+INDEX\s+CONCURRENTLY/i);
    });

    it("scope-limited: only touches Product and OrderItem", () => {
      expect(sql).not.toMatch(/ALTER\s+TABLE\s+"Order"\b/i);
      expect(sql).not.toMatch(/ALTER\s+TABLE\s+"ErpCounterparty"/i);
      expect(sql).not.toMatch(/ALTER\s+TABLE\s+"ChartOfAccounts"/i);
      expect(sql).not.toMatch(/ALTER\s+TABLE\s+"IntakeDraft"/i);
    });
  });

  describe("schema", () => {
    it("Product.coaCode declared as optional String", () => {
      const block = schema.match(/model\s+Product\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/coaCode\s+String\?/);
      expect(block).toMatch(/@@index\(\[orgId,\s*coaCode\]\)/);
    });

    it("OrderItem.coaCode declared as optional String + index", () => {
      const block = schema.match(/model\s+OrderItem\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/coaCode\s+String\?/);
      expect(block).toMatch(/@@index\(\[coaCode\]\)/);
    });
  });
});
