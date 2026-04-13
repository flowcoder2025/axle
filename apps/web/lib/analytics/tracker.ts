/**
 * Server-side analytics event tracker.
 *
 * Usage in API routes:
 *   import { trackEvent } from "@/lib/analytics/tracker";
 *   await trackEvent({ category: "BUSINESS", action: "project.create", userId, orgId });
 *
 * For non-blocking writes in route handlers, wrap with after():
 *   import { after } from "next/server";
 *   after(() => trackEvent({ ... }));
 */
import { prisma } from "@axle/db";
import type { Prisma } from "@prisma/client";
import crypto from "node:crypto";

const IP_HASH_SECRET = process.env.IP_HASH_SECRET ?? "axle-default-dev-secret";

export type TrackEventInput = {
  userId?: string | null;
  orgId?: string | null;
  sessionId?: string;
  category: "PAGE_VIEW" | "FEATURE_USE" | "API_CALL" | "SYSTEM" | "BUSINESS";
  action: string;
  label?: string | null;
  value?: number | null;
  path?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
  userAgent?: string | null;
  ip?: string | null;
};

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHmac("sha256", IP_HASH_SECRET).update(ip).digest("hex");
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: input.userId ?? undefined,
        orgId: input.orgId ?? undefined,
        sessionId: input.sessionId ?? "unknown",
        category: input.category,
        action: input.action,
        label: input.label ?? undefined,
        value: input.value ?? undefined,
        path: input.path ?? undefined,
        referrer: input.referrer ?? undefined,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        userAgent: input.userAgent ?? undefined,
        ip: hashIp(input.ip),
      },
    });
  } catch (err) {
    console.error("[analytics] trackEvent failed:", err instanceof Error ? err.message : err);
  }
}

export async function trackEvents(inputs: TrackEventInput[]): Promise<void> {
  if (inputs.length === 0) return;

  try {
    await prisma.analyticsEvent.createMany({
      data: inputs.map((input) => ({
        userId: input.userId ?? undefined,
        orgId: input.orgId ?? undefined,
        sessionId: input.sessionId ?? "unknown",
        category: input.category,
        action: input.action,
        label: input.label ?? undefined,
        value: input.value ?? undefined,
        path: input.path ?? undefined,
        referrer: input.referrer ?? undefined,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        userAgent: input.userAgent ?? undefined,
        ip: hashIp(input.ip),
      })),
    });
  } catch (err) {
    console.error("[analytics] trackEvents failed:", err instanceof Error ? err.message : err);
  }
}
