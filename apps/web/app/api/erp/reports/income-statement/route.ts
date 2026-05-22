/**
 * GET /api/erp/reports/income-statement?year=YYYY[&month=M]
 *
 * Phase 21 WI-729-feat — simplified P&L. Aggregates mv rows by coaCode,
 * joins ChartOfAccounts (tenant-scoped) for category + parentCode, then
 * rolls children into parents (depth-2 in the seed).
 *
 * Categories:
 *   REVENUE       매출
 *   COGS          매출원가
 *   OPEX          판매비와관리비
 *   NON_OPERATING 영업외수익/비용 (parentCode 900 → +, 950 → -)
 *   OTHER         기타 (잡손익)
 *
 * Derived totals:
 *   operatingIncome = REVENUE - COGS - OPEX
 *   netIncome       = operatingIncome + (영업외수익 - 영업외비용)
 *
 * Auth: erp:read. Empty result → 200 with all totals = "0.00" (RED AC #4).
 */

import { z } from "zod";
import { requireErpScope, toResponse, erpBadRequest } from "@/lib/erp/auth";
import { incomeStatementReport } from "@/lib/erp/reports";

const Query = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      year: url.searchParams.get("year") ?? undefined,
      month: url.searchParams.get("month") ?? undefined,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return erpBadRequest(`Invalid query: ${issues}`);
    }
    const { year, month } = parsed.data;

    const report = await incomeStatementReport({
      orgId: ctx.orgId,
      year,
      month,
    });

    return Response.json(report);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("REPORT_BAD_MONTH")) {
      return erpBadRequest(err.message);
    }
    return toResponse(err);
  }
}
