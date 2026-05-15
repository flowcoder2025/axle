/**
 * /api/erp/products
 *
 *  GET  — List products for the active tenant (Multi-org aware). Query params:
 *         `q` (substring, case-insensitive over name), `includeArchived=1`.
 *  POST — Create a product. Requires `erp:write` scope.
 *
 * All errors flow through {@link toResponse} which maps ErpAuthError → 401/403,
 * ZodError → 400, and anything else → 500.
 */

import { prisma } from "@axle/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireErpScope, toResponse } from "@/lib/erp/auth";
import { serializeProduct } from "@/lib/erp/serialize";

const MAX_LIST = 200;

const CreateBody = z.object({
  sku: z.string().trim().max(100).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20),
  unitPrice: z.coerce.number().nonnegative().optional(),
  category: z.string().trim().max(100).nullable().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const includeArchived = url.searchParams.get("includeArchived") === "1";

    const where: Prisma.ProductWhereInput = {
      orgId: ctx.orgId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(includeArchived ? {} : { archived: false }),
    };

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      take: MAX_LIST,
    });

    return Response.json({ items: products.map(serializeProduct) });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = CreateBody.parse(raw);

    const data: Prisma.ProductCreateInput = {
      orgId: ctx.orgId,
      name: body.name,
      unit: body.unit,
      sku: body.sku ?? null,
      category: body.category ?? null,
      ...(body.unitPrice !== undefined ? { unitPrice: body.unitPrice } : {}),
    };

    const created = await prisma.product.create({ data });
    return Response.json(serializeProduct(created), { status: 201 });
  } catch (err) {
    return toResponse(err);
  }
}
