-- Phase 21 — ERP Amplification (WI-728-prep)
-- Reporting infrastructure: OrderItem.orgId denormalization + supporting
-- compound indexes + monthly summary materialized view.
--
-- Why denormalize orgId onto OrderItem?
--   M2 reports (WI-728 거래처별 매출/매입, WI-729 손익계산서) scan
--   OrderItem grouped by (orgId, coaCode, ...). Without the denorm, every
--   read needs an Order JOIN just to bring orgId into the predicate —
--   that JOIN dominates the plan on 10k+ row tenants. The trade-off is
--   one extra write per intake confirm + the invariant "OrderItem.orgId
--   == its parent Order.orgId" (enforced at write time in confirm/route.ts
--   — there is no other OrderItem write path in the codebase).
--
-- Why the materialized view?
--   Reports query month-grouped aggregates per counterparty + coaCode.
--   Computing the GROUP BY on every request scales linearly with
--   OrderItem; the mv collapses it to one row per (org, month,
--   counterparty, coa, type). Daily refresh (cron) keeps it within ≤24h
--   of source. The UNIQUE INDEX is the precondition for `REFRESH
--   MATERIALIZED VIEW CONCURRENTLY` (Postgres docs).
--
-- Lock profile:
--   - OrderItem.orgId NOT NULL: ADD COLUMN nullable → UPDATE → SET NOT
--     NULL in one migration. Safe at AXLE's dogfooding scale; for prod
--     scale we'd split into 3 migrations (NOT NULL only after backfill
--     verified across replicas). Document this in the rollout note for
--     ops, not as code.
--   - CREATE INDEX: NOT CONCURRENTLY because Prisma migrations are
--     transactional. The OrderItem index trades the WI-726 single-column
--     coaCode index for a compound (orgId, coaCode, lineTotal) one — drop
--     happens before create so a query optimizer that prefers the older
--     index for a brief window doesn't degrade SELECTs.
--
-- The materialized view ships EMPTY (no `WITH DATA`). Reports fall back
-- to source tables until the first refresh runs — this matches the RED
-- AC (4): "미초기화 mv 조회 시 빈 결과".

-- 1. OrderItem.orgId denormalize
ALTER TABLE "OrderItem" ADD COLUMN "orgId" TEXT;

UPDATE "OrderItem" oi
   SET "orgId" = o."orgId"
  FROM "Order" o
 WHERE oi."orderId" = o."id";

ALTER TABLE "OrderItem" ALTER COLUMN "orgId" SET NOT NULL;

-- 2. Replace WI-726 single-column coaCode index with compound rollup index
DROP INDEX IF EXISTS "OrderItem_coaCode_idx";
CREATE INDEX "OrderItem_orgId_coaCode_lineTotal_idx"
  ON "OrderItem"("orgId", "coaCode", "lineTotal");

-- 3. Order: window-then-direction lookup for report filters
CREATE INDEX "Order_orgId_occurredAt_type_idx"
  ON "Order"("orgId", "occurredAt", "type");

-- 4. Materialized view — monthly summary per (org, month, counterparty,
--    coaCode, type). Restricted to CONFIRMED orders so DRAFTs/CANCELLED
--    rows don't pollute the report numbers (and a future "DRAFT preview"
--    can still hit source tables directly).
CREATE MATERIALIZED VIEW "mv_erp_monthly_summary" AS
SELECT
  o."orgId",
  EXTRACT(YEAR FROM o."occurredAt")::INT  AS year,
  EXTRACT(MONTH FROM o."occurredAt")::INT AS month,
  o."counterpartyId",
  oi."coaCode",
  o."type",
  SUM(oi."lineTotal")                     AS total_amount,
  SUM(oi."qty")                           AS total_qty,
  COUNT(*)                                AS line_count
FROM "Order" o
JOIN "OrderItem" oi ON oi."orderId" = o."id"
WHERE o."status" = 'CONFIRMED'
GROUP BY
  o."orgId",
  EXTRACT(YEAR FROM o."occurredAt"),
  EXTRACT(MONTH FROM o."occurredAt"),
  o."counterpartyId",
  oi."coaCode",
  o."type"
WITH NO DATA;

-- 5. UNIQUE INDEX — precondition for REFRESH MATERIALIZED VIEW CONCURRENTLY.
--    GROUP BY already guarantees one row per tuple but the index also
--    needs to treat NULL counterpartyId / coaCode as a single bucket so
--    rows from "ad-hoc" orders (no master) don't collide with each other
--    across refreshes. Postgres 15+ exposes NULLS NOT DISTINCT for this;
--    Supabase ships Postgres ≥15.
CREATE UNIQUE INDEX "mv_erp_monthly_summary_uniq"
  ON "mv_erp_monthly_summary"(
    "orgId",
    year,
    month,
    "counterpartyId",
    "coaCode",
    "type"
  ) NULLS NOT DISTINCT;
