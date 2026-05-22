/**
 * ERP reporting helpers (Phase 21 WI-728/729/730 backend).
 *
 * Reads go against `mv_erp_monthly_summary` (built in WI-728-prep) so the
 * GROUP BY is computed once per cron tick rather than per request. The
 * mv schema:
 *
 *   (orgId, year, month, counterpartyId, coaCode, type) →
 *     total_amount NUMERIC, total_qty BIGINT, line_count BIGINT
 *
 * The mv is restricted to `Order.status='CONFIRMED'` so DRAFT / CANCELLED
 * rows never contaminate report totals — see migration
 * 20260522000002_phase21_wi728_prep_mv_and_orderitem_orgid.
 *
 * Why raw SQL: Prisma 7 view support requires a `view` block in the
 * schema, which forces the query layer through Prisma's where-builder.
 * The reports need cheap aggregates with composite period filters; raw
 * SQL keeps the plan trivial and avoids forcing the mv into the Prisma
 * type space.
 *
 * Number precision: amounts come back from Postgres NUMERIC as strings.
 * We aggregate in `Number` with the well-known two-decimal-cent
 * accumulation trick — multiply by 100 before adding, divide after.
 * Korean SMB ERP reports show at most two decimals; the IEEE-754 mantissa
 * is fine through ~9e13 (≈ 100조 원). When AXLE's data grows past that,
 * swap to BigInt.
 */

import { prisma } from "@axle/db";
import { decimalToString } from "./serialize";

export const ERP_MV_NAME = "mv_erp_monthly_summary";

export type OrderDirection = "SALE" | "PURCHASE";

/**
 * `YYYY-MM` month token. Returned by the report API as-is so the UI
 * doesn't have to reformat per-locale.
 */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export interface CounterpartyRollupRow {
  counterpartyId: string | null;
  counterpartyName: string | null;
  totalAmount: string; // Decimal as canonical string ("12345.67")
  totalQty: number;
  lineCount: number;
  monthlyBreakdown: { month: string; totalAmount: string }[];
}

export interface CounterpartyReportOptions {
  orgId: string;
  /** YYYY-MM (inclusive) — earliest month to include. */
  from: { year: number; month: number };
  /** YYYY-MM (inclusive) — latest month to include. */
  to: { year: number; month: number };
  type: OrderDirection;
  /** Default 10. The report is a leaderboard; clamp to a sane page size. */
  limit?: number;
}

