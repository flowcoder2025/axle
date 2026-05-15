import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const PACKAGE_ROOT = resolve(__dirname, "..");
const schemaPath = resolve(PACKAGE_ROOT, "prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

describe("WI-705: Phase 20 ERP + Receipt Intake schema", () => {
  describe("models", () => {
    const requiredModels = [
      "Product",
      "InventoryMovement",
      "Order",
      "OrderItem",
      "IntakeDraft",
    ];

    for (const model of requiredModels) {
      it(`defines model ${model}`, () => {
        expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
      });
    }
  });

  describe("enums", () => {
    it("defines MovementType { IN OUT ADJUST }", () => {
      expect(schema).toMatch(/enum\s+MovementType\s*\{[^}]*\bIN\b[^}]*\bOUT\b[^}]*\bADJUST\b[^}]*\}/s);
    });

    it("defines ReferenceType with all 4 values", () => {
      expect(schema).toMatch(/enum\s+ReferenceType\s*\{/);
      const block = schema.match(/enum\s+ReferenceType\s*\{([^}]*)\}/s)?.[1] ?? "";
      expect(block).toContain("RECEIPT_INTAKE");
      expect(block).toContain("ORDER");
      expect(block).toContain("MANUAL");
      expect(block).toContain("INITIAL");
    });

    it("defines OrderType { SALE PURCHASE }", () => {
      expect(schema).toMatch(/enum\s+OrderType\s*\{[^}]*\bSALE\b[^}]*\bPURCHASE\b[^}]*\}/s);
    });

    it("defines OrderStatus { DRAFT CONFIRMED CANCELLED }", () => {
      const block = schema.match(/enum\s+OrderStatus\s*\{([^}]*)\}/s)?.[1] ?? "";
      expect(block).toContain("DRAFT");
      expect(block).toContain("CONFIRMED");
      expect(block).toContain("CANCELLED");
    });

    it("defines DraftStatus { PENDING CONFIRMED DISCARDED }", () => {
      const block = schema.match(/enum\s+DraftStatus\s*\{([^}]*)\}/s)?.[1] ?? "";
      expect(block).toContain("PENDING");
      expect(block).toContain("CONFIRMED");
      expect(block).toContain("DISCARDED");
    });
  });

  describe("Product model", () => {
    const block = schema.match(/model\s+Product\s*\{([^}]*)\}/s)?.[1] ?? "";

    it("has unique constraint on [orgId, sku]", () => {
      expect(schema).toContain("@@unique([orgId, sku])");
    });

    it("has index on [orgId, name]", () => {
      expect(schema).toContain("@@index([orgId, name])");
    });

    it("has index on [orgId, archived]", () => {
      expect(schema).toContain("@@index([orgId, archived])");
    });

    it("has unitPrice Decimal default 0", () => {
      expect(block).toMatch(/unitPrice\s+Decimal\s+@default\(0\)/);
    });

    it("has archived Boolean default false", () => {
      expect(block).toMatch(/archived\s+Boolean\s+@default\(false\)/);
    });

    it("sku is nullable (String?)", () => {
      expect(block).toMatch(/sku\s+String\?/);
    });
  });

  describe("InventoryMovement model", () => {
    const block = schema.match(/model\s+InventoryMovement\s*\{([^}]*)\}/s)?.[1] ?? "";

    it("qty is Int (unsigned — direction from type)", () => {
      expect(block).toMatch(/qty\s+Int\b/);
    });

    it("type is MovementType (not nullable)", () => {
      expect(block).toMatch(/type\s+MovementType(?!\?)/);
    });

    it("has product FK relation", () => {
      expect(block).toMatch(/product\s+Product\s+@relation\(fields:\s*\[productId\]/);
    });

    it("has index on [orgId, productId, occurredAt]", () => {
      expect(schema).toContain("@@index([orgId, productId, occurredAt])");
    });

    it("has index on [orgId, occurredAt]", () => {
      expect(schema).toContain("@@index([orgId, occurredAt])");
    });
  });

  describe("Order model", () => {
    const block = schema.match(/model\s+Order\s*\{([^}]*)\}/s)?.[1] ?? "";

    it("counterpartyId is free-form String? (no FK)", () => {
      expect(block).toMatch(/counterpartyId\s+String\?/);
      // FK 부재: counterpartyId 라인 다음에 @relation 없어야 함
      expect(block).not.toMatch(/counterparty\s+\w+\s+@relation/);
    });

    it("counterpartyName is required snapshot", () => {
      expect(block).toMatch(/counterpartyName\s+String(?!\?)/);
    });

    it("has index on [orgId, type, occurredAt]", () => {
      expect(schema).toContain("@@index([orgId, type, occurredAt])");
    });
  });

  describe("OrderItem model", () => {
    const block = schema.match(/model\s+OrderItem\s*\{([^}]*)\}/s)?.[1] ?? "";

    it("productId is nullable (ad-hoc items allowed)", () => {
      expect(block).toMatch(/productId\s+String\?/);
    });

    it("has Cascade delete from Order", () => {
      expect(block).toMatch(
        /order\s+Order\s+@relation\(fields:\s*\[orderId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });

    it("has optional product relation (Product?)", () => {
      expect(block).toMatch(/product\s+Product\?\s+@relation/);
    });
  });

  describe("IntakeDraft model", () => {
    const block = schema.match(/model\s+IntakeDraft\s*\{([^}]*)\}/s)?.[1] ?? "";

    it("userId is nullable (onDelete: SetNull requirement)", () => {
      expect(block).toMatch(/userId\s+String\?/);
    });

    it("user relation has onDelete: SetNull", () => {
      expect(block).toMatch(
        /user\s+User\?\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/,
      );
    });

    it("has unique on confirmedOrderId (idempotency)", () => {
      expect(schema).toContain("@@unique([confirmedOrderId])");
    });

    it("ocrJson / parsedJson / matchSuggestions are Json (non-null)", () => {
      expect(block).toMatch(/ocrJson\s+Json(?!\?)/);
      expect(block).toMatch(/parsedJson\s+Json(?!\?)/);
      expect(block).toMatch(/matchSuggestions\s+Json(?!\?)/);
    });

    it("has index on [orgId, status, createdAt]", () => {
      expect(schema).toContain("@@index([orgId, status, createdAt])");
    });

    it("has index on [orgId, userId, status]", () => {
      expect(schema).toContain("@@index([orgId, userId, status])");
    });
  });

  describe("User back-relation", () => {
    it("User model declares intakeDrafts IntakeDraft[]", () => {
      const userBlock = schema.match(/model\s+User\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
      expect(userBlock).toMatch(/intakeDrafts\s+IntakeDraft\[\]/);
    });
  });

  describe("migration", () => {
    const migrationsDir = resolve(PACKAGE_ROOT, "prisma/migrations");

    it("phase20_erp_intake migration directory exists", () => {
      expect(existsSync(migrationsDir)).toBe(true);
      const entries = readdirSync(migrationsDir);
      const match = entries.find((e) => e.endsWith("_phase20_erp_intake"));
      expect(match).toBeDefined();
    });

    it("migration.sql defines 5 enums and 5 tables", () => {
      const entries = readdirSync(migrationsDir);
      const dir = entries.find((e) => e.endsWith("_phase20_erp_intake"));
      expect(dir).toBeDefined();
      const sqlPath = resolve(migrationsDir, dir!, "migration.sql");
      const sql = readFileSync(sqlPath, "utf-8");

      expect((sql.match(/^CREATE TYPE/gm) ?? []).length).toBe(5);
      expect((sql.match(/^CREATE TABLE/gm) ?? []).length).toBe(5);
      // No ALTER on User table — back-relation is application-level only
      expect(sql).not.toMatch(/ALTER TABLE "User"/);
    });

    it("migration.sql defines required FKs", () => {
      const entries = readdirSync(migrationsDir);
      const dir = entries.find((e) => e.endsWith("_phase20_erp_intake"))!;
      const sql = readFileSync(resolve(migrationsDir, dir, "migration.sql"), "utf-8");

      expect(sql).toMatch(/InventoryMovement_productId_fkey/);
      expect(sql).toMatch(/OrderItem_orderId_fkey/);
      expect(sql).toMatch(/OrderItem_productId_fkey/);
      expect(sql).toMatch(/IntakeDraft_userId_fkey/);
      // OrderItem.order: Cascade
      expect(sql).toMatch(
        /OrderItem_orderId_fkey[\s\S]*?REFERENCES\s+"Order"\("id"\)\s+ON DELETE CASCADE/,
      );
      // IntakeDraft.user: SetNull
      expect(sql).toMatch(
        /IntakeDraft_userId_fkey[\s\S]*?REFERENCES\s+"User"\("id"\)\s+ON DELETE SET NULL/,
      );
    });
  });
});
