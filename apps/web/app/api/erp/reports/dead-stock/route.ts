/**
 * GET /api/erp/reports/dead-stock?days=60&limit=50
 *
 * Phase 21 WI-730-feat — products with no OUT movement in the last
 * `days` days. Products that have NEVER had any OUT movement also
 * qualify (RED AC #4) and are sorted first.
 *
 * Default threshold is 60 days (mid-tier of the 30/60/90 design
 * defaults). A future ORG setting can override this on the API level
 * — leaving the query param as the explicit knob keeps the report
 * accessible without a schema change.
 *
 * Auth: erp:read.
 */

import { z } from "zod";
import { requireErpScope, toResponse, erpBadRequest } from "@/lib/erp/auth";
import { deadStockReport } from "@/lib/erp/reports";

const Query = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      days: url.searchParams.get("days") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return erpBadRequest(`Invalid query: ${issues}`);
    }
    const report = await deadStockReport({
      orgId: ctx.orgId,
      ...parsed.data,
    });
    return Response.json(report);
  } catch (err) {
    return toResponse(err);
  }
}
