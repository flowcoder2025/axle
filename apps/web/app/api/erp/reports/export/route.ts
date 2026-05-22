/**
 * POST /api/erp/reports/export  (Phase 21 WI-731-feat)
 *
 * Body:
 *   {
 *     reportType: "counterparty" | "income-statement" | "inventory-turnover" | "dead-stock",
 *     format: "csv",
 *     params: { ... }  // shape depends on reportType, see lib/erp/report-export.ts
 *   }
 *
 * Response: 202 { jobId, pollUrl }
 *
 * The handler returns immediately. The render runs in the background; poll
 * `GET /api/erp/reports/export/:jobId` for status + the Blob URL.
 *
 * Auth: erp:read.
 */

import { z } from "zod";
import { requireErpScope, toResponse, erpBadRequest } from "@/lib/erp/auth";
import { enqueueReportExport } from "@/lib/erp/report-export";

const Body = z.object({
  reportType: z.enum([
    "counterparty",
    "income-statement",
    "inventory-turnover",
    "dead-stock",
  ]),
  format: z.enum(["csv"]),
  params: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return erpBadRequest("invalid JSON body");
    }
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return erpBadRequest(`Invalid body: ${issues}`);
    }
    const jobId = await enqueueReportExport(ctx.orgId, parsed.data);
    return Response.json(
      {
        jobId,
        pollUrl: `/api/erp/reports/export/${jobId}`,
      },
      { status: 202 },
    );
  } catch (err) {
    return toResponse(err);
  }
}
