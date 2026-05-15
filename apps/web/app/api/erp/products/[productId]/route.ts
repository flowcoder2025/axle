/**
 * /api/erp/products/[productId]
 *
 *  GET    — Fetch a single product (active tenant scoped).
 *  PATCH  — Partial update. Requires `erp:write`.
 *  DELETE — Soft delete (sets `archived = true`). Requires `erp:write`.
 *           Hard delete is intentionally not exposed — InventoryMovement /
 *           OrderItem refer to products and would dangle. Soft delete keeps
 *           history intact and hides the row from default lists.
 */

import { prisma } from "@axle/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireErpScope, toResponse } from "@/lib/erp/auth";
import { serializeProduct } from "@/lib/erp/serialize";

const PatchBody = z.object({
  sku: z.string().trim().max(100).nullable().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  archived: z.boolean().optional(),
});

type Params = { params: Promise<{ productId: string }> };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const { productId } = await params;

    const product = await prisma.product.findFirst({
      where: { id: productId, orgId: ctx.orgId },
    });
    if (!product) {
      return new Response("Not found", { status: 404 });
    }
    return Response.json(serializeProduct(product));
  } catch (err) {
    return toResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { productId } = await params;
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = PatchBody.parse(raw);

    // Ensure the row belongs to the active tenant before updating.
    const existing = await prisma.product.findFirst({
      where: { id: productId, orgId: ctx.orgId },
      select: { id: true },
    });
    if (!existing) {
      return new Response("Not found", { status: 404 });
    }

    const data: Prisma.ProductUpdateInput = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.sku !== undefined ? { sku: body.sku } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.unitPrice !== undefined ? { unitPrice: body.unitPrice } : {}),
      ...(body.archived !== undefined ? { archived: body.archived } : {}),
    };

    const updated = await prisma.product.update({
      where: { id: productId },
      data,
    });
    return Response.json(serializeProduct(updated));
  } catch (err) {
    return toResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { productId } = await params;

    const existing = await prisma.product.findFirst({
      where: { id: productId, orgId: ctx.orgId },
      select: { id: true },
    });
    if (!existing) {
      return new Response("Not found", { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { archived: true },
    });
    return Response.json(serializeProduct(updated));
  } catch (err) {
    return toResponse(err);
  }
}

