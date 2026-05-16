/**
 * /api/erp/counterparties (Phase 21 WI-722)
 *
 *  GET  — List ErpCounterparty for the active tenant. Query params:
 *         `q` (substring over normalizedName, case-insensitive),
 *         `type` (CUSTOMER | SUPPLIER | BOTH),
 *         `includeDeleted=1` (default false — soft-deleted/merged rows hidden).
 *         Fuzzy similarity search is in WI-724a (separate endpoint).
 *  POST — Create. Requires `erp:write`. bizRegNo is canonicalized
 *         (dashes stripped) before storage to align with the partial unique
 *         constraint `(orgId, bizRegNo) WHERE bizRegNo IS NOT NULL`.
 *
 * All errors flow through {@link toResponse} (401/403/400/409/500 envelope).
 */

import { prisma } from "@axle/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireErpScope, toResponse, ErpConflictError } from "@/lib/erp/auth";
import { serializeCounterparty } from "@/lib/erp/serialize";
import {
  normalizeCounterpartyName,
  canonicalizeBizRegNo,
} from "@/lib/erp/counterparty-utils";

const MAX_LIST = 200;
const CounterpartyTypeSchema = z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]);

const CreateBody = z.object({
  name: z.string().trim().min(1).max(200),
  bizRegNo: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((v) => canonicalizeBizRegNo(v))
    .refine(
      (v) => v == null || /^\d{10}$/.test(v),
      "bizRegNo must be 10 digits (with or without dashes)",
    ),
  type: CounterpartyTypeSchema,
  address: z.string().trim().max(500).nullable().optional(),
  contactName: z.string().trim().max(100).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  contactEmail: z.string().trim().email().max(200).nullable().optional(),
  defaultCoaCode: z.string().trim().max(20).nullable().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const typeParam = url.searchParams.get("type")?.trim();
    const includeDeleted = url.searchParams.get("includeDeleted") === "1";

    const type =
      typeParam && (typeParam === "CUSTOMER" || typeParam === "SUPPLIER" || typeParam === "BOTH")
        ? typeParam
        : undefined;

    const where: Prisma.ErpCounterpartyWhereInput = {
      orgId: ctx.orgId,
      ...(q
        ? {
            OR: [
              { normalizedName: { contains: normalizeCounterpartyName(q) } },
              { bizRegNo: { contains: canonicalizeBizRegNo(q) ?? "" } },
            ],
          }
        : {}),
      ...(type ? { type } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    const items = await prisma.erpCounterparty.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: MAX_LIST,
    });

    return Response.json({ items: items.map(serializeCounterparty) });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = CreateBody.parse(raw);

    const data: Prisma.ErpCounterpartyCreateInput = {
      orgId: ctx.orgId,
      name: body.name,
      normalizedName: normalizeCounterpartyName(body.name),
      bizRegNo: body.bizRegNo ?? null,
      address: body.address ?? null,
      contactName: body.contactName ?? null,
      contactPhone: body.contactPhone ?? null,
      contactEmail: body.contactEmail ?? null,
      type: body.type,
      defaultCoaCode: body.defaultCoaCode ?? null,
    };

    try {
      const created = await prisma.erpCounterparty.create({ data });
      return Response.json(serializeCounterparty(created), { status: 201 });
    } catch (err) {
      // Partial unique on (orgId, bizRegNo) WHERE bizRegNo IS NOT NULL.
      // Prisma 7 + adapter-pg may surface meta.target undefined — assert only
      // on prefix (feedback_prisma7_p2002_meta).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ErpConflictError(
          "ErpCounterparty already exists with this bizRegNo in the tenant",
          ["bizRegNo"],
        );
      }
      throw err;
    }
  } catch (err) {
    return toResponse(err);
  }
}
