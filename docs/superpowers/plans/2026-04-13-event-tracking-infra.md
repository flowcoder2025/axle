# Event Tracking Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted event tracking infrastructure for AXLE — schema, collection layer, aggregation crons, and analytics APIs — gated by platform/org admin roles.

**Architecture:** PostgreSQL stores raw events (AnalyticsEvent) and pre-aggregated daily metrics (DailyMetric, DailyActionMetric). Client-side `useTracker()` hook collects PAGE_VIEW and FEATURE_USE events via `sendBeacon` batches to `POST /api/analytics/track`. Server-side `trackEvent()` uses `after()` for non-blocking writes. Cron jobs aggregate daily and clean up old events. Auth extended with `PlatformRole` in JWT for Super Admin gating.

**Tech Stack:** Next.js 16, Prisma 7 (PrismaPg adapter), Zod 4, @upstash/ratelimit + @upstash/redis, Auth.js v5

**Spec:** `docs/superpowers/specs/2026-04-13-event-tracking-infra-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/lib/analytics/constants.ts` | Event action name constants, EventCategory type re-export |
| `apps/web/lib/analytics/tracker.ts` | `trackEvent()`, `trackEvents()` — server-side core write functions |
| `apps/web/lib/analytics/rate-limit.ts` | Upstash Redis rate limiter config |
| `apps/web/lib/analytics/aggregator.ts` | Aggregation queries (today realtime, daily range, action metrics) |
| `apps/web/lib/analytics/event-bus-subscriber.ts` | Subscribe to existing eventBus → auto-track BUSINESS events |
| `apps/web/hooks/use-tracker.ts` | Client-side `useTracker()` hook (PAGE_VIEW auto + manual track) |
| `apps/web/app/api/analytics/track/route.ts` | POST — batch event ingestion (rate limited) |
| `apps/web/app/api/analytics/platform/overview/route.ts` | GET — platform-wide stats summary |
| `apps/web/app/api/analytics/platform/users/route.ts` | GET — DAU/WAU/MAU trends |
| `apps/web/app/api/analytics/platform/features/route.ts` | GET — feature usage ranking |
| `apps/web/app/api/analytics/platform/system/route.ts` | GET — API errors, response times, automation |
| `apps/web/app/api/analytics/platform/ai/route.ts` | GET — AI job usage/cost |
| `apps/web/app/api/analytics/org/overview/route.ts` | GET — org-scoped stats summary |
| `apps/web/app/api/analytics/org/members/route.ts` | GET — per-member activity |
| `apps/web/app/api/analytics/org/usage/route.ts` | GET — org feature usage |
| `apps/web/app/api/cron/aggregate-metrics/route.ts` | Cron — daily aggregation |
| `apps/web/app/api/cron/cleanup-events/route.ts` | Cron — 90-day batch delete |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/prisma/schema.prisma` | +PlatformRole enum, +User.platformRole, +AnalyticsEvent, +DailyMetric, +DailyActionMetric |
| `packages/auth/src/auth.ts` | JWT callback adds platformRole, session callback exposes it |
| `packages/auth/src/auth.config.ts` | PROTECTED_PREFIXES += `/platform-admin` |
| `packages/auth/src/dal.ts` | AuthUser += platformRole, +requirePlatformAdmin(), +requireOrgAdmin() |
| `apps/web/middleware.ts` | +sessionId cookie logic (no DB access) |
| `apps/web/lib/api-helpers.ts` | +forbiddenResponse() helper |
| `apps/web/vercel.json` | +2 cron entries |
| `apps/web/package.json` | +@upstash/ratelimit |

---

## Task 1: Schema — Add PlatformRole + AnalyticsEvent + DailyMetric + DailyActionMetric

**Files:**
- Modify: `packages/db/prisma/schema.prisma:16-20` (add PlatformRole enum after MemberRole)
- Modify: `packages/db/prisma/schema.prisma:22-41` (add platformRole to User)
- Modify: `packages/db/prisma/schema.prisma:958` (append 3 new models after PortalJournal)

- [ ] **Step 1: Add PlatformRole enum after MemberRole (line 20)**

After the closing `}` of `enum MemberRole` (line 20), add:

```prisma
enum PlatformRole {
  USER
  PLATFORM_ADMIN
}
```

- [ ] **Step 2: Add platformRole field to User model**

In the User model (line 22-41), add `platformRole` after the `password` field (line 28):

```prisma
  platformRole  PlatformRole @default(USER)
```

- [ ] **Step 3: Add EventCategory enum + AnalyticsEvent model**

After the last model (PortalJournal, line 958), append:

```prisma

// ── Analytics ────────────────────────────────────────────────────────────────

enum EventCategory {
  PAGE_VIEW
  FEATURE_USE
  API_CALL
  SYSTEM
  BUSINESS
}

