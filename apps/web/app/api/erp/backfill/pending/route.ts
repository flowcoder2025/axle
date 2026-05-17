/**
 * /api/erp/backfill/pending (Phase 21 WI-723b)
 *
 *  GET — Distinct counterpartyName groups whose Orders still have
 *        `counterpartyId IS NULL`. Powers the staging UI's "pending review"
 *        table. Sorted by frequency desc.
 */

import { z } from "zod";
import { prisma } from "@axle/db";
import { requireErpScope, toResponse } from "@/lib/erp/auth";
import { listPendingGroups } from "@/lib/erp/backfill";

const QuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const groups = await listPendingGroups(
      { orgId: ctx.orgId, limit: parsed.limit },
      prisma,
    );
    return Response.json({ items: groups });
  } catch (err) {
    return toResponse(err);
  }
}
