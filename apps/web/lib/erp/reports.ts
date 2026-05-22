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

// =============================================================================
// Income statement (WI-729) — simplified P&L report grouped by ChartOfAccounts.
// =============================================================================

export type CoaCategory =
  | "REVENUE"
  | "COGS"
  | "OPEX"
  | "NON_OPERATING"
  | "OTHER";

export interface IncomeStatementLeaf {
  code: string;
  name: string;
  category: CoaCategory;
  parentCode: string | null;
  total: string; // cents-as-fixed-2 string
}

export interface IncomeStatementNode extends IncomeStatementLeaf {
  children: IncomeStatementNode[];
}

export interface IncomeStatementCategory {
  category: CoaCategory;
  total: string;
  rows: IncomeStatementNode[];
}

export interface IncomeStatementOptions {
  orgId: string;
  year: number;
  /** 1-12 (inclusive). Omit for the full-year report. */
  month?: number;
}

/**
 * Build a simplified P&L for a single month or a full year.
 *
 * The mv exposes (orgId, year, month, counterpartyId, coaCode, type). Income
 * statement doesn't care about counterparty or direction — the COA category
 * itself determines whether a row contributes to REVENUE / COGS / OPEX.
 *
 * Hierarchy (design §5 WI-729 AC 3): codes with `parentCode` roll into their
 * parent. The seed currently ships depth-2 (e.g. 401/402/404 → 400 (매출);
 * 514/515/... → 500 (판매비와관리비)). We aggregate at the application layer
 * so the API stays portable across tenants that may grow deeper trees later.
 *
 * Empty result: AC #4 — when no orders matched, every category total is 0
 * and rows are empty. Status is still 200 (no error).
 */