model AnalyticsEvent {
  id        String        @id @default(cuid())

  userId    String?
  orgId     String?
  sessionId String

  category  EventCategory
  action    String
  label     String?
  value     Float?

  path      String?
  referrer  String?

  metadata  Json?
  userAgent String?
  ip        String?

  createdAt DateTime      @default(now())

  @@index([orgId, createdAt])
  @@index([category, createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@index([sessionId, createdAt])
}
```

- [ ] **Step 4: Add DailyMetric model**

```prisma
model DailyMetric {
  id        String   @id @default(cuid())
  date      DateTime @db.Date
  orgId     String?

  pageViews      Int @default(0)
  uniqueUsers    Int @default(0)
  sessions       Int @default(0)
  avgSessionSec  Int @default(0)

  projectsCreated    Int @default(0)
  documentsProcessed Int @default(0)
  matchingsRun       Int @default(0)

  aiJobsTotal     Int   @default(0)
  aiJobsCost      Float @default(0)
  aiAvgDurationMs Int   @default(0)

  apiCalls           Int @default(0)
  apiErrors          Int @default(0)
  avgResponseMs      Int @default(0)
  automationRuns     Int @default(0)
  automationFailures Int @default(0)

  createdAt DateTime @default(now())

  @@unique([date, orgId])
  @@index([orgId, date])
}
```

- [ ] **Step 5: Add DailyActionMetric model**

```prisma
model DailyActionMetric {
  id     String   @id @default(cuid())
  date   DateTime @db.Date
  orgId  String?
  action String
  count  Int      @default(0)

  @@unique([date, orgId, action])
  @@index([orgId, date])
  @@index([action, date])
}
```

- [ ] **Step 6: Push schema to DB**

Run: `cd /Volumes/포터블/AXLE && npx turbo --filter=@axle/db db:push`

If `db:push` script doesn't exist, run: `cd packages/db && npx prisma db push`

Expected: Schema synced, no errors.

- [ ] **Step 7: Generate Prisma client**

Run: `cd /Volumes/포터블/AXLE/packages/db && npx prisma generate`

Expected: `✔ Generated Prisma Client`

- [ ] **Step 8: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: All packages pass typecheck.

- [ ] **Step 9: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat: add analytics schema — AnalyticsEvent, DailyMetric, DailyActionMetric, PlatformRole"
```

---

## Task 2: Auth — Add platformRole to JWT + Session + DAL helpers

**Files:**
- Modify: `packages/auth/src/auth.ts:63-79` (JWT callback)
- Modify: `packages/auth/src/auth.ts:84-91` (session callback)
- Modify: `packages/auth/src/auth.config.ts:10` (PROTECTED_PREFIXES)
- Modify: `packages/auth/src/dal.ts:11-17` (AuthUser type)
- Modify: `packages/auth/src/dal.ts` (add requirePlatformAdmin, requireOrgAdmin)
- Modify: `apps/web/lib/api-helpers.ts` (add forbiddenResponse)

- [ ] **Step 1: Add platformRole to JWT callback in auth.ts**

In `packages/auth/src/auth.ts`, replace the jwt callback (lines 63-79):

```typescript
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.userId = user.id;
      }

      // On sign-in, fetch orgId and platformRole from DB
      if (account && token.userId) {
        const [membership, dbUser] = await Promise.all([
          prisma.membership.findFirst({
            where: { userId: token.userId as string },
            select: { organizationId: true },
          }),
          prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { platformRole: true },
          }),
        ]);
        token.orgId = membership?.organizationId ?? null;
        token.platformRole = dbUser?.platformRole ?? "USER";
      }

      return token;
    },
```

- [ ] **Step 2: Add platformRole to session callback in auth.ts**

Replace the session callback (lines 84-91):

```typescript
    session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        (session.user as typeof session.user & { orgId: string | null; platformRole: string }).orgId =
          (token.orgId as string | null) ?? null;
        (session.user as typeof session.user & { orgId: string | null; platformRole: string }).platformRole =
          (token.platformRole as string) ?? "USER";
      }
      return session;
    },
```

- [ ] **Step 3: Add `/platform-admin` to PROTECTED_PREFIXES in auth.config.ts**

In `packages/auth/src/auth.config.ts`, replace line 10:

```typescript
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/org", "/api/protected", "/platform-admin"];
```

- [ ] **Step 4: Update AuthUser type and add helpers in dal.ts**

Replace the entire `packages/auth/src/dal.ts`:

```typescript
/**
 * dal.ts — Data Access Layer for authentication
 *
 * Provides React cache-wrapped helpers that components/server actions can call
 * without worrying about session fetching or redirect logic.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth.js";

type AuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  orgId?: string | null;
  platformRole?: string | null;
};

/**
 * getCurrentUser — React cache-wrapped session fetch.
 *
 * Safe to call multiple times in one render; only hits auth() once per request.
 * Returns the session user or null if unauthenticated.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = session.user as AuthUser;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    orgId: user.orgId ?? null,
    platformRole: user.platformRole ?? "USER",
  };
});

/**
 * requireUser — throws a redirect to /login if not authenticated.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * requireOrg — throws a redirect to /login if user has no active org.
 */
export async function requireOrg(): Promise<AuthUser & { orgId: string }> {
  const user = await requireUser();
  if (!user.orgId) {
    redirect("/login");
  }
  return user as AuthUser & { orgId: string };
}

/**
 * requirePlatformAdmin — returns 403 if user is not PLATFORM_ADMIN.
 * Use in API routes (not pages — pages redirect via middleware).
 */
export async function requirePlatformAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.platformRole !== "PLATFORM_ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/**
 * requireOrgAdmin — returns user if OWNER or ADMIN of current org.
 * Requires DB lookup for membership role.
 */
export async function requireOrgAdmin(): Promise<AuthUser & { orgId: string }> {
  const user = await requireOrg();
  const { prisma } = await import("@axle/db");
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: user.orgId },
    select: { role: true },
  });
  if (!membership || membership.role === "MEMBER") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
```

- [ ] **Step 5: Add forbiddenResponse to api-helpers.ts**

In `apps/web/lib/api-helpers.ts`, add after the `notFoundResponse` function (line 37):

```typescript

export function forbiddenResponse(message = "Insufficient permissions") {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message } },
    { status: 403 }
  );
}
```

- [ ] **Step 6: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: All packages pass.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/auth.ts packages/auth/src/auth.config.ts packages/auth/src/dal.ts apps/web/lib/api-helpers.ts
git commit -m "feat: add platformRole to JWT/session, add requirePlatformAdmin/requireOrgAdmin helpers"
```

---

## Task 3: Middleware — Add sessionId cookie logic

**Files:**
- Modify: `apps/web/middleware.ts` (add sessionId cookie before auth)

- [ ] **Step 1: Update middleware.ts**

Replace the entire `apps/web/middleware.ts`:

```typescript
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextMiddleware, NextRequest } from "next/server";
import { authConfig } from "@axle/auth/edge";

const { auth } = NextAuth(authConfig);

/** Paths that should NOT get a sessionId cookie */
const SKIP_SESSION_PREFIXES = ["/api/", "/_next/", "/favicon.ico"];
const SKIP_SESSION_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".css", ".js", ".woff2", ".woff", ".ttf", ".eot"];

