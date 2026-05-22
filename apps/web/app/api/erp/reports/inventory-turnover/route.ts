/**
 * GET /api/erp/reports/inventory-turnover?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=20
 *
 * Phase 21 WI-730-feat — per-product turnover rate over a window.
 * Defaults to a 90-day trailing window when both `from` and `to` are
 * omitted; reports the highest-velocity products sorted by OUT qty / day.
 *
 * Auth: erp:read.
 */

import { z } from "zod";
import { requireErpScope, toResponse, erpBadRequest } from "@/lib/erp/auth";
import { inventoryTurnoverReport } from "@/lib/erp/reports";

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const Query = z.object({
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return erpBadRequest(`Invalid query: ${issues}`);
    }
    const report = await inventoryTurnoverReport({
      orgId: ctx.orgId,
      ...parsed.data,
    });
    return Response.json(report);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("REPORT_BAD_RANGE")) {
      return erpBadRequest(err.message);
    }
    return toResponse(err);
  }
}
