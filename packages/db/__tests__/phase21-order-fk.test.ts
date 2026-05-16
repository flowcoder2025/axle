import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const PACKAGE_ROOT = resolve(__dirname, "..");
const schemaPath = resolve(PACKAGE_ROOT, "prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

const migrationsDir = resolve(PACKAGE_ROOT, "prisma/migrations");
const migrationFolder = "20260517000002_phase21_order_counterparty_fk_not_valid";
const sqlPath = resolve(migrationsDir, migrationFolder, "migration.sql");
const sql = existsSync(sqlPath) ? readFileSync(sqlPath, "utf-8") : "";

describe("WI-723a: Order.counterpartyId → ErpCounterparty FK (NOT VALID)", () => {
  describe("schema", () => {
    it("Order declares counterparty relation to ErpCounterparty", () => {
      const block = schema.match(/model\s+Order\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(
        /counterparty\s+ErpCounterparty\?\s+@relation\(fields:\s*\[counterpartyId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict/,
      );
    });

    it("Order.counterpartyId stays nullable (existing rows protected during backfill)", () => {
      const block = schema.match(/model\s+Order\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/counterpartyId\s+String\?/);
    });

    it("Order.counterpartyName snapshot preserved (historical display)", () => {
      // Phase 21 design §3: counterpartyName snapshot 유지 — 머지/이름변경 후에도
      // historical 표시 정확성 보장.
      const block = schema.match(/model\s+Order\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/counterpartyName\s+String\s/);
    });

    it("ErpCounterparty declares orders back-relation", () => {
      const block =
        schema.match(/model\s+ErpCounterparty\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(/orders\s+Order\[\]/);
    });

    it("Order has the (orgId, counterpartyId, occurredAt) composite index for reporting", () => {
      const block = schema.match(/model\s+Order\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(block).toMatch(
        /@@index\(\[orgId,\s*counterpartyId,\s*occurredAt\]\)/,
      );
    });
  });

  describe("migration", () => {
    it("phase21_order_counterparty_fk_not_valid migration directory exists", () => {
      const entries = readdirSync(migrationsDir);
      expect(entries).toContain(migrationFolder);
    });

    it("creates the FK as NOT VALID (not implicit validation)", () => {
      expect(sql).toMatch(
        /ALTER TABLE "Order"[\s\S]*?ADD CONSTRAINT "Order_counterpartyId_fkey"[\s\S]*?FOREIGN KEY \("counterpartyId"\)[\s\S]*?REFERENCES "ErpCounterparty"\("id"\)[\s\S]*?NOT VALID/,
      );
    });

    it("FK uses ON DELETE RESTRICT (not CASCADE, not SET NULL)", () => {
      expect(sql).toMatch(
        /Order_counterpartyId_fkey[\s\S]*?ON DELETE RESTRICT/,
      );
      expect(sql).not.toMatch(/Order_counterpartyId_fkey[\s\S]*?ON DELETE CASCADE/);
      expect(sql).not.toMatch(/Order_counterpartyId_fkey[\s\S]*?ON DELETE SET NULL/);
    });

    it("creates the (orgId, counterpartyId, occurredAt) reporting index", () => {
      expect(sql).toMatch(
        /CREATE INDEX "Order_orgId_counterpartyId_occurredAt_idx"\s+ON\s+"Order"\("orgId",\s*"counterpartyId",\s*"occurredAt"\)/,
      );
    });

    it("scope-limited: no VALIDATE CONSTRAINT (deferred to WI-723c)", () => {
      // RED 케이스: 만약 누군가 실수로 VALIDATE CONSTRAINT를 같은 migration에
      // 추가하면 기존 orphan counterpartyId rows에서 실패. WI-723b 백필 후에만
      // VALIDATE 안전. 별도 migration이어야 함.
      expect(sql).not.toMatch(/VALIDATE\s+CONSTRAINT/);
    });

    it("scope-limited: does NOT touch other tables or columns (WI-726/727 territory)", () => {
      // Product.coaCode (WI-726), OrderItem.coaCode (WI-726), IntakeDraft
      // 확장 (WI-727) 등은 별도 WI.
      expect(sql).not.toMatch(/ALTER TABLE "Product"/);
      expect(sql).not.toMatch(/ALTER TABLE "OrderItem"/);
      expect(sql).not.toMatch(/ALTER TABLE "IntakeDraft"/);
    });
  });

  describe("NOT VALID semantics (RED case documentation)", () => {
    // Postgres NOT VALID FK 의미 검증 — 실제 DB 없이 SQL 의도 명세화.
    // WI-723b 백필 + WI-723c VALIDATE가 완료되기 전까지는 다음이 사실이다:
    //
    //   1. 새 INSERT/UPDATE에 비유효 counterpartyId 값 → 거부됨 (FK enforce)
    //   2. 기존 row의 비유효 counterpartyId 값 → 그대로 보존됨 (NOT VALID 효과)
    //   3. DELETE FROM "ErpCounterparty" WHERE id = (any referenced) → 거부됨 (RESTRICT)
    //   4. ErpCounterparty.id 변경 (cuid 변경은 정상 흐름에서 없지만 raw SQL로 변경 시) → 자동 cascade
    //
    // VALIDATE CONSTRAINT (WI-723c)가 실행되어야만 기존 row까지 일관성 보장.

    it("NOT VALID clause is the last clause of the FK (not stripped by formatting)", () => {
      // SQL formatter가 NOT VALID를 누락시키면 prod 마이그레이션이 기존 orphan
      // row에서 실패함. 정확히 ON UPDATE CASCADE 직후에 NOT VALID가 있어야.
      expect(sql).toMatch(/ON UPDATE CASCADE\s*\n?\s*NOT VALID/);
    });
  });
});
