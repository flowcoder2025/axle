import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticateScraper } from "@/lib/scraper-auth";
import { handleInternalError } from "@/lib/api-helpers";
import { scraperReportSchema } from "@/lib/validations/scraper-job";
import { redactCredentials } from "@/lib/log-sanitizer";

export const dynamic = "force-dynamic";

/**
 * POST /api/scraper/report
 *
 * Session summary ack — scraper sends end-of-run statistics. We log a
 * structured (sanitized) line and ack. No DB writes for now; observability
 * destination can be added later (Sentry breadcrumb, OpenTelemetry, etc).
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateScraper(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    const parsed = scraperReportSchema.safeParse(body);
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

    const sanitized = redactCredentials({ orgId: auth.orgId, ...parsed.data });
    console.info("[scraper.report]", JSON.stringify(sanitized));

    return NextResponse.json({ accepted: true });
  } catch (err) {
    return handleInternalError(err);
  }
}