/** Parse Postgres NUMERIC string into cents (integer × 100). */
function numericToCents(raw: unknown): number {
  const s = decimalToString(raw as never);
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Convert cents back to fixed-2 decimal string. Truncation (not rounding)
 *  to match Korean SMB accounting convention. */
function centsToString(c: number): string {
  const neg = c < 0;
  const abs = Math.abs(c);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  return `${neg ? "-" : ""}${whole}.${String(frac).padStart(2, "0")}`;
}

/**
 * Aggregate top counterparties by total amount across the requested
 * (year, month) window. The mv already pre-aggregates monthly totals;
 * here we just sum across months per counterparty and order by amount.
 *
 * We deliberately fetch the mv rows once and shape them in JS rather
 * than issuing a second query for the monthly breakdown — both passes
 * scan the same row range, so a single query keeps the plan to one
 * index seek.
 */
export async function counterpartyReport(
  opts: CounterpartyReportOptions,
): Promise<{
  rows: CounterpartyRollupRow[];
  totalAmount: string;
  generatedAt: string;
  dataAsOf: string | null;
}> {
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 100));

  // Convert (year, month) to a single integer (year*100 + month) so the
  // BETWEEN clause uses a single column-wise comparison.
  const fromInt = opts.from.year * 100 + opts.from.month;
  const toInt = opts.to.year * 100 + opts.to.month;
  if (toInt < fromInt) {
    throw new Error("REPORT_BAD_RANGE: 'to' must be >= 'from'");
  }

  // mv rows for the window. counterpartyId can be null (ad-hoc orders);
  // we keep those in a synthetic "(미지정 거래처)" bucket per AC #4.
  const raw = await prisma.$queryRawUnsafe<
    Array<{
      counterpartyId: string | null;
      year: number;
      month: number;
      total_amount: unknown;
      total_qty: bigint | number;
      line_count: bigint | number;
    }>
  >(
    `SELECT
        "counterpartyId",
        year,
        month,
        SUM(total_amount) AS total_amount,
        SUM(total_qty)    AS total_qty,
        SUM(line_count)   AS line_count
      FROM "${ERP_MV_NAME}"
      WHERE "orgId" = $1
        AND "type" = $2
        AND (year * 100 + month) BETWEEN $3 AND $4
      GROUP BY "counterpartyId", year, month
      ORDER BY year ASC, month ASC`,
    opts.orgId,
    opts.type,
    fromInt,
    toInt,
  );

  // Group by counterparty in memory.
  const byCp = new Map<
    string,
    {
      counterpartyId: string | null;
      monthly: Map<string, number>; // cents
      totalAmount: number; // cents
      totalQty: number;
      lineCount: number;
    }
  >();

  for (const row of raw) {
    const key = row.counterpartyId ?? "__null__";
    let entry = byCp.get(key);
    if (!entry) {
      entry = {
        counterpartyId: row.counterpartyId,
        monthly: new Map(),
        totalAmount: 0,
        totalQty: 0,
        lineCount: 0,
      };
      byCp.set(key, entry);
    }
    const cents = numericToCents(row.total_amount);
    entry.totalAmount += cents;
    const mk = monthKey(row.year, row.month);
    entry.monthly.set(mk, (entry.monthly.get(mk) ?? 0) + cents);
    entry.totalQty += Number(row.total_qty);
    entry.lineCount += Number(row.line_count);
  }

  // Fetch counterparty names in one pass for the rollup.
  const cpIds = Array.from(byCp.values())
    .map((e) => e.counterpartyId)
    .filter((id): id is string => id !== null);
  const cpNameMap = new Map<string, string>();
  if (cpIds.length > 0) {
    const masters = await prisma.erpCounterparty.findMany({
      where: { id: { in: cpIds }, orgId: opts.orgId },
      select: { id: true, name: true },
    });
    for (const m of masters) cpNameMap.set(m.id, m.name);
  }

  const rows: CounterpartyRollupRow[] = Array.from(byCp.values())
    .map((e) => ({
      counterpartyId: e.counterpartyId,
      counterpartyName: e.counterpartyId
        ? (cpNameMap.get(e.counterpartyId) ?? null)
        : null,
      totalAmount: centsToString(e.totalAmount),
      totalQty: e.totalQty,
      lineCount: e.lineCount,
      monthlyBreakdown: Array.from(e.monthly.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amt]) => ({ month, totalAmount: centsToString(amt) })),
      _sortKey: e.totalAmount, // private; stripped below
    }))
    // Decreasing — leaderboard.
    .sort((a, b) => b._sortKey - a._sortKey)
    .slice(0, limit)
    .map(({ _sortKey: _, ...rest }) => rest);

  const totalCents = rows.reduce<number>((acc, r) => {
    return acc + numericToCents(r.totalAmount);
  }, 0);

  // Freshness — latest successful refresh. Null when the mv has never
  // refreshed (greenfield deploy, before first cron tick).
  const latestRefresh = await prisma.mvRefreshLog.findFirst({
    where: { viewName: ERP_MV_NAME },
    orderBy: { refreshedAt: "desc" },
    select: { refreshedAt: true },
  });

  return {
    rows,
    totalAmount: centsToString(totalCents),
    generatedAt: new Date().toISOString(),
    dataAsOf: latestRefresh ? latestRefresh.refreshedAt.toISOString() : null,
  };
}