export async function incomeStatementReport(
  opts: IncomeStatementOptions,
): Promise<{
  year: number;
  month: number | null;
  categories: Record<CoaCategory, IncomeStatementCategory>;
  operatingIncome: string;
  netIncome: string;
  generatedAt: string;
  dataAsOf: string | null;
}> {
  const monthFilter =
    opts.month !== undefined
      ? `AND month = ${opts.month}`
      : ``; // full-year — all months 1..12 for the requested year
  if (opts.month !== undefined && (opts.month < 1 || opts.month > 12)) {
    throw new Error("REPORT_BAD_MONTH: month must be 1-12");
  }

  // Sum mv rows per coaCode for the window. coaCode can be null (intake
  // line that no SSOT layer + no AI tier could classify). Those rows
  // are excluded from the IS report — they show up as "미분류" in the
  // counterparty report and the operator is expected to fix the line.
  const raw = await prisma.$queryRawUnsafe<
    Array<{ coaCode: string | null; total_amount: unknown }>
  >(
    `SELECT "coaCode", SUM(total_amount) AS total_amount
      FROM "${ERP_MV_NAME}"
      WHERE "orgId" = $1 AND year = $2 ${monthFilter}
      GROUP BY "coaCode"`,
    opts.orgId,
    opts.year,
  );

  // coaCode → cents
  const cents = new Map<string, number>();
  for (const r of raw) {
    if (!r.coaCode) continue;
    cents.set(r.coaCode, (cents.get(r.coaCode) ?? 0) + numericToCents(r.total_amount));
  }

  // Pull ChartOfAccounts rows the COA codes the report actually touched.
  // Tenant-scoped (orgId), so we don't leak system seed across orgs.
  const codes = Array.from(cents.keys());
  const coaMap = new Map<
    string,
    { code: string; name: string; category: CoaCategory; parentCode: string | null }
  >();
  if (codes.length > 0) {
    const rows = await prisma.chartOfAccounts.findMany({
      where: { orgId: opts.orgId, code: { in: codes } },
      select: { code: true, name: true, category: true, parentCode: true },
    });
    for (const r of rows) {
      coaMap.set(r.code, {
        code: r.code,
        name: r.name,
        category: r.category as CoaCategory,
        parentCode: r.parentCode ?? null,
      });
    }
  }

  // Roll children into parents. If a child has a parentCode that's not
  // already in the COA pull (because no transactions hit it directly),
  // we still surface it as a "synthetic" parent so the tree renders;
  // we pull parents in one extra batch.
  const missingParents = Array.from(coaMap.values())
    .map((c) => c.parentCode)
    .filter(
      (p): p is string => p !== null && !coaMap.has(p) && !cents.has(p),
    );
  if (missingParents.length > 0) {
    const parents = await prisma.chartOfAccounts.findMany({
      where: { orgId: opts.orgId, code: { in: missingParents } },
      select: { code: true, name: true, category: true, parentCode: true },
    });
    for (const p of parents) {
      coaMap.set(p.code, {
        code: p.code,
        name: p.name,
        category: p.category as CoaCategory,
        parentCode: p.parentCode ?? null,
      });
    }
  }

  // Build tree per category.
  const categories: Record<CoaCategory, IncomeStatementCategory> = {
    REVENUE: { category: "REVENUE", total: "0.00", rows: [] },
    COGS: { category: "COGS", total: "0.00", rows: [] },
    OPEX: { category: "OPEX", total: "0.00", rows: [] },
    NON_OPERATING: { category: "NON_OPERATING", total: "0.00", rows: [] },
    OTHER: { category: "OTHER", total: "0.00", rows: [] },
  };

  const totals: Record<CoaCategory, number> = {
    REVENUE: 0,
    COGS: 0,
    OPEX: 0,
    NON_OPERATING: 0,
    OTHER: 0,
  };

  // Per-category: build map node by code, then attach children to parents.
  const byCategory = new Map<CoaCategory, Map<string, IncomeStatementNode>>();
  for (const cat of Object.keys(categories) as CoaCategory[]) {
    byCategory.set(cat, new Map());
  }

  for (const c of coaMap.values()) {
    const node: IncomeStatementNode = {
      code: c.code,
      name: c.name,
      category: c.category,
      parentCode: c.parentCode,
      total: "0.00",
      children: [],
    };
    byCategory.get(c.category)?.set(c.code, node);
  }

  // Inject leaf totals (codes that had transactions).
  for (const [code, value] of cents.entries()) {
    const meta = coaMap.get(code);
    if (!meta) continue; // orphan code — code exists in mv but not in COA (e.g. operator deleted it). Skip.
    const node = byCategory.get(meta.category)?.get(code);
    if (node) {
      node.total = centsToString(value);
      totals[meta.category] += value;
    }
  }

  // Assemble trees + roll up children into parent totals (one pass —
  // depth is bounded by the seed, max 2 today).
  for (const cat of Object.keys(categories) as CoaCategory[]) {
    const nodes = byCategory.get(cat)!;
    const roots: IncomeStatementNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentCode && nodes.has(node.parentCode)) {
        nodes.get(node.parentCode)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // Roll children into parent totals. Two passes suffice for depth 2;
    // for deeper trees a topological sort would be safer — we'd need to
    // visit children-first.
    const visit = (node: IncomeStatementNode): number => {
      let childCents = 0;
      for (const child of node.children) {
        childCents += visit(child);
      }
      const selfCents =
        node.total === "0.00"
          ? 0
          : numericToCents(node.total);
      const sum = selfCents + childCents;
      // Only override if children contributed — keeps the seeded total
      // intact when leaf rows were the only data.
      if (childCents > 0 && selfCents === 0) {
        node.total = centsToString(sum);
      } else if (childCents > 0) {
        // Both leaf-on-parent (operator coded a transaction directly to the
        // parent) and children totals exist — sum them. That matches the
        // operator's intent: the parent's leaf transactions PLUS its
        // children's transactions.
        node.total = centsToString(sum);
        totals[node.category] += childCents; // include children in category total
      }
      return sum;
    };
    for (const root of roots) {
      const total = visit(root);
      // If the root had no leaf and children rolled up, we already adjusted
      // node.total; but the category total counted leaves only. Add the
      // rolled-up children that weren't already counted.
      // (Simpler accounting: re-derive category total from roots after rollup.)
      void total;
    }
    // Re-derive category total from rolled-up roots.
    let catTotal = 0;
    for (const root of roots) {
      catTotal += numericToCents(root.total);
    }
    totals[cat] = catTotal;
    categories[cat].total = centsToString(catTotal);
    categories[cat].rows = roots;
  }

  // Operating income = REVENUE - COGS - OPEX
  const opIncomeCents = totals.REVENUE - totals.COGS - totals.OPEX;
  // Non-operating net is included in the seed as separate revenue / cost
  // codes (901/951 etc). The mv stores them with positive amounts in each
  // direction; the income statement treats "영업외수익" codes as +, "영업외비용"
  // codes as -. The COA seed encodes this via parentCode (900 vs 950)
  // but the category column is the same for both. For the simplified
  // report we use the convention: codes whose parentCode is 900 (or whose
  // own code starts with '9' and ends with revenue-side digits) are +;
  // 950-derived are -. Implementation: read parent code.
  let nonOpNet = 0;
  for (const root of categories.NON_OPERATING.rows) {
    nonOpNet += signedNonOperating(root);
  }
  const netIncomeCents = opIncomeCents + nonOpNet;

  // Freshness.
  const latestRefresh = await prisma.mvRefreshLog.findFirst({
    where: { viewName: ERP_MV_NAME },
    orderBy: { refreshedAt: "desc" },
    select: { refreshedAt: true },
  });

  return {
    year: opts.year,
    month: opts.month ?? null,
    categories,
    operatingIncome: centsToString(opIncomeCents),
    netIncome: centsToString(netIncomeCents),
    generatedAt: new Date().toISOString(),
    dataAsOf: latestRefresh ? latestRefresh.refreshedAt.toISOString() : null,
  };
}

