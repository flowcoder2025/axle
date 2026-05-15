/**
 * /api/erp/orders/[orderId]/cancel
 *
 *  POST — Cancel a CONFIRMED order.
 *
 *  Effect (single atomic $transaction):
 *    1. Set order.status = CANCELLED.
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
 *  Idempotency contract:
 *    - Double-cancel: a CANCELLED order returns 409 and writes NO new
 *      movements. The reversal set therefore stays at exactly one set per
 *      cancel attempt (tested in orders-cancel.test.ts).
 *    - DRAFT cancel: 409 (uncommitted orders have no movements to reverse;
 *      they should be deleted instead, which is out of scope for this WI).
 *
 *  We exclude reversal rows when selecting "originals" by filtering on
 *  `note` not starting with the "[취소]" marker. This is a defense in
 *  depth: the status guard above already prevents a second cancel from
 *  ever reaching this code path, but the filter keeps the invariant
 *  robust against any future status manipulation.
 */

import { prisma } from "@axle/db";
import { MovementType } from "@prisma/client";
import {
  requireErpScope,
  toResponse,
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
      return new Response("orderId is required", { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, orgId: ctx.orgId },
        include: { items: true },
      });
      if (!order) {
        throw new ErpNotFoundError("Order not found");
      }
      if (order.status === "CANCELLED") {
        throw new ErpConflictError("Order already cancelled");
      }
      if (order.status !== "CONFIRMED") {
        throw new ErpConflictError(
          `Cannot cancel order in status ${order.status}`,
        );
      }

      // Flip status first so concurrent callers racing this transaction will
      // see CANCELLED on retry (Prisma's interactive $transaction wraps a
      // PostgreSQL transaction; subsequent reads in the SAME tx see the new
      // status).
      const next = await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
        include: { items: true },
      });

      // Find original movements created by this order. Exclude rows that
      // are already reversals (note starts with the "[취소]" marker).
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

      return next;
    });

    return Response.json(serializeOrder(updated));
  } catch (err) {
    return toResponse(err);
  }
}
