/**
 * GET /api/erp/reports/counterparty?from=YYYY-MM&to=YYYY-MM&type=SALE|PURCHASE&limit=10
 *
 * Phase 21 WI-728-feat — top counterparties by total amount over the
 * requested month window. Reads `mv_erp_monthly_summary` (refreshed by
 * the daily cron). Decimal fields are returned as strings to survive
 * the JSON boundary without precision loss (feedback_decimal_serialization).
 *
 * Auth: erp:read scope (any reader can see the report; writes are out of
 * scope here).
 *
 * Response:
 *   {
 *     rows: [{
 *       counterpartyId, counterpartyName, totalAmount, totalQty,
 *       lineCount, monthlyBreakdown: [{month, totalAmount}]
 *     }],
 *     totalAmount, generatedAt, dataAsOf,
 *     filters: { from, to, type, limit }
 *   }
 */

import { z } from "zod";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
} from "@/lib/erp/auth";
import { counterpartyReport } from "@/lib/erp/reports";

const MonthString = z
  .string()
  .regex(/^(\d{4})-(0[1-9]|1[0-2])$/, "expected YYYY-MM");

const Query = z.object({
  from: MonthString,
  to: MonthString,
  type: z.enum(["SALE", "PURCHASE"]),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function parseMonth(s: string): { year: number; month: number } {
  const [y, m] = s.split("-").map((p) => Number(p));
  return { year: y, month: m };
}

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return erpBadRequest(`Invalid query: ${issues}`);
    }
    const { from, to, type, limit } = parsed.data;

    const report = await counterpartyReport({
      orgId: ctx.orgId,
      from: parseMonth(from),
      to: parseMonth(to),
      type,
      limit,
    });

    return Response.json({
      ...report,
      filters: { from, to, type, limit: limit ?? 10 },
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("REPORT_BAD_RANGE")) {
      return erpBadRequest(err.message);
    }
    return toResponse(err);
  }
}
