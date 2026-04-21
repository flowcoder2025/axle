import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";
import { BizinfoApiSource, KStartupApiSource } from "@axle/crawler";
import {
  runAndPersistSource,
  type CrawlerSourceResult,
} from "@/lib/services/crawler-persist";

// POST /api/cron/crawler-execute
// Scheduled: 0 6 * * * (daily at 06:00 UTC)
//
// Executes bizinfo + kstartup public-API crawlers, upserts each result into
// ProgramInfo (unique by source + externalId) and writes one AutomationLog
// row per source. A failure in one source does NOT block the other.
//
// WI-211-212-213
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const results: CrawlerSourceResult[] = [];

    const bizinfoKey = process.env.BIZINFO_API_KEY;
    const kstartupKey = process.env.KSTARTUP_API_KEY;

    if (bizinfoKey) {
      const bizinfo = new BizinfoApiSource(bizinfoKey);
      results.push(
        await runAndPersistSource({
          source: "bizinfo",
          fetch: () => bizinfo.fetchAllPrograms(),
        }),
      );
    } else {
      console.warn("crawler-execute: BIZINFO_API_KEY not set, skipping bizinfo");
    }

    if (kstartupKey) {
      const kstartup = new KStartupApiSource(kstartupKey);
      results.push(
        await runAndPersistSource({
          source: "kstartup",
          fetch: () => kstartup.fetchAllPrograms(),
        }),
      );
    } else {
      console.warn(
        "crawler-execute: KSTARTUP_API_KEY not set, skipping kstartup",
      );
    }

    const totalDuration = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      sources: results,
      totalDuration,
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
