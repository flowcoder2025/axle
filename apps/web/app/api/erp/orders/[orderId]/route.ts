/**
 * /api/erp/orders/[orderId]
 *
 *  GET — Order detail (with items + product snapshot).
 *
 *  Scoped to the active tenant — cross-tenant ids return 404 (intentionally
 *  indistinguishable from a missing id so we don't leak existence).
 *
 *  Response: SerializedOrder with `items` hydrated.
 */

import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  ErpNotFoundError,
} from "@/lib/erp/auth";
import { serializeOrder } from "@/lib/erp/serialize";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function GET(_req: Request, context: RouteContext): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const { orderId } = await context.params;
    if (!orderId) {
      return erpBadRequest("orderId is required");
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId: ctx.orgId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!order) {
      throw new ErpNotFoundError("Order not found");
    }

    return Response.json(serializeOrder(order));
  } catch (err) {
    return toResponse(err);
  }
}
