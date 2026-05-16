-- Phase 21 — ERP Amplification (WI-723a)
-- Order.counterpartyId → ErpCounterparty(id) FK, added as NOT VALID.
--
-- Rationale:
--   - Existing Order rows may have counterpartyId values that are free-form
--     snapshots (string IDs from Phase 20, not ErpCounterparty row ids).
--   - A normal FK with implicit validation would fail at constraint creation
--     time on such orphan rows. NOT VALID lets us create the constraint now
--     and validate it later in WI-723c after the staging backfill (WI-723b)
--     has either matched, created, or NULLed the counterpartyId for every
--     existing row.
--   - Writes after this migration are validated by the FK (new orphan inserts
--     are rejected) — only existing rows are exempt until VALIDATE runs.
--   - Postgres applies an ACCESS EXCLUSIVE lock only briefly for ADD
--     CONSTRAINT ... NOT VALID (catalog-only change). VALIDATE in WI-723c
--     uses SHARE UPDATE EXCLUSIVE which permits concurrent DML.
--
-- ON DELETE RESTRICT: deleting an ErpCounterparty that still has Orders is
-- blocked. Soft-delete (deletedAt) is the supported flow (WI-722). Hard
-- delete + cascade is intentionally not provided — historical reporting
-- depends on the linkage.

-- AddForeignKey
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_counterpartyId_fkey"
  FOREIGN KEY ("counterpartyId") REFERENCES "ErpCounterparty"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- CreateIndex
-- Phase 21 WI-728 reporting (counterparty-grouped queries by occurredAt) —
-- introduced here because index creation doesn't depend on FK validation.
CREATE INDEX "Order_orgId_counterpartyId_occurredAt_idx" ON "Order"("orgId", "counterpartyId", "occurredAt");