/**
 * For a NON_OPERATING tree node, return its cents contribution to the
 * non-operating net total. By 국세청 seed convention:
 *   - parentCode 900 (or own code 900) → +revenue
 *   - parentCode 950 (or own code 950) → -expense
 * The "999 기타" category lives under OTHER, not NON_OPERATING, so it's
 * never reached here.
 */
function signedNonOperating(node: IncomeStatementNode): number {
  // Take the code's own parent (or self if it's a root with no parent).
  const anchor = node.parentCode ?? node.code;
  const isExpense = anchor.startsWith("95") || node.code.startsWith("95");
  const cents = numericToCents(node.total);
  return isExpense ? -cents : cents;
}

// =============================================================================
// Inventory turnover + dead-stock (WI-730).
// Reads InventoryMovement directly. No mv exists for this report — movement
// counts are bounded by product count × period length, which fits a single
// indexed scan via the existing `(orgId, productId, occurredAt)` index.
// =============================================================================

export interface InventoryTurnoverRow {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  /** Sum of qty across IN movements in the window. */
  totalIn: number;
  /** Sum of qty across OUT movements in the window. */
  totalOut: number;
  /** ISO timestamp of the latest movement, or null if none in the window. */
  lastMovementAt: string | null;
  /** Per-day OUT qty over the window — the "회전율" proxy operators look for. */
  turnoverPerDay: string; // fixed-4
  /** Number of distinct movement rows in the window (any direction). */
  movementCount: number;
}

export interface InventoryTurnoverOptions {
  orgId: string;
  /** Inclusive ISO date (YYYY-MM-DD). Defaults to (to - 90 days). */
  from?: string;
  /** Inclusive ISO date (YYYY-MM-DD). Defaults to today. */
  to?: string;
  /** Default 20. Caps at 100. */
  limit?: number;
}

/** Truncate a Date to YYYY-MM-DD in UTC (server-side report). */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD into Date at UTC midnight. */
function parseIsoDate(s: string): Date {
  // Strict — only accept YYYY-MM-DD; the caller already validated via Zod.
  return new Date(`${s}T00:00:00.000Z`);
}

function inclusiveEndOfDay(s: string): Date {
  return new Date(`${s}T23:59:59.999Z`);
}

