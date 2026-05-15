/**
 * /api/erp/intake/[draftId]/discard
 *
 *   POST — Transition a PENDING IntakeDraft to DISCARDED. CONFIRMED or
 *          already-DISCARDED drafts return 409. Cross-tenant draftIds also
 *          return 409 (the `orgId` filter is part of the update predicate so
 *          we can't distinguish "wrong org" from "wrong status" — both are
 *          domain conflicts from the caller's perspective).
 *
 *   Prisma 7 note: `update.where` only accepts @unique fields. Filtering on
 *   `status` + `orgId` together requires `updateMany` and inspecting
 *   `count` to detect "no row matched".
 */

import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  ErpConflictError,
} from "@/lib/erp/auth";

interface RouteContext {
  params: Promise<{ draftId: string }>;
}

export async function POST(
  _req: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const { draftId } = await context.params;
    if (!draftId) {
      return erpBadRequest("draftId is required");
    }

    const result = await prisma.intakeDraft.updateMany({
      where: { id: draftId, status: "PENDING", orgId: ctx.orgId },
      data: { status: "DISCARDED" },
    });
    if (result.count === 0) {
      throw new ErpConflictError("Cannot discard (not PENDING or wrong org)");
    }
    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
