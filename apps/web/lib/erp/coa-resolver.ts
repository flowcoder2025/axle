/**
 * COA SSOT resolver (Phase 21 WI-726).
 *
 * Every OrderItem write path collapses the three coaCode sources defined
 * in design §3.2 into the single `OrderItem.coaCode` column. Reports
 * (WI-728/729/730) then scan a flat column instead of computing the
 * priority chain at query time:
 *
 *     OrderItem.coaCode          (line-level override, explicitly set)
 *   > Product.coaCode            (product-level default)
 *   > ErpCounterparty.defaultCoaCode
 *
 * If all three are null, the resolver returns null. Reports surface
 * those rows as "미분류" rather than rejecting the write — keeping the
 * intake/confirm flow tolerant of incomplete COA assignments while
 * incentivizing operators to fill them in.
 */

export interface ResolveCoaCodeInput {
  /** Explicit override at the OrderItem level. Wins if non-null. */
  orderItemCoaCode?: string | null;
  /** Default carried on the Product master. */
  productCoaCode?: string | null;
  /** Last-resort fallback from the counterparty. */
  counterpartyDefaultCoaCode?: string | null;
}

export type CoaSource = "orderItem" | "product" | "counterparty" | null;

export interface ResolveCoaCodeResult {
  coaCode: string | null;
  /** Which layer of the SSOT supplied the value (audit trail). */
  source: CoaSource;
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Pick the first non-null coaCode in the SSOT priority order. Empty
 * strings count as null so a caller that accidentally passes "" doesn't
 * silently override the layer below.
 *
 * Pure / deterministic — no DB calls, no side effects. Safe to call
 * inside a Prisma `$transaction` for every line of an intake confirm.
 */
export function resolveCoaCode(input: ResolveCoaCodeInput): ResolveCoaCodeResult {
  const item = nonEmpty(input.orderItemCoaCode);
  if (item) return { coaCode: item, source: "orderItem" };

  const product = nonEmpty(input.productCoaCode);
  if (product) return { coaCode: product, source: "product" };

  const counterparty = nonEmpty(input.counterpartyDefaultCoaCode);
  if (counterparty) return { coaCode: counterparty, source: "counterparty" };

  return { coaCode: null, source: null };
}