function shouldSkipSession(pathname: string): boolean {
  if (SKIP_SESSION_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (SKIP_SESSION_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true;
  return false;
}

/**
 * Generate a simple unique ID for sessionId cookie.
 * Uses crypto.randomUUID() available in Edge runtime.
 */
function generateSessionId(): string {
  return crypto.randomUUID();
}

const authMiddleware = auth as NextMiddleware;

export const middleware: NextMiddleware = async (request: NextRequest) => {
  // Run auth middleware first
  const response = await (authMiddleware as (req: NextRequest) => Promise<NextResponse | Response | undefined>)(request);
  const res = response ?? NextResponse.next();

  // Set sessionId cookie on page navigations (not API/static)
  const pathname = request.nextUrl.pathname;
  if (!shouldSkipSession(pathname)) {
    const existingSession = request.cookies.get("axle_sid");
    if (!existingSession) {
      const sid = generateSessionId();
      (res as NextResponse).cookies.set("axle_sid", sid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 60, // 30 minutes
        path: "/",
      });
    }
  }

  return res;
};

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)).*)",
  ],
};
```

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`

Expected: Build succeeds (middleware compiles for Edge runtime — no DB imports).

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: add sessionId cookie (axle_sid) in middleware for analytics tracking"
```

---

## Task 4: Analytics constants + server-side tracker

**Files:**
- Create: `apps/web/lib/analytics/constants.ts`
- Create: `apps/web/lib/analytics/tracker.ts`

- [ ] **Step 1: Create constants.ts**

```typescript
/**
 * Analytics event constants — canonical action names used across client and server.
 */

// Re-export the Prisma enum for convenience
export { EventCategory } from "@prisma/client";

/** Page view actions are auto-prefixed: "page.<path>" */
export const PAGE_PREFIX = "page.";

/** Standard feature actions */
export const Actions = {
  // Projects
  PROJECT_CREATE: "project.create",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",

  // Clients
  CLIENT_CREATE: "client.create",
  CLIENT_UPDATE: "client.update",

  // Documents
  DOC_UPLOAD: "doc.upload",
  DOC_REQUEST: "doc.request",
  DOC_DOWNLOAD: "doc.download",

  // AI
  AI_JOB_START: "ai.job.start",
  AI_JOB_COMPLETE: "ai.job.complete",
  AI_JOB_FAILED: "ai.job.failed",

  // Matching
  MATCHING_RUN: "matching.run",
  MATCHING_VIEW: "matching.view",

  // Meetings
  MEETING_CREATE: "meeting.create",

  // Finance
  ESTIMATE_CREATE: "estimate.create",
  CONTRACT_CREATE: "contract.create",

  // Automation
  AUTOMATION_RUN: "automation.run",
  AUTOMATION_FAIL: "automation.fail",

  // Auth
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
} as const;

