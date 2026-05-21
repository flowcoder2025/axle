-- Phase 21 — ERP Amplification (WI-726)
-- Add Product.coaCode + OrderItem.coaCode + supporting indexes.
--
-- SSOT priority (design §3.2): OrderItem.coaCode > Product.coaCode >
-- ErpCounterparty.defaultCoaCode. The resolver (apps/web/lib/erp/coa-resolver.ts)
-- collapses these three sources into the single OrderItem.coaCode column
-- written at create-time so reports (WI-728/729/730) can scan a flat
-- (orgId, coaCode) tuple without a 3-way coalesce per row.
--
-- Why both columns are nullable:
--   - Existing Orders / Products predating this migration have no coa
--     assignment. The resolver returns null when all three sources are
--     null (design §5 RED case AC #4); reports surface those rows as
--     "미분류" rather than rejecting them.
--   - There is no FK from coaCode to ChartOfAccounts.code (codes are
--     org-scoped and the FK target would have to be the composite
--     (orgId, code), which Prisma can express but adds a join cost on
--     every read — not worth it for a soft reference).
--
-- Lock profile: ALTER TABLE ... ADD COLUMN with no DEFAULT is metadata-only
-- in Postgres 11+ (no table rewrite), so this completes within
-- statement_timeout on AXLE's prod Order volumes. The B-tree indexes
-- below are created without CONCURRENTLY because Prisma migrations are
-- transactional; revisit when these tables outgrow that constraint.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "coaCode" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "coaCode" TEXT;

-- CreateIndex
CREATE INDEX "Product_orgId_coaCode_idx" ON "Product"("orgId", "coaCode");

-- CreateIndex
-- OrderItem doesn't denormalize orgId yet (WI-728-prep will). This single
-- column index supports the income-statement category rollup; WI-728-prep
-- replaces it with (orgId, coaCode, lineTotal) after the denormalization.
CREATE INDEX "OrderItem_coaCode_idx" ON "OrderItem"("coaCode");
