import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

// POST /api/cron/crawler-execute
// Scheduled: 0 6 * * * (daily at 06:00 UTC)
// Trigger crawl job via QStash or log the trigger for the OCI VM worker.
// Phase 16: log the trigger only — actual crawl executes on OCI VM.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const qstashUrl = process.env.QSTASH_URL;
    const qstashToken = process.env.QSTASH_TOKEN;
    const crawlerEndpoint = process.env.CRAWLER_ENDPOINT;

    if (qstashUrl && qstashToken && crawlerEndpoint) {
      // Enqueue crawl job via QStash
      const res = await fetch(`${qstashUrl}/v2/publish/${crawlerEndpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ triggeredAt: new Date().toISOString() }),
      });

      if (!res.ok) {
        console.error(`crawler-execute: QStash enqueue failed — ${res.status}`);
      } else {
        console.log(`crawler-execute: crawl job enqueued via QStash`);
        return NextResponse.json({ success: true, processed: 1, method: "qstash" });
      }
    }

    // Fallback: log the trigger (OCI VM polls or uses its own scheduler)
    console.log(`crawler-execute: crawl trigger logged at ${new Date().toISOString()}`);
    return NextResponse.json({ success: true, processed: 1, method: "log" });
  } catch (err) {
    return handleInternalError(err);
  }
}
