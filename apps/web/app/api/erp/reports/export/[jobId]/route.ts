/**
 * GET /api/erp/reports/export/:jobId  (Phase 21 WI-731-feat)
 *
 * Poll endpoint for the async export started via POST /api/erp/reports/export.
 *
 * Returns:
 *   - QUEUED   → { status: "QUEUED" }
 *   - RUNNING  → { status: "RUNNING" }
 *   - COMPLETED → { status: "COMPLETED", output: { format, blobUrl, sizeBytes, filename } }
 *   - FAILED   → { status: "FAILED", error: "..." }
 *
 * Tenant-scoped — a job belonging to a different org returns 404 (we
 * deliberately conflate "no such job" with "not yours" to avoid
 * leaking the job-id namespace across tenants).
 *
 * Auth: erp:read.
 */

import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  ErpNotFoundError,
} from "@/lib/erp/auth";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(
  _req: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const { jobId } = await context.params;

    const job = await prisma.aiJob.findFirst({
      where: { id: jobId, orgId: ctx.orgId, type: "REPORT_EXPORT" },
      select: {
        id: true,
        status: true,
        output: true,
        errorMessage: true,
        createdAt: true,
        durationMs: true,
      },
    });
    if (!job) {
      // RED AC #4: 잘못된 jobId → 404
      return toResponse(new ErpNotFoundError("Export job not found"));
    }

    const base = {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      durationMs: job.durationMs,
    };

    if (job.status === "COMPLETED") {
      return Response.json({ ...base, output: job.output });
    }
    if (job.status === "FAILED") {
      return Response.json({ ...base, error: job.errorMessage });
    }
    return Response.json(base);
  } catch (err) {
    return toResponse(err);
  }
}
