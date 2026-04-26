import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const MAX_RETRIES = 3;

/**
 * POST /api/cron/scraper-sweep
 *
 * Periodic sweeper for ScraperJob with expired leases. Per
 * .flowset/contracts/scraper-data.md §5:
 *   PICKED_UP + leaseExpiresAt < now → QUEUED (up to MAX_RETRIES times)
 *   PICKED_UP + retries exhausted → FAILED
 *
 * Suggested Vercel Cron schedule: * * * * * (every minute) — adjust per load.
 */
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const expired = await prisma.scraperJob.findMany({
      where: {
        status: "PICKED_UP",
        leaseExpiresAt: { lt: now },
      },
      select: { id: true, params: true },
    });

    let requeued = 0;
    let failed = 0;

    for (const job of expired) {
      const params = (job.params ?? {}) as Record<string, unknown>;
      const retries = typeof params.__retries === "number" ? params.__retries : 0;

      if (retries >= MAX_RETRIES) {
        const automationLog = await prisma.automationLog.create({
          data: {
            type: "PORTAL_UPLOAD",
            target: "scraper-lease-expired",
            status: "FAILED",
            errorMessage: `Lease expired ${MAX_RETRIES} times — giving up`,
            detail: { jobId: job.id, retries },
          },
        });
        await prisma.scraperJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            completedAt: now,
            automationLogId: automationLog.id,
          },
        });
        failed += 1;
      } else {
        await prisma.scraperJob.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            pickedUpAt: null,
            pickedUpBy: null,
            leaseExpiresAt: null,
            params: { ...params, __retries: retries + 1 } as Prisma.InputJsonValue,
          },
        });
        requeued += 1;
      }
    }

    return NextResponse.json({
      sweptAt: now.toISOString(),
      considered: expired.length,
      requeued,
      failed,
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
