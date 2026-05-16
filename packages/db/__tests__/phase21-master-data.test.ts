import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const PACKAGE_ROOT = resolve(__dirname, "..");
const schemaPath = resolve(PACKAGE_ROOT, "prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

describe("WI-721: Phase 21 ERP Amplification — master data schema", () => {
  describe("enums", () => {
    const requiredEnums = ["CounterpartyType", "CoaCategory", "BackfillStatus"];

    for (const e of requiredEnums) {
      it(`defines enum ${e}`, () => {
        expect(schema).toMatch(new RegExp(`enum\\s+${e}\\s*\\{`));
      });
    }

    it("CounterpartyType has CUSTOMER | SUPPLIER | BOTH values", () => {
      const block = schema.match(/enum\s+CounterpartyType\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/CUSTOMER/);
      expect(block).toMatch(/SUPPLIER/);
      expect(block).toMatch(/BOTH/);
    });

    it("CoaCategory has 5 standard tax categories", () => {
      const block = schema.match(/enum\s+CoaCategory\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      for (const v of ["REVENUE", "COGS", "OPEX", "NON_OPERATING", "OTHER"]) {
        expect(block).toMatch(new RegExp(v));
      }
    });

    it("BackfillStatus has PENDING | RUNNING | COMPLETED | FAILED", () => {
      const block = schema.match(/enum\s+BackfillStatus\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      for (const v of ["PENDING", "RUNNING", "COMPLETED", "FAILED"]) {
        expect(block).toMatch(new RegExp(v));
      }
    });
  });

  describe("models", () => {
    const requiredModels = [
      "ErpCounterparty",
      "ChartOfAccounts",
      "CounterpartyMergeLog",
      "CounterpartyBackfillBatch",
    ];

    for (const model of requiredModels) {
      it(`defines model ${model}`, () => {
        expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
      });
    }

    it("ErpCounterparty has all required fields", () => {
      const block = schema.match(/model\s+ErpCounterparty\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      // identifiers + display
      expect(block).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
      expect(block).toMatch(/orgId\s+String/);
      expect(block).toMatch(/name\s+String/);
      // search key
      expect(block).toMatch(/normalizedName\s+String/);
      // optional business identifiers
      expect(block).toMatch(/bizRegNo\s+String\?/);
      // type + COA fallback
      expect(block).toMatch(/type\s+CounterpartyType/);
      expect(block).toMatch(/defaultCoaCode\s+String\?/);
      // soft-delete + merge target
      expect(block).toMatch(/deletedAt\s+DateTime\?/);
      expect(block).toMatch(/mergedIntoId\s+String\?/);
    });

    it("ChartOfAccounts is org-scoped and tracks source authority", () => {
      const block = schema.match(/model\s+ChartOfAccounts\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/orgId\s+String/);
      expect(block).toMatch(/code\s+String/);
      expect(block).toMatch(/category\s+CoaCategory/);
      expect(block).toMatch(/source\s+String/);
      expect(block).toMatch(/isSystem\s+Boolean/);
      expect(block).toMatch(/@@unique\(\[orgId,\s*code\]\)/);
    });

    it("CounterpartyMergeLog references both source and target", () => {
      const block =
        schema.match(/model\s+CounterpartyMergeLog\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/mergedFromId\s+String/);
      expect(block).toMatch(/mergedIntoId\s+String/);
      expect(block).toMatch(/orderCount\s+Int/);
      expect(block).toMatch(/performedBy\s+String/);
      // relations to ErpCounterparty
      expect(block).toMatch(/mergedFrom\s+ErpCounterparty\s+@relation\("mergeFrom"/);
      expect(block).toMatch(/mergedInto\s+ErpCounterparty\s+@relation\("mergeInto"/);
    });

    it("CounterpartyBackfillBatch supports checkpoint restart", () => {
      const block =
        schema.match(/model\s+CounterpartyBackfillBatch\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/status\s+BackfillStatus/);
      expect(block).toMatch(/totalOrders\s+Int/);
      expect(block).toMatch(/processedOrders\s+Int/);
      expect(block).toMatch(/lastOrderId\s+String\?/);
      expect(block).toMatch(/pendingReview\s+Int/);
    });
  });

  describe("migration", () => {
    const migrationsDir = resolve(PACKAGE_ROOT, "prisma/migrations");
    const migrationFolder = "20260517000001_phase21_master_data";
    const sqlPath = resolve(migrationsDir, migrationFolder, "migration.sql");

    it("phase21_master_data migration directory exists", () => {
      expect(existsSync(sqlPath)).toBe(true);
      const entries = readdirSync(migrationsDir);
      expect(entries).toContain(migrationFolder);
    });

    const sql = existsSync(sqlPath) ? readFileSync(sqlPath, "utf-8") : "";

    it("migration creates 3 enums and 4 tables", () => {
      expect((sql.match(/^CREATE TYPE/gm) ?? []).length).toBe(3);
      expect((sql.match(/^CREATE TABLE/gm) ?? []).length).toBe(4);
    });

    it("migration creates partial unique on (orgId, bizRegNo) WHERE bizRegNo IS NOT NULL", () => {
      // RED 케이스 검증: bizRegNo NULL 2개 row를 같은 orgId에 삽입해도 unique 위반이 발생하지 않도록
      // partial unique 인덱스가 정확히 WHERE 절을 포함하는지 확인.
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX "ErpCounterparty_orgId_bizRegNo_uniq"[\s\S]*?WHERE\s+"bizRegNo"\s+IS\s+NOT\s+NULL/,
      );
    });

    it("migration creates @@unique on ChartOfAccounts(orgId, code)", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX "ChartOfAccounts_orgId_code_key"\s+ON\s+"ChartOfAccounts"\("orgId",\s*"code"\)/,
      );
    });

    it("migration creates FKs on CounterpartyMergeLog with ON DELETE RESTRICT", () => {
      expect(sql).toMatch(
        /CounterpartyMergeLog_mergedFromId_fkey[\s\S]*?REFERENCES\s+"ErpCounterparty"\("id"\)\s+ON DELETE RESTRICT/,
      );
      expect(sql).toMatch(
        /CounterpartyMergeLog_mergedIntoId_fkey[\s\S]*?REFERENCES\s+"ErpCounterparty"\("id"\)\s+ON DELETE RESTRICT/,
      );
    });

    it("migration does NOT alter existing Order/Product/OrderItem/IntakeDraft (scope-limited to WI-721)", () => {
      // WI-721은 4 신규 모델만. 기존 모델 변경은 WI-723a (Order FK), WI-726 (Product/OrderItem coaCode),
      // WI-727 (IntakeDraft.suggestedCoaCodes/confirmedAt)에서 수행.
      expect(sql).not.toMatch(/ALTER TABLE "Order"\b(?! ADD CONSTRAINT "Order_counterpartyId)/);
      expect(sql).not.toMatch(/ALTER TABLE "Product"\b/);
      expect(sql).not.toMatch(/ALTER TABLE "OrderItem"\b/);
      expect(sql).not.toMatch(/ALTER TABLE "IntakeDraft"\b/);
    });
  });

  describe("partial unique constraint semantics (RED case)", () => {
    // Postgres partial unique index `WHERE bizRegNo IS NOT NULL` 의미 검증.
    // 실제 DB가 없어도 정규식으로 의도된 동작을 명세화 — 향후 통합 테스트에서 실 검증.
    const sqlPath = resolve(
      PACKAGE_ROOT,
      "prisma/migrations/20260517000001_phase21_master_data/migration.sql",
    );
    const sql = existsSync(sqlPath) ? readFileSync(sqlPath, "utf-8") : "";

    it("constraint targets (orgId, bizRegNo) — not just bizRegNo alone", () => {
      // 다른 org는 동일 bizRegNo 허용해야 함 (multi-tenant)
      expect(sql).toMatch(/"ErpCounterparty_orgId_bizRegNo_uniq"\s+ON\s+"ErpCounterparty"\("orgId",\s*"bizRegNo"\)/);
    });

    it("WHERE clause uses IS NOT NULL (not !=, not strict empty check)", () => {
      // bizRegNo가 빈 문자열인 경우는 unique 검사 대상 — IS NOT NULL 만으로 충분.
      // 빈 문자열 거부는 애플리케이션 레벨 검증 (Zod) 책임.
      expect(sql).toMatch(/WHERE\s+"bizRegNo"\s+IS\s+NOT\s+NULL/);
    });
  });
});
