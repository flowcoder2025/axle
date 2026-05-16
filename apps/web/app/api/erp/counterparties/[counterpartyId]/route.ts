/**
 * /api/erp/counterparties/[counterpartyId] (Phase 21 WI-722)
 *
 *  GET    — Fetch a single counterparty (active tenant scoped).
 *           Soft-deleted rows return 404 unless `includeDeleted=1`.
 *  PATCH  — Partial update. Requires `erp:write`. normalizedName recomputed
 *           when `name` changes. bizRegNo canonicalized.
 *  DELETE — Soft delete (sets `deletedAt`). Requires `erp:write`.
 *           Hard delete is intentionally not exposed — Order rows may
 *           reference this counterparty via FK (WI-723a).
 *
 * Merge action is a separate endpoint (WI-724c) with its own scope guard.
 */

import { prisma } from "@axle/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  requireErpScope,
  toResponse,
  ErpNotFoundError,
  ErpConflictError,
} from "@/lib/erp/auth";
import { serializeCounterparty } from "@/lib/erp/serialize";
import {
  normalizeCounterpartyName,
  canonicalizeBizRegNo,
} from "@/lib/erp/counterparty-utils";

const CounterpartyTypeSchema = z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]);

const PatchBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  bizRegNo: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : canonicalizeBizRegNo(v)))
    .refine(
      (v) => v === undefined || v === null || /^\d{10}$/.test(v),
      "bizRegNo must be 10 digits (with or without dashes)",
    ),
  type: CounterpartyTypeSchema.optional(),
  address: z.string().trim().max(500).nullable().optional(),
  contactName: z.string().trim().max(100).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  contactEmail: z.string().trim().email().max(200).nullable().optional(),
  defaultCoaCode: z.string().trim().max(20).nullable().optional(),
});

type Params = { params: Promise<{ counterpartyId: string }> };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const { counterpartyId } = await params;
    const url = new URL(req.url);
    const includeDeleted = url.searchParams.get("includeDeleted") === "1";

    const row = await prisma.erpCounterparty.findFirst({
      where: {
        id: counterpartyId,
        orgId: ctx.orgId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
    if (!row) {
      throw new ErpNotFoundError("ErpCounterparty not found");
    }
    return Response.json(serializeCounterparty(row));
  } catch (err) {
    return toResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { counterpartyId } = await params;
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = PatchBody.parse(raw);

    const existing = await prisma.erpCounterparty.findFirst({
      where: { id: counterpartyId, orgId: ctx.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new ErpNotFoundError("ErpCounterparty not found");
    }

    const data: Prisma.ErpCounterpartyUpdateInput = {
      ...(body.name !== undefined
        ? { name: body.name, normalizedName: normalizeCounterpartyName(body.name) }
        : {}),
      ...(body.bizRegNo !== undefined ? { bizRegNo: body.bizRegNo } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
      ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
      ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
      ...(body.defaultCoaCode !== undefined
        ? { defaultCoaCode: body.defaultCoaCode }
        : {}),
    };

    try {
      const updated = await prisma.erpCounterparty.update({
        where: { id: counterpartyId },
        data,
      });
      return Response.json(serializeCounterparty(updated));
    } catch (err) {
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

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { counterpartyId } = await params;

    const existing = await prisma.erpCounterparty.findFirst({
      where: { id: counterpartyId, orgId: ctx.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new ErpNotFoundError("ErpCounterparty not found");
    }

    const deleted = await prisma.erpCounterparty.update({
      where: { id: counterpartyId },
      data: { deletedAt: new Date() },
    });
    return Response.json(serializeCounterparty(deleted));
  } catch (err) {
    return toResponse(err);
  }
}
