/**
 * /api/erp/backfill/[batchId] (Phase 21 WI-723b)
 *
 *  GET — Read one CounterpartyBackfillBatch by id (tenant-scoped). 404 when
 *        the batch does not belong to the active tenant.
 */

import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  ErpNotFoundError,
} from "@/lib/erp/auth";
import { serializeBatch } from "@/lib/erp/backfill";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const { batchId } = await params;

    const batch = await prisma.counterpartyBackfillBatch.findFirst({
      where: { id: batchId, orgId: ctx.orgId },
    });
    if (!batch) throw new ErpNotFoundError("backfill batch not found");

    return Response.json(serializeBatch(batch));
  } catch (err) {
    return toResponse(err);
  }
}