export async function inventoryTurnoverReport(
  opts: InventoryTurnoverOptions,
): Promise<{
  from: string;
  to: string;
  rows: InventoryTurnoverRow[];
  generatedAt: string;
}> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const today = new Date();
  const toDate = opts.to ? parseIsoDate(opts.to) : today;
  const fromDate = opts.from
    ? parseIsoDate(opts.from)
    : new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (toDate < fromDate) {
    throw new Error("REPORT_BAD_RANGE: 'to' must be >= 'from'");
  }
  const fromStr = toIsoDate(fromDate);
  const toStr = toIsoDate(toDate);

  // Aggregate movements per product in the window. Using $queryRawUnsafe
  // because Prisma's groupBy doesn't express conditional sums cleanly,
  // and the source columns are simple enough that injection surface is
  // limited to the parameter slots.
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      productId: string;
      total_in: bigint | number | null;
      total_out: bigint | number | null;
      last_at: Date | null;
      movement_count: bigint | number;
    }>
  >(
    `SELECT
        "productId",
        SUM(CASE WHEN "type" = 'IN'  THEN "qty" ELSE 0 END) AS total_in,
        SUM(CASE WHEN "type" = 'OUT' THEN "qty" ELSE 0 END) AS total_out,
        MAX("occurredAt")  AS last_at,
        COUNT(*)           AS movement_count
      FROM "InventoryMovement"
      WHERE "orgId" = $1
        AND "occurredAt" BETWEEN $2 AND $3
      GROUP BY "productId"`,
    opts.orgId,
    fromDate,
    inclusiveEndOfDay(toStr),
  );

  if (rows.length === 0) {
    return {
      from: fromStr,
      to: toStr,
      rows: [],
      generatedAt: new Date().toISOString(),
    };
  }

  // Hydrate product info in one batch (orgId-scoped).
  const products = await prisma.product.findMany({
    where: { orgId: opts.orgId, id: { in: rows.map((r) => r.productId) } },
    select: { id: true, name: true, sku: true, unit: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const periodDays = Math.max(
    1,
    Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  const result: InventoryTurnoverRow[] = rows
    .map((r) => {
      const product = productMap.get(r.productId);
      if (!product) return null; // archived/deleted — drop
      const totalIn = Number(r.total_in ?? 0);
      const totalOut = Number(r.total_out ?? 0);
      const movementCount = Number(r.movement_count);
      const turnoverPerDay = totalOut / periodDays;
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        totalIn,
        totalOut,
        lastMovementAt: r.last_at ? r.last_at.toISOString() : null,
        turnoverPerDay: turnoverPerDay.toFixed(4),
        movementCount,
      } satisfies InventoryTurnoverRow;
    })
    .filter((r): r is InventoryTurnoverRow => r !== null)
    .sort(
      (a, b) =>
        // Prefer higher OUT/day; ties → larger absolute OUT volume.
        Number(b.turnoverPerDay) - Number(a.turnoverPerDay) ||
        b.totalOut - a.totalOut,
    )
    .slice(0, limit);

  return {
    from: fromStr,
    to: toStr,
    rows: result,
    generatedAt: new Date().toISOString(),
  };
}

export interface DeadStockRow {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  unitPrice: string;
  /** ISO timestamp of the most recent OUT movement, or null if never. */
  lastOutAt: string | null;
  /** Whole days since lastOutAt, or null if never moved. */
  daysSinceLastOut: number | null;
}

export interface DeadStockOptions {
  orgId: string;
  /** A product with no OUT movement in the last `days` days qualifies.
   *  Defaults to 60 (mid-tier 30/60/90 from design). */
  days?: number;
  /** Default 50. Caps at 200. */
  limit?: number;
}

/**
 * Products that have NOT moved out in the last `days` days. Implementation
 * is two indexed scans:
 *   1. Pull all OUT movements per product, latest first, restricted to
 *      orgId. We aggregate `MAX(occurredAt) WHERE type=OUT GROUP BY productId`.
 *   2. Pull all non-archived products for the org and left-join the OUT map.
 *      A product is dead-stock when:
 *      - lastOutAt is null (RED AC #4: never moved → dead-stock candidate), OR
 *      - lastOutAt < (now - days days)
 *
 * Sorted by inactivity duration desc (oldest dead first).
 */
export async function deadStockReport(
  opts: DeadStockOptions,
): Promise<{
  thresholdDays: number;
  cutoffAt: string;
  rows: DeadStockRow[];
  generatedAt: string;
}> {
  const days = Math.max(1, Math.min(opts.days ?? 60, 365));
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Latest OUT per product.
  const lastOuts = await prisma.$queryRawUnsafe<
    Array<{ productId: string; last_out: Date | null }>
  >(
    `SELECT "productId", MAX("occurredAt") AS last_out
      FROM "InventoryMovement"
      WHERE "orgId" = $1 AND "type" = 'OUT'
      GROUP BY "productId"`,
    opts.orgId,
  );
  const lastOutMap = new Map<string, Date>();
  for (const r of lastOuts) {
    if (r.last_out) lastOutMap.set(r.productId, r.last_out);
  }

  // All non-archived products for the org.
  const products = await prisma.product.findMany({
    where: { orgId: opts.orgId, archived: false },
    select: { id: true, name: true, sku: true, unit: true, unitPrice: true },
  });

  const rows: DeadStockRow[] = [];
  for (const p of products) {
    const lastOut = lastOutMap.get(p.id) ?? null;
    if (lastOut && lastOut >= cutoff) continue; // recent OUT → not dead
    const daysSince =
      lastOut === null
        ? null
        : Math.floor(
            (Date.now() - lastOut.getTime()) / (24 * 60 * 60 * 1000),
          );
    rows.push({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      unit: p.unit,
      unitPrice: decimalToString(p.unitPrice as never),
      lastOutAt: lastOut ? lastOut.toISOString() : null,
      daysSinceLastOut: daysSince,
    });
  }

  // Sort: never-moved first (oldest dead), then by daysSince desc.
  rows.sort((a, b) => {
    if (a.daysSinceLastOut === null && b.daysSinceLastOut === null) return 0;
    if (a.daysSinceLastOut === null) return -1;
    if (b.daysSinceLastOut === null) return 1;
    return b.daysSinceLastOut - a.daysSinceLastOut;
  });

  return {
    thresholdDays: days,
    cutoffAt: cutoff.toISOString(),
    rows: rows.slice(0, limit),
    generatedAt: new Date().toISOString(),
  };
}
