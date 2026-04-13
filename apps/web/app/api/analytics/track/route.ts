import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackEvents } from "@/lib/analytics/tracker";
import { getAnalyticsRatelimit } from "@/lib/analytics/rate-limit";
import { handleZodError, handleInternalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@axle/auth";

const CUID_REGEX = /^[a-z0-9]{20,30}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EventSchema = z.object({
  category: z.enum(["PAGE_VIEW", "FEATURE_USE", "API_CALL", "SYSTEM", "BUSINESS"]),
  action: z.string().min(1).max(200),
  label: z.string().max(500).nullable().optional(),
  value: z.number().nullable().optional(),
  path: z.string().max(2000).nullable().optional(),
  referrer: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const TrackRequestSchema = z.object({
  sessionId: z.string().regex(CUID_REGEX).or(z.string().regex(UUID_REGEX)),
  events: z.array(EventSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 100_000) {
      return NextResponse.json(
        { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds 100KB" } },
        { status: 413 },
      );
    }

    const body = await request.json();
    const parsed = TrackRequestSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { sessionId, events } = parsed.data;

    const limiter = getAnalyticsRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(sessionId);
      if (!success) {
        return NextResponse.json(
          { error: { code: "RATE_LIMITED", message: "Too many requests" } },
          { status: 429 },
        );
      }
    }

    const user = await getCurrentUser();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent") ?? null;

    await trackEvents(
      events.map((event) => ({
        ...event,
        sessionId,
        userId: user?.id ?? null,
        orgId: user?.orgId ?? null,
        ip,
        userAgent,
      })),
    );

    return NextResponse.json({ data: { tracked: events.length } });
  } catch (err) {
    return handleInternalError(err);
  }
}
