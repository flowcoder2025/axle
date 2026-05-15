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

import { MovementType } from "@prisma/client";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  ErpNotFoundError,
} from "@/lib/erp/auth";
import {
  fetchInventoryView,
  INVENTORY_MOVEMENT_LIMIT,
  parseInventoryDateParam,
} from "@/lib/erp/inventory";

const VALID_TYPES = new Set<string>(["IN", "OUT", "ADJUST"]);

export const INVENTORY_MAX_MOVEMENTS = INVENTORY_MOVEMENT_LIMIT;

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId")?.trim();
    if (!productId) {
      return erpBadRequest("productId is required");
    }

    const from = parseInventoryDateParam(url.searchParams.get("from"), "start");
    const to = parseInventoryDateParam(url.searchParams.get("to"), "end");
    const typeRaw = url.searchParams.get("type");
    const type =
      typeRaw && VALID_TYPES.has(typeRaw) ? (typeRaw as MovementType) : undefined;

    let view;
    try {
      view = await fetchInventoryView(ctx.orgId, { productId, from, to, type });
    } catch (err) {
      if (err instanceof ErpNotFoundError) {
        return toResponse(err);
      }
      throw err;
    }

    return Response.json({
      movements: view.movements,
      stock: view.stock,
      truncated: view.truncated,
    });
  } catch (err) {
    return toResponse(err);
  }
}
