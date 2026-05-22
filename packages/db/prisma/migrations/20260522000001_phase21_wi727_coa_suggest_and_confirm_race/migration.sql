-- Phase 21 — ERP Amplification (WI-727)
-- AI suggestedCoaCode + IntakeDraft.confirmedAt race protection + coaSource audit.
--
-- Three concerns in one migration because they all land in the same WI:
--
--  1. IntakeDraft.suggestedCoaCodes (Json, nullable) — receives the COA
--     suggest engine's output at OCR time. Shape:
--       [{ lineIndex, productName, coaCode, confidence, alternatives? }]
--     Reads happen only on the confirm path; no index is justified.
--
--  2. IntakeDraft.confirmedAt + confirmedBy — extend the CAS guard. The
--     existing PENDING → CONFIRMED transition (via updateMany filtered by
--     status) already wins the race; the new column is the audit record
--     and the secondary guard so out-of-band writers (admin tools,
--     future schema migrations) cannot transition a row to CONFIRMED
--     without recording who/when. Both columns are nullable because the
--     vast majority of historical rows predate WI-727.
--
--  3. OrderItem.coaSource (enum) — records which SSOT layer supplied the
--     resolved coaCode. Reports (WI-728~730) can split AI-promoted
--     items from manually-classified ones to track accuracy in
--     production. enum vs free-form text because the layer set is
--     fixed and small (5 values).
--
-- Lock profile: ALTER TABLE ... ADD COLUMN with no DEFAULT is metadata-only
-- in Postgres 11+, even for enum-typed columns. AiJobType enum ALTER ADD
-- VALUE is also non-blocking. The migration is safe to apply on a live
-- prod table.
--
-- Rollback: the new columns are nullable + the enum value is unused by
-- existing rows, so a fresh `DROP COLUMN` / `ALTER TYPE ... DROP VALUE`
-- is mechanical. We do not ship a down migration (Prisma doesn't run
-- them in production).

-- CreateEnum
CREATE TYPE "CoaSource" AS ENUM (
  'ORDER_ITEM',
  'PRODUCT',
  'COUNTERPARTY',
  'AI',
  'UNCLASSIFIED'
);

-- AlterEnum
ALTER TYPE "AiJobType" ADD VALUE 'COA_SUGGEST';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "coaSource" "CoaSource";

-- AlterTable
ALTER TABLE "IntakeDraft" ADD COLUMN "suggestedCoaCodes" JSONB;
ALTER TABLE "IntakeDraft" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "IntakeDraft" ADD COLUMN "confirmedBy" TEXT;
