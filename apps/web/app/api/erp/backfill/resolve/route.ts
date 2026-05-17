/**
 * /api/erp/backfill/resolve (Phase 21 WI-723b)
 *
 *  POST — Link every Order whose normalized counterpartyName equals
 *         `normalizedName` to `counterpartyId`. Used by the staging UI after
 *         a human picks the correct master for an ambiguous group.
 *
 *  Body: { normalizedName: string, counterpartyId: string }
 *  Response: { linked: number }
 *
 *  Auth: `erp:write`. ErpCounterparty must exist in the tenant (404 otherwise).
 */

import { z } from "zod";
import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  ErpNotFoundError,
} from "@/lib/erp/auth";
import { resolvePendingGroup } from "@/lib/erp/backfill";

const Body = z.object({
  normalizedName: z.string().trim().min(1).max(500),
  counterpartyId: z.string().trim().min(1).max(100),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = Body.parse(raw);

    try {
      const result = await resolvePendingGroup(
        {
          orgId: ctx.orgId,
          normalizedName: body.normalizedName,
          counterpartyId: body.counterpartyId,
        },
        prisma,
      );
      return Response.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "counterparty not found in tenant") {
        throw new ErpNotFoundError(err.message);
      }
      throw err;
    }
  } catch (err) {
    return toResponse(err);
  }
}
