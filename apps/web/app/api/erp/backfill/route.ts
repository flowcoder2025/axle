/**
 * /api/erp/backfill (Phase 21 WI-723b)
 *
 *  GET  — List recent CounterpartyBackfillBatch rows for the active tenant.
 *  POST — Start (or resume) a backfill batch and process one chunk synchronously.
 *         Body: { dryRun?: boolean, chunkSize?: number, notes?: string }.
 *         Returns the batch summary plus the chunk result. The client is
 *         expected to keep POSTing until `result.finished === true` — this
 *         keeps each call inside the serverless 10s budget.
 *
 * Auth: `erp:write` (org admins / owners). Future WI-722 follow-up may split
 * this to a dedicated `erp:counterparty:write` scope.
 */

import { z } from "zod";
import { prisma } from "@axle/db";
import { requireErpScope, toResponse, erpBadRequest } from "@/lib/erp/auth";
import {
  runBackfillChunk,
  startOrResumeBatch,
  serializeBatch,
} from "@/lib/erp/backfill";

const MAX_LIST = 50;

const StartBody = z.object({
  dryRun: z.boolean().optional(),
  chunkSize: z.number().int().positive().max(5000).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function GET(): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const batches = await prisma.counterpartyBackfillBatch.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { startedAt: "desc" },
      take: MAX_LIST,
    });
    return Response.json({ items: batches.map(serializeBatch) });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = StartBody.parse(raw);

    const { batchId, resumed } = await startOrResumeBatch(prisma, {
      orgId: ctx.orgId,
      notes: body.notes ?? null,
    });

    const result = await runBackfillChunk(
      {
        orgId: ctx.orgId,
        batchId,
        chunkSize: body.chunkSize,
        dryRun: body.dryRun === true,
      },
      prisma,
    );

    if (result.lockBusy) {
      return erpBadRequest("another backfill is currently running for this tenant");
    }

    const batch = await prisma.counterpartyBackfillBatch.findFirstOrThrow({
      where: { id: batchId, orgId: ctx.orgId },
    });

    return Response.json({
      batch: serializeBatch(batch),
      chunk: result,
      resumed,
    });
  } catch (err) {
    return toResponse(err);
  }
}