export type ActionName = (typeof Actions)[keyof typeof Actions] | `page.${string}`;
```

- [ ] **Step 2: Create tracker.ts**

```typescript
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

/**
 * Hash an IP address using HMAC-SHA256 with a server secret.
 * Returns null if ip is null/undefined.
 */
function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHmac("sha256", IP_HASH_SECRET).update(ip).digest("hex");
}

/**
 * Track a single analytics event.
 */
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
        metadata: input.metadata ?? undefined,
        userAgent: input.userAgent ?? undefined,
        ip: hashIp(input.ip),
      },
    });
  } catch (err) {
    // Fire-and-forget: log but don't throw
    console.error("[analytics] trackEvent failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Track multiple events in a single batch (used by /api/analytics/track).
 */
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
        metadata: input.metadata ?? undefined,
        userAgent: input.userAgent ?? undefined,
        ip: hashIp(input.ip),
      })),
    });
  } catch (err) {
    console.error("[analytics] trackEvents failed:", err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/analytics/constants.ts apps/web/lib/analytics/tracker.ts
git commit -m "feat: add analytics constants and server-side trackEvent/trackEvents"
```

---

## Task 5: Rate limiter + Track API route

**Files:**
- Create: `apps/web/lib/analytics/rate-limit.ts`
- Create: `apps/web/app/api/analytics/track/route.ts`

- [ ] **Step 1: Install @upstash/ratelimit**

Run: `cd /Volumes/포터블/AXLE/apps/web && npm install @upstash/ratelimit`

- [ ] **Step 2: Create rate-limit.ts**

```typescript
/**
 * Rate limiter for the analytics track endpoint.
 * Uses Upstash Redis sliding window: 100 requests per minute per sessionId.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

export function getAnalyticsRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("[analytics] Upstash Redis not configured — rate limiting disabled");
    return null;
  }

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "analytics:",
  });

  return ratelimit;
}
```

- [ ] **Step 3: Create track/route.ts**

```typescript
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
  label: z.string().max(500).nullish(),
  value: z.number().nullish(),
  path: z.string().max(2000).nullish(),
  referrer: z.string().max(2000).nullish(),
  metadata: z.record(z.unknown()).nullish(),
});

const TrackRequestSchema = z.object({
  sessionId: z.string().regex(CUID_REGEX).or(z.string().regex(UUID_REGEX)),
  events: z.array(EventSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    // Enforce body size (100KB)
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

    // Rate limit by sessionId
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

    // Optionally enrich with auth context
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
```

- [ ] **Step 4: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/analytics/rate-limit.ts apps/web/app/api/analytics/track/route.ts apps/web/package.json
git commit -m "feat: add /api/analytics/track endpoint with rate limiting and Zod validation"
```

---

## Task 6: Client-side useTracker hook

**Files:**
- Create: `apps/web/hooks/use-tracker.ts`

- [ ] **Step 1: Create use-tracker.ts**

```typescript
"use client";

/**
 * useTracker — client-side analytics hook.
 *
 * Automatically tracks PAGE_VIEW on route changes via usePathname().
 * Provides track() for manual FEATURE_USE events.
 * Batches events and sends via sendBeacon on unload or 30s flush.
 * Falls back to localStorage if sendBeacon fails.
 */
import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

type EventPayload = {
  category: "PAGE_VIEW" | "FEATURE_USE";
  action: string;
  label?: string | null;
  value?: number | null;
  path?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
};

const FLUSH_INTERVAL_MS = 30_000;
const TRACK_ENDPOINT = "/api/analytics/track";
const STORAGE_KEY = "axle_analytics_buffer";
const MAX_STORAGE_EVENTS = 100;

function getSessionId(): string {
  // Read from cookie set by middleware
  const match = document.cookie.match(/(?:^|;\s*)axle_sid=([^;]+)/);
  return match?.[1] ?? "anonymous";
}

function sendBatch(events: EventPayload[]): boolean {
  if (events.length === 0) return true;

  const payload = JSON.stringify({
    sessionId: getSessionId(),
    events,
  });

  if (typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      TRACK_ENDPOINT,
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return true;
  }

  // Fallback: fire-and-forget fetch
  fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // If fetch also fails, buffer to localStorage
    bufferToStorage(events);
  });

  return false;
}

function bufferToStorage(events: EventPayload[]): void {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as EventPayload[];
    const merged = [...existing, ...events].slice(-MAX_STORAGE_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage unavailable — drop events
  }
}

