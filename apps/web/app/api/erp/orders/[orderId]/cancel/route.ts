/**
 * /api/erp/orders/[orderId]/cancel
 *
 *  POST — Cancel a CONFIRMED order.
 *
 *  Effect (single atomic $transaction):
 *    1. Atomic conditional flip of order.status from CONFIRMED → CANCELLED
 *       via `updateMany({ where: { id, orgId, status: "CONFIRMED" } })`.
 *       Returning `count === 0` means the row does not satisfy the predicate;
 *       a follow-up `findFirst` disambiguates between 404 (wrong tenant /
 *       missing id) and 409 (wrong status).
 *    2. For every original InventoryMovement that this order created
 *       (source=ORDER, sourceId=orderId, NOT already a reversal), create a
 *       reverse movement with:
 *         - type:     opposite (IN→OUT, OUT→IN, ADJUST→ADJUST stays)
 *         - qty:      identical magnitude
 *         - source:   ORDER
 *         - sourceId: this orderId
 *         - unitCost: copied from original
 *         - note:     "[취소] 원본 {origId}" — marks the row as a reversal
 *                     so subsequent cancels won't see it as "original".
 *
 *  Concurrency contract:
 *    - Under READ COMMITTED isolation (Postgres default), the previous
 *      find-then-update sequence let two concurrent POSTs both pass the
 *      status check and both write reversal sets. Using `updateMany` with
 *      the status predicate pushes the check into a single SQL statement;
 *      Postgres row-level locks guarantee at most one caller observes
 *      count===1 and the other observes count===0.
 *
 *  Idempotency contract:
 *    - Double-cancel: a CANCELLED order returns 409 and writes NO new
 *      movements. The reversal set therefore stays at exactly one set per
 *      cancel attempt (tested in orders-cancel.test.ts).
 *    - DRAFT cancel: 409 (uncommitted orders have no movements to reverse;
 *      they should be deleted instead, which is out of scope for this WI).
 *
 *  We exclude reversal rows when selecting "originals" by filtering on
 *  `note` not starting with the "[취소]" marker. This is a defense in
 *  depth: the conditional flip above already prevents a second cancel from
 *  ever reaching this code path, but the filter keeps the invariant robust
 *  against any future status manipulation.
 */

import { prisma } from "@axle/db";
import { MovementType } from "@prisma/client";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  ErpConflictError,
  ErpNotFoundError,
} from "@/lib/erp/auth";
import { serializeOrder } from "@/lib/erp/serialize";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

function reverseType(type: MovementType): MovementType {
  if (type === "IN") return "OUT";
  if (type === "OUT") return "IN";
  // ADJUST is its own inverse — qty stays positive; semantic flip is
  // caller-defined. We still emit a row so the audit trail records that
  // a reversal occurred.
  return "ADJUST";
}

export async function POST(_req: Request, context: RouteContext): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { orderId } = await context.params;
    if (!orderId) {
      return erpBadRequest("orderId is required");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Atomic conditional flip — the status predicate is part of the
      //    UPDATE statement so concurrent callers cannot both succeed.
      const flip = await tx.order.updateMany({
        where: { id: orderId, orgId: ctx.orgId, status: "CONFIRMED" },
        data: { status: "CANCELLED" },
      });
      if (flip.count === 0) {
        // Disambiguate: 404 (wrong tenant / missing id) vs 409 (wrong status).
        const existing = await tx.order.findFirst({
          where: { id: orderId, orgId: ctx.orgId },
          select: { status: true },
        });
        if (!existing) {
          throw new ErpNotFoundError("Order not found");
        }
        if (existing.status === "CANCELLED") {
          throw new ErpConflictError("Order already cancelled");
        }
        throw new ErpConflictError(
          `Cannot cancel order in status ${existing.status}`,
        );
      }

      // 2. Find original movements created by this order. Exclude rows that
      //    are already reversals (note starts with the "[취소]" marker).
      const originals = await tx.inventoryMovement.findMany({
        where: {
          orgId: ctx.orgId,
          source: "ORDER",
          sourceId: orderId,
          NOT: { note: { startsWith: "[취소]" } },
        },
      });

      const now = new Date();
      for (const orig of originals) {
        await tx.inventoryMovement.create({
          data: {
            orgId: ctx.orgId,
            productId: orig.productId,
            type: reverseType(orig.type),
            qty: orig.qty,
            source: "ORDER",
            sourceId: orderId,
            unitCost: orig.unitCost,
            note: `[취소] 원본 ${orig.id}`,
            occurredAt: now,
          },
        });
      }

      // 3. Re-fetch the updated row for the response.
      const next = await tx.order.findFirst({
        where: { id: orderId, orgId: ctx.orgId },
        include: { items: true },
      });
      if (!next) {
        // Should be unreachable: we just successfully updated this row inside
        // the same transaction. Surface as an internal error so we notice if
        // it ever fires (would indicate schema drift or a corrupted tx).
        throw new Error("Order vanished after update");
      }
      return next;
    });

    return Response.json(serializeOrder(updated));
  } catch (err) {
    return toResponse(err);
  }
}
