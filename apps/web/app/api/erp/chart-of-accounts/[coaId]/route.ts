/**
 * /api/erp/chart-of-accounts/[coaId] (Phase 21 WI-725)
 *
 *  PATCH  — Edit a user-defined account (name / category / parentCode /
 *           effectiveTo). System rows (isSystem=true, seeded by NTS
 *           standard) are read-only — PATCH against them returns 400.
 *  DELETE — Hard-delete a user-defined row. System rows return 400.
 *
 * The system-row guard is intentionally a 400 (not 403): the resource
 * exists in the tenant and the caller has erp:write — what's forbidden
 * is the *mutation*, not the access. Phrasing it as a validation error
 * keeps it distinct from RBAC denials in client logs.
 */

import { z } from "zod";
import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  erpErrorResponse,
  ErpNotFoundError,
} from "@/lib/erp/auth";

const CategorySchema = z.enum([
  "REVENUE",
  "COGS",
  "OPEX",
  "NON_OPERATING",
  "OTHER",
]);

const PatchBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    category: CategorySchema.optional(),
    parentCode: z.string().trim().min(1).max(20).nullable().optional(),
    /** ISO date for retiring an account. Send null to clear. */
    effectiveTo: z.coerce.date().nullable().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.category !== undefined ||
      v.parentCode !== undefined ||
      v.effectiveTo !== undefined,
    { message: "at least one field is required" },
  );

interface RouteContext {
  params: Promise<{ coaId: string }>;
}

export async function PATCH(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { coaId } = await context.params;
    if (!coaId) return erpBadRequest("coaId is required");

    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = PatchBody.parse(raw);

    const existing = await prisma.chartOfAccounts.findFirst({
      where: { id: coaId, orgId: ctx.orgId },
      select: { id: true, isSystem: true },
    });
    if (!existing) throw new ErpNotFoundError("ChartOfAccounts not found");
    if (existing.isSystem) {
      return erpErrorResponse(
        400,
        "SYSTEM_ROW_READONLY",
        "system seed rows (isSystem=true) cannot be modified",
      );
    }

    const updated = await prisma.chartOfAccounts.update({
      where: { id: coaId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.parentCode !== undefined
          ? { parentCode: body.parentCode }
          : {}),
        ...(body.effectiveTo !== undefined
          ? { effectiveTo: body.effectiveTo }
          : {}),
      },
    });

    return Response.json({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      category: updated.category,
      parentCode: updated.parentCode,
      source: updated.source,
      isSystem: updated.isSystem,
      effectiveFrom: updated.effectiveFrom.toISOString(),
      effectiveTo: updated.effectiveTo ? updated.effectiveTo.toISOString() : null,
    });
  } catch (err) {
    return toResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { coaId } = await context.params;
    if (!coaId) return erpBadRequest("coaId is required");

    const existing = await prisma.chartOfAccounts.findFirst({
      where: { id: coaId, orgId: ctx.orgId },
      select: { id: true, isSystem: true },
    });
    if (!existing) throw new ErpNotFoundError("ChartOfAccounts not found");
    if (existing.isSystem) {
      return erpErrorResponse(
        400,
        "SYSTEM_ROW_READONLY",
        "system seed rows (isSystem=true) cannot be deleted",
      );
    }

    await prisma.chartOfAccounts.delete({ where: { id: coaId } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return toResponse(err);
  }
}
