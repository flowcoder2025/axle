/**
 * /api/erp/inventory
 *
 *  GET — Inventory movement timeline + current stock summary for a single
 *        product within the active tenant.
 *
 *  Query params:
 *    productId  (required) — Product to inspect. Must belong to the active
 *                            tenant; otherwise 404.
 *    from       (optional) — ISO date. Lower bound on `occurredAt` (inclusive).
 *    to         (optional) — ISO date. Upper bound on `occurredAt` (inclusive).
 *    type       (optional) — IN | OUT | ADJUST. Filters movements by type.
 *
 *  Response shape:
 *    {
 *      movements: SerializedInventoryMovement[], // desc by occurredAt, max 500
 *      stock: {
 *        in: number,      // sum of qty for type=IN
 *        out: number,     // sum of qty for type=OUT
 *        adjust: number,  // sum of qty for type=ADJUST (kept separate)
 *        balance: number, // in - out (ADJUST not folded in — its semantics
 *                         //          are caller-defined; we surface it raw)
 *      }
 *    }
 *
 *  Stock totals are computed over ALL movements for the product (no period
 *  filter) so the dashboard summary stays meaningful regardless of the
 *  timeline window the user is inspecting. Filters apply to `movements`
 *  only.
 */

import { prisma } from "@axle/db";
import { Prisma, MovementType } from "@prisma/client";
import { requireErpScope, toResponse } from "@/lib/erp/auth";
import { serializeInventoryMovement } from "@/lib/erp/serialize";

const MAX_MOVEMENTS = 500;

const VALID_TYPES = new Set<string>(["IN", "OUT", "ADJUST"]);

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId")?.trim();
    if (!productId) {
      return new Response("productId is required", { status: 400 });
    }

    // Verify the product belongs to the active tenant before fetching
    // movements — prevents disclosing existence of cross-tenant products
    // through a 200-with-empty-list signal.
    const product = await prisma.product.findFirst({
      where: { id: productId, orgId: ctx.orgId },
      select: { id: true },
    });
    if (!product) {
      return new Response("Not found", { status: 404 });
    }

    const from = parseDateParam(url.searchParams.get("from"));
    const to = parseDateParam(url.searchParams.get("to"));
    const typeRaw = url.searchParams.get("type");
    const type = typeRaw && VALID_TYPES.has(typeRaw) ? (typeRaw as MovementType) : undefined;

    const occurredAtFilter: Prisma.DateTimeFilter | undefined =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const movementsWhere: Prisma.InventoryMovementWhereInput = {
      orgId: ctx.orgId,
      productId,
      ...(occurredAtFilter ? { occurredAt: occurredAtFilter } : {}),
      ...(type ? { type } : {}),
    };

    const stockWhere: Prisma.InventoryMovementWhereInput = {
      orgId: ctx.orgId,
      productId,
    };

    const [movements, stockGroups] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where: movementsWhere,
        orderBy: { occurredAt: "desc" },
        take: MAX_MOVEMENTS,
      }),
      prisma.inventoryMovement.groupBy({
        by: ["type"],
        where: stockWhere,
        _sum: { qty: true },
      }),
    ]);

    const stockByType: Record<string, number> = { IN: 0, OUT: 0, ADJUST: 0 };
    for (const g of stockGroups) {
      stockByType[g.type] = g._sum.qty ?? 0;
    }
    const stock = {
      in: stockByType.IN,
      out: stockByType.OUT,
      adjust: stockByType.ADJUST,
      balance: stockByType.IN - stockByType.OUT,
    };

    return Response.json({
      movements: movements.map(serializeInventoryMovement),
      stock,
    });
  } catch (err) {
    return toResponse(err);
  }
}
