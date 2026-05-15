/**
 * Shared inventory query logic for `/api/erp/inventory` and `/erp/inventory`.
 *
 * Both the API route and the Server Component page need the same filter +
 * groupBy + balance computation. Centralizing here prevents drift (e.g. the
 * page surfacing `truncated` but the API not, or one applying end-of-day
 * inclusive `to` and the other not).
 *
 * Stock totals are computed over ALL movements for the product (no period
 * filter applied) so the dashboard summary stays meaningful regardless of
 * the timeline window the caller is inspecting. Filters apply to
 * `movements` only.
 *
 * Date handling — `from` and `to` accept either:
 *   - a bare ISO date `YYYY-MM-DD` (no time component): expanded to
 *     start-of-day (00:00:00.000) for `from`, end-of-day (23:59:59.999) for
 *     `to`. This makes URL filters like `?to=2026-04-30` inclusive of all
 *     April 30 records, which is what users expect from a date picker.
 *   - a full ISO datetime: used as-is.
 *
 * Ownership — `fetchInventoryView` verifies the product belongs to the
 * supplied `orgId` and throws {@link ErpNotFoundError} when it doesn't.
 * Callers must already have resolved the active tenant (e.g. via
 * `requireErpScope`).
 */

import { Prisma, MovementType } from "@prisma/client";
import { prisma } from "@axle/db";
import { ErpNotFoundError } from "@/lib/erp/auth";
import { serializeInventoryMovement } from "@/lib/erp/serialize";

/** Maximum number of movement rows returned in a single view. */
export const INVENTORY_MOVEMENT_LIMIT = 500;

/** Bare date (`YYYY-MM-DD`) pattern, used to distinguish from full datetimes. */
const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface InventoryViewParams {
  productId: string;
  from?: Date;
  to?: Date;
  type?: MovementType;
}

export interface InventoryStock {
  in: number;
  out: number;
  adjust: number;
  /** `in - out` — ADJUST is surfaced separately, not folded in. */
  balance: number;
}

export interface InventoryView {
  movements: ReturnType<typeof serializeInventoryMovement>[];
  stock: InventoryStock;
  /** True when the movements list was capped at {@link INVENTORY_MOVEMENT_LIMIT}. */
  truncated: boolean;
}

/**
 * Parse a date-or-datetime query param. Bare dates are expanded to the
 * appropriate endpoint of the day so range filters are inclusive.
 *
 * @param raw  the raw string from `URLSearchParams.get`.
 * @param edge `"start"` for `from` (00:00:00.000) or `"end"` for `to`
 *             (23:59:59.999). Ignored when `raw` is a full datetime.
 * @returns parsed `Date` or `undefined` when `raw` is empty/invalid.
 */
export function parseInventoryDateParam(
  raw: string | null | undefined,
  edge: "start" | "end",
): Date | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (BARE_DATE_RE.test(trimmed)) {
    const suffix = edge === "end" ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const d = new Date(`${trimmed}${suffix}`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Fetch the inventory view (movements + stock + truncation flag) for a
 * single product within an org. The caller must have already verified scope.
 *
 * @throws {ErpNotFoundError} when the product does not belong to `orgId`.
 */
export async function fetchInventoryView(
  orgId: string,
  params: InventoryViewParams,
): Promise<InventoryView> {
  const { productId, from, to, type } = params;

  // Verify the product belongs to the active tenant before fetching
  // movements — prevents disclosing existence of cross-tenant products
  // through a 200-with-empty-list signal.
  const product = await prisma.product.findFirst({
    where: { id: productId, orgId },
    select: { id: true },
  });
  if (!product) {
    throw new ErpNotFoundError("Product not found");
  }

  const occurredAtFilter: Prisma.DateTimeFilter | undefined =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const movementsWhere: Prisma.InventoryMovementWhereInput = {
    orgId,
    productId,
    ...(occurredAtFilter ? { occurredAt: occurredAtFilter } : {}),
    ...(type ? { type } : {}),
  };

  const stockWhere: Prisma.InventoryMovementWhereInput = {
    orgId,
    productId,
  };

  const [rows, stockGroups] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: movementsWhere,
      orderBy: { occurredAt: "desc" },
      take: INVENTORY_MOVEMENT_LIMIT,
    }),
    prisma.inventoryMovement.groupBy({
      by: ["type"],
      where: stockWhere,
      _sum: { qty: true },
    }),
  ]);

  const byType: Record<string, number> = { IN: 0, OUT: 0, ADJUST: 0 };
  for (const g of stockGroups) {
    byType[g.type] = g._sum.qty ?? 0;
  }
  const stock: InventoryStock = {
    in: byType.IN,
    out: byType.OUT,
    adjust: byType.ADJUST,
    balance: byType.IN - byType.OUT,
  };

  return {
    movements: rows.map(serializeInventoryMovement),
    stock,
    truncated: rows.length === INVENTORY_MOVEMENT_LIMIT,
  };
}