function drainStorage(): EventPayload[] {
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as EventPayload[];
    if (events.length > 0) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return events;
  } catch {
    return [];
  }
}

export function useTracker() {
  const queueRef = useRef<EventPayload[]>([]);
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    const events = queueRef.current.splice(0);
    if (events.length > 0) {
      sendBatch(events);
    }
  }, []);

  const track = useCallback(
    (
      category: "PAGE_VIEW" | "FEATURE_USE",
      action: string,
      opts?: { label?: string; value?: number; metadata?: Record<string, unknown> },
    ) => {
      queueRef.current.push({
        category,
        action,
        label: opts?.label ?? null,
        value: opts?.value ?? null,
        path: window.location.pathname,
        referrer: document.referrer || null,
        metadata: opts?.metadata ?? null,
      });

      // Flush immediately if queue is large
      if (queueRef.current.length >= 50) {
        flush();
      }
    },
    [flush],
  );

  // Auto-track PAGE_VIEW on route change
  useEffect(() => {
    if (pathname && pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      track("PAGE_VIEW", `page.${pathname}`);
    }
  }, [pathname, track]);

  // Drain localStorage buffer on mount
  useEffect(() => {
    const buffered = drainStorage();
    if (buffered.length > 0) {
      sendBatch(buffered);
    }
  }, []);

  // Periodic flush + flush on unload
  useEffect(() => {
    const interval = setInterval(flush, FLUSH_INTERVAL_MS);

    const handleUnload = () => {
      flush();
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      flush(); // Flush remaining events on unmount
    };
  }, [flush]);

  return { track };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/use-tracker.ts
git commit -m "feat: add useTracker client hook — auto PAGE_VIEW + manual track + sendBeacon batching"
```

---

## Task 7: EventBus subscriber for BUSINESS events

**Files:**
- Create: `apps/web/lib/analytics/event-bus-subscriber.ts`

- [ ] **Step 1: Create event-bus-subscriber.ts**

```typescript
/**
 * Subscribes to the existing eventBus and auto-tracks BUSINESS category events.
 *
 * Call registerAnalyticsSubscriber() once at app startup (e.g., in instrumentation.ts
 * or a top-level server module). This avoids duplicating trackEvent() calls in every
 * API route that already emits to the eventBus.
 */
import { eventBus } from "@/lib/events/event-bus";
import type { BusinessEventKey, EventMap } from "@/lib/events/event-bus";
import { trackEvent } from "./tracker";

/** Map eventBus event names to analytics action names */
const EVENT_ACTION_MAP: Record<BusinessEventKey, string> = {
  DOC_UPLOADED: "doc.upload",
  DOC_REQUESTED: "doc.request",
  DOC_EXPIRING: "doc.expiring",
  DEADLINE_APPROACHING: "deadline.approaching",
  MEETING_SCHEDULED: "meeting.create",
  JOURNAL_DUE: "journal.due",
  ACTION_ITEM_CREATED: "action_item.create",
  ACTION_ITEM_DUE: "action_item.due",
  PROJECT_ASSIGNED: "project.assign",
  MATCHING_RESULT: "matching.result",
  AI_JOB_COMPLETE: "ai.job.complete",
  AI_JOB_FAILED: "ai.job.failed",
  PORTAL_COMPLETE: "portal.complete",
  HANDOFF: "project.handoff",
};

/** Extract userId from event payload (varies by event type) */
function extractUserId(event: BusinessEventKey, payload: EventMap[typeof event]): string | undefined {
  const p = payload as Record<string, unknown>;
  return (p.uploaderId ?? p.assigneeId ?? p.userId ?? p.fromUserId) as string | undefined;
}

let registered = false;

