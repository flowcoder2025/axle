/**
 * /api/erp/intake/[draftId]/confirm
 *
 *   POST — Finalize an IntakeDraft into a real Order (CONFIRMED) + OrderItem
 *          rows + InventoryMovement rows. Optionally upserts new Products
 *          for items the user chose to register.
 *
 *  Idempotency contract (spec §6.2):
 *    - The first step of the transaction is an atomic PENDING → CONFIRMED
 *      transition via `updateMany` (Prisma 7: `update.where` accepts only
 *      @unique fields). If `count === 0` the draft is already CONFIRMED,
 *      already DISCARDED, or in another tenant — we throw a sentinel error
 *      and abort the transaction. No Order/Item/Movement rows are written.
 *    - As a secondary defense, `IntakeDraft.confirmedOrderId` is
 *      `@@unique`. Two confirms that somehow race past step 1 would collide
 *      on this constraint when the second tries to write the same draftId
 *      with a different order.id (the second insert from step 1 would fail
 *      P2002 — but the lock above already prevents this).
 *
 *  Product upsert + dedup (spec §6.2, M3 review fix):
 *    - Items with `productId` are linked directly; no upsert.
 *    - Items with `shouldRegister=false` are left as ad-hoc (no Movement).
 *    - Items with `shouldRegister=true`:
 *        - keyed by sku (when present) or `name:<lower(productName)>`
 *        - same key within a single draft → reuse the previously upserted
 *          product (prevents "콜라" twice → 2 Products)
 *        - sku present → upsert on `orgId_sku` unique (restores archived=false)
 *        - sku absent → findFirst by name, else create
 *
 *  InventoryMovement direction:
 *    - SALE  → OUT (goods leave inventory)
 *    - PURCHASE → IN
 *    Only items with a resolved productId emit a movement (ad-hoc items
 *    don't move tracked inventory).
 */

import { prisma } from "@axle/db";
import { z } from "zod";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  erpErrorResponse,
  ErpConflictError,
  ErpNotFoundError,
} from "@/lib/erp/auth";
import {
  resolveOrCreateCounterparty,
  CounterpartyResolutionError,
} from "@/lib/erp/counterparty-resolver";

interface RouteContext {
  params: Promise<{ draftId: string }>;
}

class IntakeAlreadyConfirmedError extends Error {
  constructor() {
    super("Already confirmed");
    this.name = "IntakeAlreadyConfirmedError";
  }
}

const ConfirmBody = z.object({
  type: z.enum(["SALE", "PURCHASE"]),
  counterpartyName: z.string().min(1),
  /** Optional. When supplied the resolver verifies tenant ownership.
   *  When omitted the resolver matches by bizRegNo / normalizedName or
   *  creates a new ErpCounterparty so the FK (VALID since WI-723c) holds. */
  counterpartyId: z.string().nullable().optional(),
  /** Optional canonical/dashed business registration number — improves
   *  match quality and avoids creating duplicate masters. */
  counterpartyBizRegNo: z.string().nullable().optional(),
  occurredAt: z.coerce.date(),
  total: z.coerce.number().nonnegative(),
  tax: z.coerce.number().nonnegative().default(0),
  note: z.string().nullable().optional(),
  autoRegisterProducts: z.boolean().default(true),
  items: z
    .array(
      z.object({
        productId: z.string().nullable().optional(),
        productName: z.string().min(1),
        sku: z.string().nullable().optional(),
        qty: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().nonnegative(),
        unit: z.string().min(1).default("개"),
        shouldRegister: z.boolean().default(true),
      }),
    )
    .min(1),
});

