import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { authenticateScraper } from "@/lib/scraper-auth";
import { uploadScraperResult } from "@/lib/scraper-blob";
import { handleInternalError } from "@/lib/api-helpers";
import { scraperResultMetadataSchema } from "@/lib/validations/scraper-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * POST /api/scraper/results  (multipart/form-data)
 *
 * Fields:
 *   - metadata: JSON string  (required) — see scraperResultMetadataSchema
 *   - file: File             (optional) — required if status=COMPLETED
 *
 * Status transitions:
 *   - PICKED_UP → COMPLETED  (file uploaded to Blob, AutomationLog created)
 *   - PICKED_UP → FAILED     (no file required, AutomationLog records error)
 *
 * Errors:
 *   - 401 auth
 *   - 404 jobId not found / not owned by this org
 *   - 409 already terminal (COMPLETED/FAILED/EXPIRED/CANCELLED)
 *   - 410 lease expired (caller should not retry — sweeper requeues)
 *   - 422 validation
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateScraper(req);
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Expected multipart/form-data" } },
        { status: 400 },
      );
    }

    const metadataField = form.get("metadata");
    if (typeof metadataField !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "metadata field missing" } },
        { status: 422 },
      );
    }

    let metadataObj: unknown;
    try {
      metadataObj = JSON.parse(metadataField);
    } catch {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "metadata is not valid JSON" } },
        { status: 422 },
      );
    }

    const parsed = scraperResultMetadataSchema.safeParse(metadataObj);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          },
        },
        { status: 422 },
      );
    }

    const meta = parsed.data;

    const job = await prisma.scraperJob.findFirst({
      where: { id: meta.jobId, orgId: auth.orgId },
    });
    if (!job) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 },
      );
    }
    if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: `Job already ${job.status}` } },
        { status: 409 },
      );
    }
    if (job.status === "EXPIRED") {
      return NextResponse.json(
        { error: { code: "GONE", message: "Lease expired; job has been requeued" } },
        { status: 410 },
      );
    }
    if (job.leaseExpiresAt && job.leaseExpiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "GONE", message: "Lease expired" } },
        { status: 410 },
      );
    }

    let resultUrl: string | null = null;

    if (meta.status === "COMPLETED") {
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "file required when status=COMPLETED" } },
          { status: 422 },
        );
      }
      if (file.size === 0) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "file is empty" } },
          { status: 422 },
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "file exceeds 50MB" } },
          { status: 422 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = await uploadScraperResult({
        orgId: job.orgId,
        jobId: job.id,
        target: job.target,
        body: buffer,
        contentType: file.type || "application/pdf",
      });
      resultUrl = upload.url;
    }

    const automationStatus = meta.status; // COMPLETED | FAILED — matches JobStatus enum

    const result = await prisma.$transaction(async (tx) => {
      const automationLog = await tx.automationLog.create({
        data: {
          clientId: job.clientId,
          type: job.type,
          target: job.target,
          status: automationStatus,
          resultUrl,
          errorMessage: meta.errorMessage ?? null,
          detail: {
            jobId: job.id,
            errorCode: meta.errorCode ?? null,
            durationMs: meta.durationMs ?? null,
            ...(meta.detail ?? {}),
          } as Prisma.InputJsonValue,
        },
      });

      await tx.scraperJob.update({
        where: { id: job.id },
        data: {
          status: meta.status,
          completedAt: new Date(),
          automationLogId: automationLog.id,
        },
      });

      return automationLog;
    });

    return NextResponse.json({
      automationLogId: result.id,
      resultUrl,
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