export function registerAnalyticsSubscriber(): void {
  if (registered) return;
  registered = true;

  for (const [eventName, action] of Object.entries(EVENT_ACTION_MAP)) {
    const key = eventName as BusinessEventKey;
    eventBus.on(key, (payload) => {
      const userId = extractUserId(key, payload);
      trackEvent({
        category: "BUSINESS",
        action,
        userId,
        metadata: payload as Record<string, unknown>,
      }).catch(() => {
        // Already logged inside trackEvent
      });
    });
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/analytics/event-bus-subscriber.ts
git commit -m "feat: add eventBus subscriber to auto-track 14 BUSINESS events to analytics"
```

---

## Task 8: Aggregator queries

**Files:**
- Create: `apps/web/lib/analytics/aggregator.ts`

- [ ] **Step 1: Create aggregator.ts**

```typescript
/**
 * Analytics aggregation queries — used by cron jobs and API routes.
 */
import { prisma } from "@axle/db";

// ── Types ────────────────────────────────────────────────────────────────────

export type OverviewStats = {
  pageViews: number;
  uniqueUsers: number;
  sessions: number;
  aiJobsTotal: number;
  aiJobsCost: number;
  apiCalls: number;
  apiErrors: number;
};

export type DailyTrend = {
  date: string;
  pageViews: number;
  uniqueUsers: number;
  sessions: number;
};

export type ActionCount = {
  action: string;
  count: number;
};

// ── Today (realtime from raw events) ─────────────────────────────────────────

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function getTodayOverview(orgId?: string | null): Promise<OverviewStats> {
  const start = todayStart();
  const where = {
    createdAt: { gte: start },
    ...(orgId ? { orgId } : {}),
  };

  const [pageViews, uniqueUsers, sessions, aiJobs, apiCalls, apiErrors] = await Promise.all([
    prisma.analyticsEvent.count({ where: { ...where, category: "PAGE_VIEW" } }),
    prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: { ...where, userId: { not: null } },
    }).then((r) => r.length),
    prisma.analyticsEvent.groupBy({
      by: ["sessionId"],
      where,
    }).then((r) => r.length),
    prisma.analyticsEvent.aggregate({
      where: { ...where, category: "BUSINESS", action: { startsWith: "ai.job" } },
      _count: true,
      _sum: { value: true },
    }),
    prisma.analyticsEvent.count({ where: { ...where, category: "API_CALL" } }),
    prisma.analyticsEvent.count({
      where: { ...where, category: "SYSTEM", action: { contains: "error" } },
    }),
  ]);

  return {
    pageViews,
    uniqueUsers,
    sessions,
    aiJobsTotal: aiJobs._count,
    aiJobsCost: aiJobs._sum.value ?? 0,
    apiCalls,
    apiErrors,
  };
}

// ── Daily trends (from DailyMetric) ──────────────────────────────────────────

export async function getDailyTrends(
  days: number,
  orgId?: string | null,
): Promise<DailyTrend[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const metrics = await prisma.dailyMetric.findMany({
    where: {
      date: { gte: since },
      orgId: orgId ?? null,
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      pageViews: true,
      uniqueUsers: true,
      sessions: true,
    },
  });

  return metrics.map((m) => ({
    date: m.date.toISOString().split("T")[0]!,
    pageViews: m.pageViews,
    uniqueUsers: m.uniqueUsers,
    sessions: m.sessions,
  }));
}

// ── Feature usage (from DailyActionMetric) ───────────────────────────────────

export async function getTopActions(
  days: number,
  limit: number = 20,
  orgId?: string | null,
): Promise<ActionCount[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const results = await prisma.dailyActionMetric.groupBy({
    by: ["action"],
    where: {
      date: { gte: since },
      orgId: orgId ?? null,
    },
    _sum: { count: true },
    orderBy: { _sum: { count: "desc" } },
    take: limit,
  });

  return results.map((r) => ({
    action: r.action,
    count: r._sum.count ?? 0,
  }));
}

// ── Aggregation job (called by cron) ─────────────────────────────────────────

export async function aggregateYesterday(): Promise<{ orgs: number; actions: number }> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const todayMidnight = new Date(yesterday);
  todayMidnight.setDate(todayMidnight.getDate() + 1);

  const dateOnly = new Date(yesterday.toISOString().split("T")[0]!);

  const baseWhere = {
    createdAt: { gte: yesterday, lt: todayMidnight },
  };

  // Get all orgIds that had events yesterday + null for platform total
  const orgGroups = await prisma.analyticsEvent.groupBy({
    by: ["orgId"],
    where: baseWhere,
  });
  const orgIds = [...new Set([null, ...orgGroups.map((g) => g.orgId)])];

  let actionCount = 0;

  for (const orgId of orgIds) {
    const where = { ...baseWhere, ...(orgId ? { orgId } : {}) };

    const [
      pageViews,
      uniqueUsersResult,
      sessionsResult,
      aiAgg,
      apiCalls,
      apiErrors,
      projectsCreated,
      documentsProcessed,
      matchingsRun,
      automationRuns,
      automationFailures,
    ] = await Promise.all([
      prisma.analyticsEvent.count({ where: { ...where, category: "PAGE_VIEW" } }),
      prisma.analyticsEvent.groupBy({ by: ["userId"], where: { ...where, userId: { not: null } } }),
      prisma.analyticsEvent.groupBy({ by: ["sessionId"], where }),
      prisma.analyticsEvent.aggregate({
        where: { ...where, category: "BUSINESS", action: { startsWith: "ai.job" } },
        _count: true,
        _sum: { value: true },
        _avg: { value: true },
      }),
      prisma.analyticsEvent.count({ where: { ...where, category: "API_CALL" } }),
      prisma.analyticsEvent.count({ where: { ...where, category: "SYSTEM", action: { contains: "error" } } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "project.create" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "doc.upload" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "matching.run" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "automation.run" } }),
      prisma.analyticsEvent.count({ where: { ...where, action: "automation.fail" } }),
    ]);

    await prisma.dailyMetric.upsert({
      where: { date_orgId: { date: dateOnly, orgId: orgId ?? "" } },
      create: {
        date: dateOnly,
        orgId,
        pageViews,
        uniqueUsers: uniqueUsersResult.length,
        sessions: sessionsResult.length,
        avgSessionSec: 0,
        projectsCreated,
        documentsProcessed,
        matchingsRun,
        aiJobsTotal: aiAgg._count,
        aiJobsCost: aiAgg._sum.value ?? 0,
        aiAvgDurationMs: 0,
        apiCalls,
        apiErrors,
        avgResponseMs: 0,
        automationRuns,
        automationFailures,
      },
      update: {
        pageViews,
        uniqueUsers: uniqueUsersResult.length,
        sessions: sessionsResult.length,
        projectsCreated,
        documentsProcessed,
        matchingsRun,
        aiJobsTotal: aiAgg._count,
        aiJobsCost: aiAgg._sum.value ?? 0,
        apiCalls,
        apiErrors,
        automationRuns,
        automationFailures,
      },
    });

    // Aggregate action counts
    const actionGroups = await prisma.analyticsEvent.groupBy({
      by: ["action"],
      where,
      _count: true,
    });

    for (const ag of actionGroups) {
      await prisma.dailyActionMetric.upsert({
        where: { date_orgId_action: { date: dateOnly, orgId: orgId ?? "", action: ag.action } },
        create: { date: dateOnly, orgId, action: ag.action, count: ag._count },
        update: { count: ag._count },
      });
      actionCount++;
    }
  }

  return { orgs: orgIds.length, actions: actionCount };
}

