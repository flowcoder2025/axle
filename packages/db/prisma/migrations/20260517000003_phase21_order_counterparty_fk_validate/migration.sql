-- Phase 21 — ERP Amplification (WI-723c)
-- VALIDATE the Order.counterpartyId → ErpCounterparty(id) FK introduced in
-- WI-723a (migration 20260517000002).
--
-- Prerequisites enforced operationally (NOT by this migration):
--   1. WI-723b backfill has completed for every tenant — all surviving
--      Order rows either have counterpartyId=NULL (acceptable: column is
--      nullable) OR a valid ErpCounterparty.id.
--   2. Service layer (apps/web) refuses to write Orders without resolving
--      counterpartyId via resolveOrCreateCounterparty() — see this WI's
--      apps/web/lib/erp/counterparty-resolver.ts.
--
-- Lock profile:
--   ALTER TABLE ... VALIDATE CONSTRAINT acquires SHARE UPDATE EXCLUSIVE,
--   which blocks schema changes and other VALIDATE runs but allows
--   concurrent INSERT/UPDATE/DELETE. Wall-clock time scales with row count
--   (one seq scan).  For AXLE's current Order volumes this completes in
--   well under the 5s statement_timeout used by migrate deploy.
--
-- Rollback note:
--   Postgres has no `INVALIDATE` opcode. To revert, drop and re-add the FK
--   with NOT VALID; in practice a backwards step is never needed because
--   this migration only tightens the existing constraint.

ALTER TABLE "Order"
  VALIDATE CONSTRAINT "Order_counterpartyId_fkey";
