import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@axle/db";
import { authenticateScraper } from "@/lib/scraper-auth";
import { uploadScraperResult } from "@/lib/scraper-blob";
import { handleInternalError } from "@/lib/api-helpers";
import { scraperRepairSchema } from "@/lib/validations/scraper-job";

export const dynamic = "force-dynamic";

/**
 * POST /api/scraper/repair
 *
 * Records a Tier1 (vision) or Tier2 selector self-repair event.
 * Optional screenshot is uploaded to Vercel Blob and the URL stored.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateScraper(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    const parsed = scraperRepairSchema.safeParse(body);
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

    const input = parsed.data;

    // If jobId provided, ensure it belongs to the calling org.
    if (input.jobId) {
      const job = await prisma.scraperJob.findFirst({
        where: { id: input.jobId, orgId: auth.orgId },
        select: { id: true },
      });
      if (!job) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Job not found" } },
          { status: 404 },
        );
      }
    }

    let screenshotUrl: string | null = null;
    if (input.screenshotBase64) {
      const buffer = Buffer.from(input.screenshotBase64, "base64");
      const upload = await uploadScraperResult({
        orgId: auth.orgId,
        jobId: input.jobId ?? "no-job",
        target: `repair-${input.element}`,
        body: buffer,
        contentType: "image/png",
      });
      screenshotUrl = upload.url;
    }

    await prisma.scraperRepairLog.create({
      data: {
        jobId: input.jobId ?? null,
        portal: input.portal,
        page: input.page,
        element: input.element,
        oldSelector: input.oldSelector,
        newSelector: input.newSelector,
        repairedBy: input.repairedBy,
        screenshotUrl,
      },
    });

    return NextResponse.json({ accepted: true });
  } catch (err) {
    return handleInternalError(err);
  }
}
