import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticateScraper } from "@/lib/scraper-auth";

export const dynamic = "force-dynamic";

const VERSION = "1.0.0";

export async function GET(req: NextRequest) {
  const auth = await authenticateScraper(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    status: "ok",
    serverTime: new Date().toISOString(),
    version: VERSION,
  });
}