// ── Cleanup (called by cron) ─────────────────────────────────────────────────

export async function cleanupOldEvents(retentionDays: number = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  let totalDeleted = 0;
  const BATCH_SIZE = 10_000;

  // Batch delete to avoid table lock
  while (true) {
    const batch = await prisma.analyticsEvent.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const deleted = await prisma.analyticsEvent.deleteMany({
      where: { id: { in: batch.map((b) => b.id) } },
    });

    totalDeleted += deleted.count;

    if (batch.length < BATCH_SIZE) break;
  }

  return totalDeleted;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/analytics/aggregator.ts
git commit -m "feat: add analytics aggregator — realtime queries, daily aggregation, batch cleanup"
```

---

## Task 9: Cron routes — aggregate-metrics + cleanup-events

**Files:**
- Create: `apps/web/app/api/cron/aggregate-metrics/route.ts`
- Create: `apps/web/app/api/cron/cleanup-events/route.ts`
- Modify: `apps/web/vercel.json`

- [ ] **Step 1: Create aggregate-metrics/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { aggregateYesterday } from "@/lib/analytics/aggregator";

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 },
    );
  }

  try {
    const result = await aggregateYesterday();
    return NextResponse.json({
      data: {
        message: "Aggregation complete",
        orgsProcessed: result.orgs,
        actionMetrics: result.actions,
      },
    });
  } catch (err) {
    console.error("[cron] aggregate-metrics failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Aggregation failed" } },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create cleanup-events/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { cleanupOldEvents } from "@/lib/analytics/aggregator";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 },
    );
  }

  try {
    const deleted = await cleanupOldEvents(90);
    return NextResponse.json({
      data: {
        message: "Cleanup complete",
        eventsDeleted: deleted,
      },
    });
  } catch (err) {
    console.error("[cron] cleanup-events failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Cleanup failed" } },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Add cron entries to vercel.json**

Add 2 entries to the `crons` array in `apps/web/vercel.json`:

```json
{ "path": "/api/cron/aggregate-metrics", "schedule": "0 18 * * *" },
{ "path": "/api/cron/cleanup-events", "schedule": "0 19 * * 0" }
```

Note: `0 18 * * *` = 03:00 KST (UTC+9). `0 19 * * 0` = 04:00 KST Sunday (weekly cleanup).

- [ ] **Step 4: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/cron/aggregate-metrics/route.ts apps/web/app/api/cron/cleanup-events/route.ts apps/web/vercel.json
git commit -m "feat: add analytics cron jobs — daily aggregation (03:00 KST) + weekly cleanup (Sun 04:00 KST)"
```

---

## Task 10: Platform analytics API routes (Super Admin)

**Files:**
- Create: `apps/web/app/api/analytics/platform/overview/route.ts`
- Create: `apps/web/app/api/analytics/platform/users/route.ts`
- Create: `apps/web/app/api/analytics/platform/features/route.ts`
- Create: `apps/web/app/api/analytics/platform/system/route.ts`
- Create: `apps/web/app/api/analytics/platform/ai/route.ts`

- [ ] **Step 1: Create platform/overview/route.ts**

```typescript
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { getTodayOverview, getDailyTrends } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const [today, trends7d] = await Promise.all([
      getTodayOverview(),
      getDailyTrends(7),
    ]);

    return NextResponse.json({
      data: { today, trends7d },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Create platform/users/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { getDailyTrends } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);

    const trends = await getDailyTrends(days);

    return NextResponse.json({ data: { trends } });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 3: Create platform/features/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { getTopActions } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

    const actions = await getTopActions(days, limit);

    return NextResponse.json({ data: { actions } });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 4: Create platform/system/route.ts**

```typescript
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const metrics = await prisma.dailyMetric.findMany({
      where: { date: { gte: since }, orgId: null },
      orderBy: { date: "asc" },
      select: {
        date: true,
        apiCalls: true,
        apiErrors: true,
        avgResponseMs: true,
        automationRuns: true,
        automationFailures: true,
      },
    });

    const totals = metrics.reduce(
      (acc, m) => ({
        apiCalls: acc.apiCalls + m.apiCalls,
        apiErrors: acc.apiErrors + m.apiErrors,
        automationRuns: acc.automationRuns + m.automationRuns,
        automationFailures: acc.automationFailures + m.automationFailures,
      }),
      { apiCalls: 0, apiErrors: 0, automationRuns: 0, automationFailures: 0 },
    );

    return NextResponse.json({
      data: {
        totals,
        errorRate: totals.apiCalls > 0 ? (totals.apiErrors / totals.apiCalls) * 100 : 0,
        daily: metrics.map((m) => ({
          date: m.date.toISOString().split("T")[0],
          apiCalls: m.apiCalls,
          apiErrors: m.apiErrors,
          avgResponseMs: m.avgResponseMs,
          automationRuns: m.automationRuns,
          automationFailures: m.automationFailures,
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 5: Create platform/ai/route.ts**

```typescript
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const metrics = await prisma.dailyMetric.findMany({
      where: { date: { gte: since }, orgId: null },
      orderBy: { date: "asc" },
      select: {
        date: true,
        aiJobsTotal: true,
        aiJobsCost: true,
        aiAvgDurationMs: true,
      },
    });

    const totals = metrics.reduce(
      (acc, m) => ({
        aiJobsTotal: acc.aiJobsTotal + m.aiJobsTotal,
        aiJobsCost: acc.aiJobsCost + m.aiJobsCost,
      }),
      { aiJobsTotal: 0, aiJobsCost: 0 },
    );

    return NextResponse.json({
      data: {
        totals,
        avgCostPerJob: totals.aiJobsTotal > 0 ? totals.aiJobsCost / totals.aiJobsTotal : 0,
        daily: metrics.map((m) => ({
          date: m.date.toISOString().split("T")[0],
          jobs: m.aiJobsTotal,
          cost: m.aiJobsCost,
          avgDurationMs: m.aiAvgDurationMs,
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 6: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/analytics/platform/
git commit -m "feat: add platform analytics API routes — overview, users, features, system, ai"
```

---

## Task 11: Org analytics API routes (Org Admin)

**Files:**
- Create: `apps/web/app/api/analytics/org/overview/route.ts`
- Create: `apps/web/app/api/analytics/org/members/route.ts`
- Create: `apps/web/app/api/analytics/org/usage/route.ts`

- [ ] **Step 1: Create org/overview/route.ts**

```typescript
import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@axle/auth";
import { getTodayOverview, getDailyTrends } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requireOrgAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const [today, trends7d] = await Promise.all([
      getTodayOverview(user.orgId),
      getDailyTrends(7, user.orgId),
    ]);

    return NextResponse.json({
      data: { today, trends7d },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Create org/members/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requireOrgAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get member activity summary
    const memberActivity = await prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: {
        orgId: user.orgId,
        userId: { not: null },
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
    });

    // Enrich with user names
    const userIds = memberActivity.map((m) => m.userId!);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const members = memberActivity.map((m) => ({
      user: userMap.get(m.userId!) ?? { id: m.userId, name: null, email: null, image: null },
      eventCount: m._count,
    }));

    return NextResponse.json({ data: { members } });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 3: Create org/usage/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@axle/auth";
import { getTopActions } from "@/lib/analytics/aggregator";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requireOrgAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);

    const actions = await getTopActions(days, 20, user.orgId);

    return NextResponse.json({ data: { actions } });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 4: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: Pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/analytics/org/
git commit -m "feat: add org analytics API routes — overview, members, usage"
```

---

## Task 12: Build verification + final typecheck

**Files:** None (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: All packages pass.

- [ ] **Step 2: Full lint**

Run: `cd /Volumes/포터블/AXLE && npx turbo lint`

Expected: No errors. Fix any lint issues.

- [ ] **Step 3: Full build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build`

Expected: Build succeeds.

- [ ] **Step 4: Verify environment variables documented**

Create or update `.env.example` with:

```
# Analytics
IP_HASH_SECRET=your-secret-here
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
CRON_SECRET=your-cron-secret
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint/build issues and document analytics env vars"
```