export async function POST(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { draftId } = await context.params;
    if (!draftId) {
      return erpBadRequest("draftId is required");
    }

    const body = ConfirmBody.parse(await req.json());

    const order = await prisma.$transaction(async (tx) => {
      // 1. Atomic PENDING → CONFIRMED lock. updateMany returns count.
      const lock = await tx.intakeDraft.updateMany({
        where: { id: draftId, status: "PENDING", orgId: ctx.orgId },
        data: { status: "CONFIRMED" },
      });
      if (lock.count === 0) {
        throw new IntakeAlreadyConfirmedError();
      }

      // 1b. Resolve or create the ErpCounterparty master (WI-723c).
      //     The FK is VALID — Order.counterpartyId may no longer be null.
      const cpResolution = await resolveOrCreateCounterparty(tx, {
        orgId: ctx.orgId,
        counterpartyId: body.counterpartyId ?? null,
        counterpartyName: body.counterpartyName,
        bizRegNo: body.counterpartyBizRegNo ?? null,
        type: body.type === "SALE" ? "CUSTOMER" : "SUPPLIER",
      });

      // 2. Resolve / upsert products for items that need it, with dedup
      //    keyed by sku or lowercased name. Resolved productId is recorded
      //    on a local map keyed by item index — we never mutate the body
      //    because the items array is the source of truth for shape.
      const resolvedProductId: (string | null)[] = body.items.map(
        (it) => it.productId ?? null,
      );
      const productByKey = new Map<string, { id: string }>();

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        if (item.productId) continue;
        if (!item.shouldRegister) continue;

        const key = item.sku
          ? `sku:${item.sku}`
          : `name:${item.productName.toLowerCase()}`;

        const cached = productByKey.get(key);
        if (cached) {
          resolvedProductId[i] = cached.id;
          continue;
        }

        let product: { id: string };
        if (item.sku) {
          product = await tx.product.upsert({
            where: { orgId_sku: { orgId: ctx.orgId, sku: item.sku } },
            update: { archived: false },
            create: {
              orgId: ctx.orgId,
              sku: item.sku,
              name: item.productName,
              unit: item.unit,
              unitPrice: item.unitPrice,
            },
          });
        } else {
          const existing = await tx.product.findFirst({
            where: {
              orgId: ctx.orgId,
              name: item.productName,
              archived: false,
            },
          });
          product = existing
            ? existing
            : await tx.product.create({
                data: {
                  orgId: ctx.orgId,
                  name: item.productName,
                  unit: item.unit,
                  unitPrice: item.unitPrice,
                },
              });
        }
        productByKey.set(key, { id: product.id });
        resolvedProductId[i] = product.id;
      }

      // 3. Order + nested items (single create — items.create runs in the
      //    same tx and the resulting items inherit orderId).
      const created = await tx.order.create({
        data: {
          orgId: ctx.orgId,
          type: body.type,
          // WI-723c: counterpartyId is now always set (FK is VALID).
          // counterpartyName is preserved verbatim as the historical snapshot.
          counterpartyId: cpResolution.counterpartyId,
          counterpartyName: body.counterpartyName,
          status: "CONFIRMED",
          total: body.total,
          tax: body.tax,
          occurredAt: body.occurredAt,
          source: "RECEIPT_INTAKE",
          sourceId: draftId,
          note: body.note ?? null,
          items: {
            create: body.items.map((it, i) => ({
              productId: resolvedProductId[i] ?? null,
              productName: it.productName,
              qty: it.qty,
              unitPrice: it.unitPrice,
              lineTotal: it.qty * it.unitPrice,
            })),
          },
        },
      });

      // 4. InventoryMovement per item with a resolved productId.
      const movementType = body.type === "SALE" ? "OUT" : "IN";
      for (let i = 0; i < body.items.length; i++) {
        const pid = resolvedProductId[i];
        if (!pid) continue;
        const item = body.items[i];
        await tx.inventoryMovement.create({
          data: {
            orgId: ctx.orgId,
            productId: pid,
            type: movementType,
            qty: item.qty,
            unitCost: item.unitPrice,
            source: "ORDER",
            sourceId: created.id,
            occurredAt: body.occurredAt,
          },
        });
      }

      // 5. Mark the draft → order link. @@unique([confirmedOrderId]) is the
      //    secondary defense against double-confirm.
      await tx.intakeDraft.update({
        where: { id: draftId },
        data: { confirmedOrderId: created.id },
      });

      return created;
    });

    return Response.json({ orderId: order.id }, { status: 200 });
  } catch (err) {
    if (err instanceof IntakeAlreadyConfirmedError) {
      return toResponse(new ErpConflictError("Already confirmed"));
    }
    if (err instanceof CounterpartyResolutionError) {
      // COUNTERPARTY_NOT_IN_TENANT → 404, NAME_REQUIRED → 400.
      if (err.code === "COUNTERPARTY_NOT_IN_TENANT") {
        return toResponse(new ErpNotFoundError(err.message));
      }
      return erpErrorResponse(400, err.code, err.message);
    }
    return toResponse(err);
  }
}
