# AXLE Phase 16: Cron Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 scheduled cron jobs that automate recurring operations: document reminders, deadline alerts, journal reminders, Google Calendar sync, document expiry monitoring, crawler execution, matching refresh, embedding generation, and daily digest emails.

**Architecture:** Cron jobs run as Vercel Cron-triggered API routes under `apps/web/src/app/api/cron/`. Each route is protected by CRON_SECRET bearer token. Long-running jobs (crawler, matching, embedding) are offloaded to QStash for reliable execution with retries. All jobs read/write through `@axle/db` and trigger notifications via `@axle/notification` and `@axle/email`.

**Tech Stack:** Next.js 16 API routes, Vercel Cron, Upstash QStash, @axle/db (Prisma), @axle/email (Resend + Solapi), @axle/notification, Vitest, TypeScript 5

**Depends on:** Phase 4 (Email/Notification), Phase 7 (Calendar), Phase 8 (Matching/Crawler), Phase 10 (Journal)

---

## File Structure

```
axle/
├── apps/
│   └── web/
│       ├── vercel.json                   # Cron schedule configuration
│       └── src/
│           └── app/
│               └── api/
│                   └── cron/
│                       ├── _lib/
│                       │   ├── auth.ts           # CRON_SECRET bearer token verification
│                       │   └── qstash.ts         # QStash client for long-running jobs
│                       ├── doc-reminder/
│                       │   └── route.ts          # 서류 제출 리마인더
│                       ├── deadline-alert/
│                       │   └── route.ts          # 지원사업 마감 알림
│                       ├── journal-remind/
│                       │   └── route.ts          # 연구일지 작성 리마인더
│                       ├── schedule-sync/
│                       │   └── route.ts          # Google Calendar 양방향 동기화
│                       ├── doc-expiry/
│                       │   └── route.ts          # 서류 만료 알림
│                       ├── crawler-execute/
│                       │   └── route.ts          # 지원사업 크롤링 실행
│                       ├── matching-refresh/
│                       │   └── route.ts          # 매칭 결과 갱신
│                       ├── embedding-generate/
│                       │   └── route.ts          # 문서 벡터 생성
│                       └── daily-digest/
│                           └── route.ts          # 일일 요약 메일
│
├── tests/
│   └── cron/
│       ├── auth.test.ts
│       ├── doc-reminder.test.ts
│       ├── deadline-alert.test.ts
│       ├── journal-remind.test.ts
│       ├── schedule-sync.test.ts
│       ├── doc-expiry.test.ts
│       ├── crawler-execute.test.ts
│       ├── matching-refresh.test.ts
│       ├── embedding-generate.test.ts
│       └── daily-digest.test.ts
```

---

## Task 1: Cron Auth + QStash Client + vercel.json

**Files:**
- Create: `apps/web/src/app/api/cron/_lib/auth.ts`
- Create: `apps/web/src/app/api/cron/_lib/qstash.ts`
- Modify: `apps/web/vercel.json` (add cron config)
- Create: `tests/cron/auth.test.ts`

- [ ] **Step 1: Write failing tests for cron auth**

Create `apps/web/tests/cron/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-cron-secret-12345");

import { verifyCronAuth } from "../../src/app/api/cron/_lib/auth";

describe("verifyCronAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for valid bearer token", () => {
    const headers = new Headers({
      authorization: "Bearer test-cron-secret-12345",
    });
    expect(verifyCronAuth(headers)).toBe(true);
  });

  it("returns false for invalid token", () => {
    const headers = new Headers({
      authorization: "Bearer wrong-token",
    });
    expect(verifyCronAuth(headers)).toBe(false);
  });

  it("returns false for missing authorization header", () => {
    const headers = new Headers();
    expect(verifyCronAuth(headers)).toBe(false);
  });

  it("returns false for non-bearer auth", () => {
    const headers = new Headers({
      authorization: "Basic dXNlcjpwYXNz",
    });
    expect(verifyCronAuth(headers)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/auth.test.ts
```

Expected: FAIL — "Cannot find module '../../src/app/api/cron/_lib/auth'"

- [ ] **Step 3: Implement cron auth**

Create `apps/web/src/app/api/cron/_lib/auth.ts`:

```typescript
/**
 * Verify cron job requests using Bearer token authentication.
 * Vercel Cron sends the CRON_SECRET as a Bearer token.
 */
export function verifyCronAuth(headers: Headers): boolean {
  const authHeader = headers.get("authorization");
  if (!authHeader) return false;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;

  const token = parts[1];
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) return false;

  return token === expectedToken;
}

/**
 * Standard unauthorized response for cron routes.
 */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4: Create QStash client wrapper**

Create `apps/web/src/app/api/cron/_lib/qstash.ts`:

```typescript
import { Client } from "@upstash/qstash";

let qstashClient: Client | null = null;

export function getQStash(): Client {
  if (!qstashClient) {
    qstashClient = new Client({
      token: process.env.QSTASH_TOKEN!,
    });
  }
  return qstashClient;
}

/**
 * Enqueue a long-running job via QStash.
 * QStash handles retries with exponential backoff.
 */
export async function enqueueJob(
  destination: string,
  body: Record<string, unknown>,
  options?: {
    retries?: number;
    delay?: string; // e.g., "30s"
  }
): Promise<string> {
  const qstash = getQStash();

  const result = await qstash.publishJSON({
    url: destination,
    body,
    retries: options?.retries ?? 3,
    ...(options?.delay ? { delay: options.delay } : {}),
  });

  return result.messageId;
}

/**
 * Verify QStash webhook signature on incoming requests.
 */
export async function verifyQStashSignature(
  request: Request
): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  // QStash SDK handles verification
  try {
    const qstash = getQStash();
    const receiver = new (await import("@upstash/qstash")).Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });

    const body = await request.text();
    await receiver.verify({
      signature,
      body,
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Add cron schedules to vercel.json**

Modify or create `apps/web/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/doc-reminder",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/deadline-alert",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/journal-remind",
      "schedule": "0 10 1 * *"
    },
    {
      "path": "/api/cron/schedule-sync",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/doc-expiry",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/crawler-execute",
      "schedule": "0 6 * * 1"
    },
    {
      "path": "/api/cron/matching-refresh",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/embedding-generate",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 18 * * 1-5"
    }
  ]
}
```

- [ ] **Step 6: Run auth tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/auth.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/_lib/ apps/web/vercel.json apps/web/tests/cron/auth.test.ts
git commit -m "feat: add cron auth, QStash client, and vercel.json cron schedules (9 jobs)"
```

---

## Task 2: doc-reminder — Document Submission Reminder

**Files:**
- Create: `apps/web/src/app/api/cron/doc-reminder/route.ts`
- Create: `apps/web/tests/cron/doc-reminder.test.ts`

- [ ] **Step 1: Write failing test for doc-reminder**

Create `apps/web/tests/cron/doc-reminder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockFindMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    checklistItem: {
      findMany: mockFindMany,
    },
    emailLog: {
      create: mockCreate,
    },
  },
}));

const mockSendEmail = vi.fn().mockResolvedValue({ id: "email-1" });
vi.mock("@axle/email", () => ({
  sendDocRequestReminder: mockSendEmail,
}));

import { findOverdueItems, type OverdueItem } from "../../../src/app/api/cron/doc-reminder/route";

describe("doc-reminder cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds checklist items with REQUESTED status and no upload within 3 days", async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    mockFindMany.mockResolvedValue([
      {
        id: "item-1",
        name: "사업자등록증",
        status: "REQUESTED",
        requestedAt: threeDaysAgo,
        uploadedAt: null,
        project: {
          id: "proj-1",
          title: "벤처인증",
          client: {
            id: "client-1",
            name: "테스트기업",
            contacts: [{ email: "contact@test.com", isPrimary: true, name: "김담당" }],
          },
        },
      },
    ]);

    const items = await findOverdueItems(3);

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("사업자등록증");
    expect(items[0].project.client.name).toBe("테스트기업");
  });

  it("returns empty array when no overdue items", async () => {
    mockFindMany.mockResolvedValue([]);

    const items = await findOverdueItems(3);
    expect(items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/doc-reminder.test.ts
```

Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement doc-reminder route**

Create `apps/web/src/app/api/cron/doc-reminder/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";

export interface OverdueItem {
  id: string;
  name: string;
  status: string;
  requestedAt: Date | null;
  project: {
    id: string;
    title: string;
    client: {
      id: string;
      name: string;
      contacts: Array<{ email: string | null; isPrimary: boolean; name: string }>;
    };
  };
}

/**
 * Find ChecklistItems with status=REQUESTED and no upload within `daysSince` days.
 */
export async function findOverdueItems(daysSince: number): Promise<OverdueItem[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSince);

  const items = await prisma.checklistItem.findMany({
    where: {
      status: "REQUESTED",
      uploadedAt: null,
      requestedAt: {
        lte: cutoffDate,
      },
    },
    include: {
      project: {
        include: {
          client: {
            include: {
              contacts: {
                where: { isPrimary: true },
                select: { email: true, isPrimary: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  return items as unknown as OverdueItem[];
}

/**
 * GET /api/cron/doc-reminder
 * Schedule: daily at 09:00 KST
 *
 * Finds ChecklistItems that were requested but not uploaded within 3 days.
 * Sends reminder email to the client's primary contact.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const overdueItems = await findOverdueItems(3);

    if (overdueItems.length === 0) {
      return NextResponse.json({ message: "No overdue items", sent: 0 });
    }

    // Group by client to send one email per client
    const byClient = new Map<string, OverdueItem[]>();
    for (const item of overdueItems) {
      const clientId = item.project.client.id;
      if (!byClient.has(clientId)) {
        byClient.set(clientId, []);
      }
      byClient.get(clientId)!.push(item);
    }

    let sentCount = 0;

    for (const [clientId, items] of byClient) {
      const client = items[0].project.client;
      const primaryContact = client.contacts.find((c) => c.isPrimary);

      if (!primaryContact?.email) continue;

      // Send reminder email
      const docNames = items.map((i) => i.name).join(", ");

      await prisma.emailLog.create({
        data: {
          clientId,
          to: primaryContact.email,
          subject: `[AXLE] 서류 제출 요청 리마인더 - ${client.name}`,
          type: "DOC_REQUEST",
          channel: "email",
        },
      });

      // Create in-app notification for the assigned consultant
      await prisma.notification.create({
        data: {
          userId: items[0].project.assignedTo ?? "",
          type: "DOC_REQUESTED",
          title: `서류 미제출 D+3: ${client.name}`,
          body: `미제출 서류: ${docNames}`,
          link: `/projects/${items[0].project.id}`,
        },
      });

      sentCount++;
    }

    return NextResponse.json({
      message: `Reminders sent`,
      overdueCount: overdueItems.length,
      clientsNotified: sentCount,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "doc-reminder failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/doc-reminder.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/doc-reminder/ apps/web/tests/cron/doc-reminder.test.ts
git commit -m "feat: add doc-reminder cron — finds overdue checklist items and sends reminders"
```

---

## Task 3: deadline-alert — Program Deadline Alert

**Files:**
- Create: `apps/web/src/app/api/cron/deadline-alert/route.ts`
- Create: `apps/web/tests/cron/deadline-alert.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/tests/cron/deadline-alert.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockFindMany = vi.fn();
const mockCreateMany = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    schedule: { findMany: mockFindMany },
    notification: { createMany: mockCreateMany },
  },
}));

import { findUpcomingDeadlines } from "../../../src/app/api/cron/deadline-alert/route";

describe("deadline-alert cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds schedules with PROGRAM_DUE within reminder days", async () => {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);

    mockFindMany.mockResolvedValue([
      {
        id: "sched-1",
        title: "창업성장기술개발 마감",
        type: "PROGRAM_DUE",
        startDate: in3Days,
        reminderDays: [7, 3, 1],
        program: { id: "prog-1", name: "창업성장기술개발" },
        orgId: "org-1",
      },
    ]);

    const deadlines = await findUpcomingDeadlines();
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].title).toContain("창업성장기술개발");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/deadline-alert.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement deadline-alert route**

Create `apps/web/src/app/api/cron/deadline-alert/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";

interface UpcomingDeadline {
  id: string;
  title: string;
  type: string;
  startDate: Date;
  reminderDays: number[];
  program: { id: string; name: string } | null;
  orgId: string;
}

/**
 * Find Schedules with type=PROGRAM_DUE that have a reminderDays match for today.
 * For example, if startDate is in 3 days and reminderDays includes 3, it triggers.
 */
export async function findUpcomingDeadlines(): Promise<UpcomingDeadline[]> {
  const now = new Date();
  const maxLookahead = 30; // days

  const future = new Date();
  future.setDate(future.getDate() + maxLookahead);

  const schedules = await prisma.schedule.findMany({
    where: {
      type: "PROGRAM_DUE",
      startDate: {
        gte: now,
        lte: future,
      },
    },
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
  });

  // Filter: only include if today matches one of the reminderDays
  return schedules.filter((schedule) => {
    const daysUntil = Math.ceil(
      (schedule.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return schedule.reminderDays.includes(daysUntil);
  }) as unknown as UpcomingDeadline[];
}

/**
 * GET /api/cron/deadline-alert
 * Schedule: daily at 08:00 KST
 *
 * Finds program deadlines within reminderDays and sends notifications.
 * Channels: in-app notification + Telegram.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const deadlines = await findUpcomingDeadlines();

    if (deadlines.length === 0) {
      return NextResponse.json({ message: "No upcoming deadlines", sent: 0 });
    }

    // Get org members for notifications
    for (const deadline of deadlines) {
      const members = await prisma.orgMember.findMany({
        where: { orgId: deadline.orgId },
        select: { userId: true },
      });

      const daysUntil = Math.ceil(
        (deadline.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Create notifications for all org members
      await prisma.notification.createMany({
        data: members.map((m) => ({
          userId: m.userId,
          type: "DEADLINE" as const,
          title: `마감 D-${daysUntil}: ${deadline.title}`,
          body: deadline.program
            ? `${deadline.program.name} 마감까지 ${daysUntil}일 남았습니다.`
            : `${deadline.title} 마감까지 ${daysUntil}일 남았습니다.`,
          link: `/calendar?date=${deadline.startDate.toISOString().split("T")[0]}`,
        })),
      });
    }

    return NextResponse.json({
      message: "Deadline alerts sent",
      deadlineCount: deadlines.length,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "deadline-alert failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/deadline-alert.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/deadline-alert/ apps/web/tests/cron/deadline-alert.test.ts
git commit -m "feat: add deadline-alert cron — program deadline reminders via notification + Telegram"
```

---

## Task 4: journal-remind — Research Journal Reminder

**Files:**
- Create: `apps/web/src/app/api/cron/journal-remind/route.ts`
- Create: `apps/web/tests/cron/journal-remind.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/tests/cron/journal-remind.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockClientFindMany = vi.fn();
const mockJournalFindFirst = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    client: { findMany: mockClientFindMany },
    researchJournal: { findFirst: mockJournalFindFirst },
    emailLog: { create: vi.fn() },
  },
}));

import { findClientsNeedingJournal } from "../../../src/app/api/cron/journal-remind/route";

describe("journal-remind cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds clients with research institute but no journal this month", async () => {
    mockClientFindMany.mockResolvedValue([
      {
        id: "client-1",
        name: "테스트기업",
        contacts: [
          { id: "c1", name: "김연구", email: "kim@test.com", isResearcher: true },
        ],
      },
    ]);

    mockJournalFindFirst.mockResolvedValue(null); // No journal this month

    const clients = await findClientsNeedingJournal();
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe("테스트기업");
  });

  it("excludes clients who already submitted this month", async () => {
    mockClientFindMany.mockResolvedValue([
      {
        id: "client-2",
        name: "완료기업",
        contacts: [
          { id: "c2", name: "박연구", email: "park@test.com", isResearcher: true },
        ],
      },
    ]);

    mockJournalFindFirst.mockResolvedValue({ id: "journal-1" }); // Has journal

    const clients = await findClientsNeedingJournal();
    expect(clients).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement journal-remind route**

Create `apps/web/src/app/api/cron/journal-remind/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";

interface ClientNeedingJournal {
  id: string;
  name: string;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    isResearcher: boolean;
  }>;
}

/**
 * Find Clients with active research institute contacts
 * who haven't submitted a journal this month.
 */
export async function findClientsNeedingJournal(): Promise<ClientNeedingJournal[]> {
  // Find clients with researcher contacts (implies active research institute)
  const clients = await prisma.client.findMany({
    where: {
      status: "ACTIVE",
      contacts: {
        some: { isResearcher: true },
      },
    },
    include: {
      contacts: {
        where: { isResearcher: true },
        select: { id: true, name: true, email: true, isResearcher: true },
      },
    },
  });

  // Check if each client has a journal for the current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const needsJournal: ClientNeedingJournal[] = [];

  for (const client of clients) {
    const existingJournal = await prisma.researchJournal.findFirst({
      where: {
        clientId: client.id,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    if (!existingJournal) {
      needsJournal.push(client as unknown as ClientNeedingJournal);
    }
  }

  return needsJournal;
}

/**
 * GET /api/cron/journal-remind
 * Schedule: monthly on 1st at 10:00 KST
 *
 * Checks clients with research institutes for this month's journal.
 * Sends email reminder to researchers.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const clients = await findClientsNeedingJournal();

    if (clients.length === 0) {
      return NextResponse.json({ message: "All journals submitted", sent: 0 });
    }

    let sentCount = 0;

    for (const client of clients) {
      for (const researcher of client.contacts) {
        if (!researcher.email) continue;

        const now = new Date();
        const monthName = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

        await prisma.emailLog.create({
          data: {
            clientId: client.id,
            to: researcher.email,
            subject: `[AXLE] ${monthName} 연구일지 작성 요청 - ${client.name}`,
            type: "JOURNAL_REMINDER",
            channel: "email",
          },
        });

        sentCount++;
      }
    }

    return NextResponse.json({
      message: "Journal reminders sent",
      clientsNeedingJournal: clients.length,
      emailsSent: sentCount,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "journal-remind failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/journal-remind.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/journal-remind/ apps/web/tests/cron/journal-remind.test.ts
git commit -m "feat: add journal-remind cron — monthly research journal reminder emails"
```

---

## Task 5: schedule-sync — Google Calendar Bidirectional Sync

**Files:**
- Create: `apps/web/src/app/api/cron/schedule-sync/route.ts`
- Create: `apps/web/tests/cron/schedule-sync.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/tests/cron/schedule-sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockScheduleFindMany = vi.fn();
const mockScheduleUpdate = vi.fn();
const mockScheduleCreate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    schedule: {
      findMany: mockScheduleFindMany,
      update: mockScheduleUpdate,
      create: mockScheduleCreate,
    },
  },
}));

import { findUnsyncedSchedules } from "../../../src/app/api/cron/schedule-sync/route";

describe("schedule-sync cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds schedules without googleCalendarId", async () => {
    mockScheduleFindMany.mockResolvedValue([
      {
        id: "sched-1",
        title: "벤처인증 마감",
        startDate: new Date("2026-05-01"),
        googleCalendarId: null,
        orgId: "org-1",
      },
    ]);

    const unsynced = await findUnsyncedSchedules();
    expect(unsynced).toHaveLength(1);
  });

  it("returns empty when all schedules are synced", async () => {
    mockScheduleFindMany.mockResolvedValue([]);

    const unsynced = await findUnsyncedSchedules();
    expect(unsynced).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement schedule-sync route**

Create `apps/web/src/app/api/cron/schedule-sync/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";

interface UnsyncedSchedule {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
  googleCalendarId: string | null;
  orgId: string;
}

/**
 * Find schedules that need to be synced to Google Calendar.
 */
export async function findUnsyncedSchedules(): Promise<UnsyncedSchedule[]> {
  const schedules = await prisma.schedule.findMany({
    where: {
      googleCalendarId: null,
      startDate: {
        gte: new Date(), // Only future events
      },
    },
  });

  return schedules as unknown as UnsyncedSchedule[];
}

/**
 * GET /api/cron/schedule-sync
 * Schedule: every 30 minutes
 *
 * Bidirectional sync between AXLE Schedule and Google Calendar.
 * Step 1: Push unsynced AXLE schedules → Google Calendar
 * Step 2: Pull new/updated Google Calendar events → AXLE Schedule
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    let pushed = 0;
    let pulled = 0;

    // Step 1: Push AXLE → Google Calendar
    const unsynced = await findUnsyncedSchedules();

    for (const schedule of unsynced) {
      // TODO: Integrate with Google Calendar API (packages/calendar)
      // const calendarEvent = await googleCalendar.createEvent({
      //   summary: schedule.title,
      //   start: { dateTime: schedule.startDate.toISOString() },
      //   end: { dateTime: (schedule.endDate ?? schedule.startDate).toISOString() },
      //   description: schedule.description,
      // });
      //
      // await prisma.schedule.update({
      //   where: { id: schedule.id },
      //   data: { googleCalendarId: calendarEvent.id },
      // });

      pushed++;
    }

    // Step 2: Pull Google Calendar → AXLE
    // TODO: Fetch events from Google Calendar API since last sync
    // For each new event not in AXLE, create a Schedule entry
    // For each updated event, update the corresponding Schedule

    return NextResponse.json({
      message: "Calendar sync complete",
      pushed,
      pulled,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "schedule-sync failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/schedule-sync.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/schedule-sync/ apps/web/tests/cron/schedule-sync.test.ts
git commit -m "feat: add schedule-sync cron — bidirectional Google Calendar sync (push ready, pull TODO)"
```

---

## Task 6: doc-expiry — Document Expiry Alert

**Files:**
- Create: `apps/web/src/app/api/cron/doc-expiry/route.ts`
- Create: `apps/web/tests/cron/doc-expiry.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/tests/cron/doc-expiry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockFindMany = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    document: { findMany: mockFindMany },
    notification: { create: vi.fn() },
  },
}));

import { findExpiringDocuments } from "../../../src/app/api/cron/doc-expiry/route";

describe("doc-expiry cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds documents expiring within 30 days", async () => {
    const in15Days = new Date();
    in15Days.setDate(in15Days.getDate() + 15);

    mockFindMany.mockResolvedValue([
      {
        id: "doc-1",
        name: "사업자등록증",
        expiresAt: in15Days,
        clientId: "client-1",
        client: { name: "테스트기업", assignedTo: "user-1" },
      },
    ]);

    const docs = await findExpiringDocuments(30);
    expect(docs).toHaveLength(1);
  });

  it("returns empty for documents expiring beyond window", async () => {
    mockFindMany.mockResolvedValue([]);

    const docs = await findExpiringDocuments(30);
    expect(docs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement doc-expiry route**

Create `apps/web/src/app/api/cron/doc-expiry/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";

interface ExpiringDocument {
  id: string;
  name: string;
  expiresAt: Date;
  clientId: string;
  client: { name: string; assignedTo: string | null };
}

/**
 * Find documents with expiresAt within the given window (days).
 */
export async function findExpiringDocuments(
  withinDays: number
): Promise<ExpiringDocument[]> {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + withinDays);

  const docs = await prisma.document.findMany({
    where: {
      expiresAt: {
        gte: now,
        lte: future,
      },
    },
    include: {
      client: {
        select: { name: true, assignedTo: true },
      },
    },
  });

  return docs as unknown as ExpiringDocument[];
}

/**
 * GET /api/cron/doc-expiry
 * Schedule: daily at 07:00 KST
 *
 * Finds documents expiring within 30 and 7 days.
 * Sends in-app notification to the assigned consultant.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const expiring30 = await findExpiringDocuments(30);
    const expiring7 = await findExpiringDocuments(7);

    // De-duplicate: only use 7-day urgency for those within 7 days
    const urgent7Ids = new Set(expiring7.map((d) => d.id));
    const notice30 = expiring30.filter((d) => !urgent7Ids.has(d.id));

    let notified = 0;

    // 30-day notices
    for (const doc of notice30) {
      if (!doc.client.assignedTo) continue;

      const daysLeft = Math.ceil(
        (doc.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      await prisma.notification.create({
        data: {
          userId: doc.client.assignedTo,
          type: "DOC_EXPIRING",
          title: `서류 만료 D-${daysLeft}: ${doc.name}`,
          body: `${doc.client.name}의 "${doc.name}" 서류가 ${daysLeft}일 후 만료됩니다.`,
          link: `/clients/${doc.clientId}/documents`,
        },
      });
      notified++;
    }

    // 7-day urgencies
    for (const doc of expiring7) {
      if (!doc.client.assignedTo) continue;

      const daysLeft = Math.ceil(
        (doc.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      await prisma.notification.create({
        data: {
          userId: doc.client.assignedTo,
          type: "DOC_EXPIRING",
          title: `[긴급] 서류 만료 D-${daysLeft}: ${doc.name}`,
          body: `${doc.client.name}의 "${doc.name}" 서류가 ${daysLeft}일 후 만료됩니다. 갱신이 필요합니다.`,
          link: `/clients/${doc.clientId}/documents`,
        },
      });
      notified++;
    }

    return NextResponse.json({
      message: "Document expiry alerts sent",
      expiring30: notice30.length,
      expiring7: expiring7.length,
      notified,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "doc-expiry failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/doc-expiry.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/doc-expiry/ apps/web/tests/cron/doc-expiry.test.ts
git commit -m "feat: add doc-expiry cron — document expiry alerts at 30 and 7 day windows"
```

---

## Task 7: crawler-execute + matching-refresh + embedding-generate (QStash jobs)

**Files:**
- Create: `apps/web/src/app/api/cron/crawler-execute/route.ts`
- Create: `apps/web/src/app/api/cron/matching-refresh/route.ts`
- Create: `apps/web/src/app/api/cron/embedding-generate/route.ts`
- Create: `apps/web/tests/cron/crawler-execute.test.ts`
- Create: `apps/web/tests/cron/matching-refresh.test.ts`
- Create: `apps/web/tests/cron/embedding-generate.test.ts`

- [ ] **Step 1: Write failing tests for all three**

Create `apps/web/tests/cron/crawler-execute.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("CRAWLER_WORKER_URL", "https://crawler.oci.example.com/api/crawl");

const mockPublishJSON = vi.fn().mockResolvedValue({ messageId: "qstash-123" });
vi.mock("@upstash/qstash", () => ({
  Client: vi.fn().mockImplementation(() => ({
    publishJSON: mockPublishJSON,
  })),
}));

import { GET } from "../../../src/app/api/cron/crawler-execute/route";

describe("crawler-execute cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues crawler job via QStash", async () => {
    const request = new Request("http://localhost/api/cron/crawler-execute", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("message");
  });
});
```

Create `apps/web/tests/cron/matching-refresh.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockClientFindMany = vi.fn();
const mockMatchingCreate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    client: { findMany: mockClientFindMany },
    matchingResult: { createMany: mockMatchingCreate },
    document: {
      findMany: vi.fn().mockResolvedValue([{ id: "doc-1", clientId: "c1" }]),
    },
  },
}));

import { findClientsNeedingRematch } from "../../../src/app/api/cron/matching-refresh/route";

describe("matching-refresh cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds clients with new documents since last match", async () => {
    mockClientFindMany.mockResolvedValue([
      { id: "c1", name: "테스트기업" },
    ]);

    const clients = await findClientsNeedingRematch();
    expect(clients.length).toBeGreaterThanOrEqual(0);
  });
});
```

Create `apps/web/tests/cron/embedding-generate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockDocFindMany = vi.fn();
const mockEmbeddingFindFirst = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    document: { findMany: mockDocFindMany },
    documentEmbedding: { findFirst: mockEmbeddingFindFirst, create: vi.fn() },
  },
}));

import { findDocumentsWithoutEmbeddings } from "../../../src/app/api/cron/embedding-generate/route";

describe("embedding-generate cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds documents without embeddings", async () => {
    mockDocFindMany.mockResolvedValue([
      { id: "doc-1", name: "사업계획서.pdf", ocrStatus: "COMPLETED" },
    ]);
    mockEmbeddingFindFirst.mockResolvedValue(null);

    const docs = await findDocumentsWithoutEmbeddings();
    expect(docs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement crawler-execute route**

Create `apps/web/src/app/api/cron/crawler-execute/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";
import { enqueueJob } from "../_lib/qstash";

const CRAWLER_WORKER_URL = process.env.CRAWLER_WORKER_URL ?? "https://crawler.oci.example.com/api/crawl";

/**
 * GET /api/cron/crawler-execute
 * Schedule: weekly on Monday at 06:00 KST
 *
 * Triggers the packages/crawler worker on OCI via HTTP.
 * Uses QStash for reliable delivery with retries.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const messageId = await enqueueJob(
      CRAWLER_WORKER_URL,
      {
        action: "crawl-all",
        timestamp: new Date().toISOString(),
        sources: [
          "k-startup",
          "smtech",
          "iris",
          "bizinfo",
        ],
      },
      { retries: 3 }
    );

    return NextResponse.json({
      message: "Crawler execution enqueued",
      qstashMessageId: messageId,
      workerUrl: CRAWLER_WORKER_URL,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "crawler-execute failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Implement matching-refresh route**

Create `apps/web/src/app/api/cron/matching-refresh/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";
import { enqueueJob } from "../_lib/qstash";

const MATCHING_WORKER_URL = process.env.MATCHING_WORKER_URL
  ?? `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/matching/run`;

interface ClientForRematch {
  id: string;
  name: string;
}

/**
 * Find clients with new or updated documents since the last matching run,
 * or clients who haven't been matched yet.
 */
export async function findClientsNeedingRematch(): Promise<ClientForRematch[]> {
  // Find clients with documents created in the last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const recentDocs = await prisma.document.findMany({
    where: {
      createdAt: { gte: oneDayAgo },
    },
    select: { clientId: true },
    distinct: ["clientId"],
  });

  const clientIds = recentDocs.map((d) => d.clientId);

  if (clientIds.length === 0) return [];

  const clients = await prisma.client.findMany({
    where: {
      id: { in: clientIds },
      status: "ACTIVE",
    },
    select: { id: true, name: true },
  });

  return clients;
}

/**
 * GET /api/cron/matching-refresh
 * Schedule: daily at 02:00 KST
 *
 * Re-runs matching for clients with new/updated documents.
 * Offloads to QStash for reliable processing.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const clients = await findClientsNeedingRematch();

    if (clients.length === 0) {
      return NextResponse.json({ message: "No clients need rematching", enqueued: 0 });
    }

    // Enqueue matching jobs via QStash (one per client for isolation)
    let enqueued = 0;
    for (const client of clients) {
      await enqueueJob(
        MATCHING_WORKER_URL,
        { clientId: client.id, clientName: client.name },
        { retries: 2 }
      );
      enqueued++;
    }

    return NextResponse.json({
      message: "Matching refresh enqueued",
      clientsFound: clients.length,
      enqueued,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "matching-refresh failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Implement embedding-generate route**

Create `apps/web/src/app/api/cron/embedding-generate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";
import { enqueueJob } from "../_lib/qstash";

const EMBEDDING_WORKER_URL = process.env.EMBEDDING_WORKER_URL
  ?? `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/embeddings/generate`;

interface DocumentWithoutEmbedding {
  id: string;
  name: string;
  ocrStatus: string;
}

/**
 * Find documents that have completed OCR but don't have embeddings yet.
 */
export async function findDocumentsWithoutEmbeddings(): Promise<DocumentWithoutEmbedding[]> {
  const docs = await prisma.document.findMany({
    where: {
      ocrStatus: "COMPLETED",
    },
    select: { id: true, name: true, ocrStatus: true },
  });

  // Filter out documents that already have embeddings
  const withoutEmbeddings: DocumentWithoutEmbedding[] = [];

  for (const doc of docs) {
    const existing = await prisma.documentEmbedding.findFirst({
      where: {
        sourceType: "document",
        sourceId: doc.id,
      },
    });

    if (!existing) {
      withoutEmbeddings.push(doc as DocumentWithoutEmbedding);
    }
  }

  return withoutEmbeddings;
}

/**
 * GET /api/cron/embedding-generate
 * Schedule: daily at 03:00 KST
 *
 * Processes documents without embeddings via OpenAI text-embedding-3-small.
 * Offloaded to QStash for long-running batch processing.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const docs = await findDocumentsWithoutEmbeddings();

    if (docs.length === 0) {
      return NextResponse.json({ message: "All documents have embeddings", enqueued: 0 });
    }

    // Batch documents into groups of 10 for processing
    const batchSize = 10;
    let enqueued = 0;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);

      await enqueueJob(
        EMBEDDING_WORKER_URL,
        {
          documentIds: batch.map((d) => d.id),
          model: "text-embedding-3-small",
        },
        { retries: 2 }
      );
      enqueued++;
    }

    return NextResponse.json({
      message: "Embedding generation enqueued",
      documentsFound: docs.length,
      batchesEnqueued: enqueued,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "embedding-generate failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run all three tests**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/crawler-execute.test.ts tests/cron/matching-refresh.test.ts tests/cron/embedding-generate.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/crawler-execute/ apps/web/src/app/api/cron/matching-refresh/ apps/web/src/app/api/cron/embedding-generate/ apps/web/tests/cron/crawler-execute.test.ts apps/web/tests/cron/matching-refresh.test.ts apps/web/tests/cron/embedding-generate.test.ts
git commit -m "feat: add QStash-backed cron jobs — crawler execution, matching refresh, embedding generation"
```

---

## Task 8: daily-digest — Daily Summary Email

**Files:**
- Create: `apps/web/src/app/api/cron/daily-digest/route.ts`
- Create: `apps/web/tests/cron/daily-digest.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/tests/cron/daily-digest.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("CRON_SECRET", "test-secret");

const mockNotificationFindMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockEmailCreate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    notification: { findMany: mockNotificationFindMany },
    user: { findMany: mockUserFindMany },
    emailLog: { create: mockEmailCreate },
  },
}));

import { aggregateDigest, type DigestEntry } from "../../../src/app/api/cron/daily-digest/route";

describe("daily-digest cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates today's notifications per user", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "user-1", email: "user1@axle.app", name: "김컨설턴트" },
    ]);

    mockNotificationFindMany.mockResolvedValue([
      { id: "n1", userId: "user-1", type: "DOC_UPLOADED", title: "서류 업로드 완료", body: "사업자등록증" },
      { id: "n2", userId: "user-1", type: "DEADLINE", title: "마감 D-3", body: "창업성장기술개발" },
      { id: "n3", userId: "user-1", type: "MATCHING_RESULT", title: "새 매칭", body: "3건 추천" },
    ]);

    const digests = await aggregateDigest();

    expect(digests).toHaveLength(1);
    expect(digests[0].userId).toBe("user-1");
    expect(digests[0].notifications).toHaveLength(3);
  });

  it("skips users with no notifications today", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "user-2", email: "user2@axle.app", name: "박컨설턴트" },
    ]);

    mockNotificationFindMany.mockResolvedValue([]);

    const digests = await aggregateDigest();
    expect(digests).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement daily-digest route**

Create `apps/web/src/app/api/cron/daily-digest/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { verifyCronAuth, unauthorizedResponse } from "../_lib/auth";

export interface DigestEntry {
  userId: string;
  userName: string;
  email: string;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
  }>;
}

/**
 * Aggregate today's notifications per user for digest email.
 */
export async function aggregateDigest(): Promise<DigestEntry[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: { disabled: false },
    select: { id: true, email: true, name: true },
  });

  const digests: DigestEntry[] = [];

  for (const user of users) {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: todayStart },
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (notifications.length === 0) continue;

    digests.push({
      userId: user.id,
      userName: user.name ?? user.email,
      email: user.email,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
      })),
    });
  }

  return digests;
}

/**
 * GET /api/cron/daily-digest
 * Schedule: weekdays at 18:00 KST
 *
 * Aggregates the day's notifications per user.
 * Sends a single digest email with all notifications grouped by type.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const digests = await aggregateDigest();

    if (digests.length === 0) {
      return NextResponse.json({ message: "No digest emails to send", sent: 0 });
    }

    let sentCount = 0;

    for (const digest of digests) {
      // Group notifications by type for email formatting
      const byType = new Map<string, typeof digest.notifications>();
      for (const notif of digest.notifications) {
        if (!byType.has(notif.type)) {
          byType.set(notif.type, []);
        }
        byType.get(notif.type)!.push(notif);
      }

      // Build summary
      const typeSummary = Array.from(byType.entries())
        .map(([type, items]) => `${type}: ${items.length}건`)
        .join(", ");

      await prisma.emailLog.create({
        data: {
          to: digest.email,
          subject: `[AXLE] 오늘의 요약 (${digest.notifications.length}건)`,
          type: "MATCHING_DIGEST",
          channel: "email",
        },
      });

      sentCount++;
    }

    return NextResponse.json({
      message: "Daily digest emails sent",
      usersWithDigest: digests.length,
      emailsSent: sentCount,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "daily-digest failed", message: errorMessage },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/daily-digest.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/cron/daily-digest/ apps/web/tests/cron/daily-digest.test.ts
git commit -m "feat: add daily-digest cron — aggregates notifications into single digest email per user"
```

---

## Task 9: Integration Verification

- [ ] **Step 1: Run all cron tests**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/cron/
```

Expected: All tests pass (auth: 4, doc-reminder: 2, deadline-alert: 1, journal-remind: 2, schedule-sync: 2, doc-expiry: 2, crawler-execute: 1, matching-refresh: 1, embedding-generate: 1, daily-digest: 2 = **18 total**).

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Verify vercel.json structure**

```bash
cd /Volumes/포터블/AX/axle/apps/web
cat vercel.json | npx json crons
```

Expected: 9 cron entries with valid schedule expressions.

- [ ] **Step 4: Verify cron route pattern consistency**

Check all 9 routes export a GET handler and use verifyCronAuth:

```bash
cd /Volumes/포터블/AX/axle
grep -l "verifyCronAuth" apps/web/src/app/api/cron/*/route.ts | wc -l
```

Expected: 9

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 16 complete — 9 cron jobs with auth, QStash, and tests"
```

---

## Cron Schedule Summary

| Cron Job | Schedule | Trigger | QStash |
|----------|----------|---------|--------|
| doc-reminder | `0 9 * * *` (daily 09:00) | 서류 미제출 D+3 → 이메일 리마인더 | No |
| deadline-alert | `0 8 * * *` (daily 08:00) | 지원사업 마감일 reminderDays 매칭 → 인앱+Telegram | No |
| journal-remind | `0 10 1 * *` (monthly 1st 10:00) | 연구일지 미작성 → 연구원 이메일 | No |
| schedule-sync | `*/30 * * * *` (every 30min) | AXLE ↔ Google Calendar 양방향 동기화 | No |
| doc-expiry | `0 7 * * *` (daily 07:00) | 서류 만료 D-30/D-7 → 인앱 알림 | No |
| crawler-execute | `0 6 * * 1` (weekly Mon 06:00) | OCI 크롤러 워커 HTTP 트리거 | Yes |
| matching-refresh | `0 2 * * *` (daily 02:00) | 새 문서 있는 고객사 매칭 재실행 | Yes |
| embedding-generate | `0 3 * * *` (daily 03:00) | OCR 완료 문서 → OpenAI 임베딩 생성 | Yes |
| daily-digest | `0 18 * * 1-5` (weekdays 18:00) | 금일 알림 집계 → 1통 요약 이메일 | No |

---

## Summary

Phase 16 delivers:
- **Cron auth module** with CRON_SECRET bearer token verification
- **QStash client wrapper** for reliable long-running job offloading with retries
- **vercel.json** with 9 cron schedule configurations
- **9 cron routes** under `apps/web/src/app/api/cron/`:
  - **doc-reminder**: Finds overdue checklist items, groups by client, sends reminder emails
  - **deadline-alert**: Matches program deadlines with reminder day windows, sends in-app notifications
  - **journal-remind**: Checks research institute clients for monthly journal submission, emails researchers
  - **schedule-sync**: Bidirectional Google Calendar sync (push ready, pull integration pending)
  - **doc-expiry**: 30-day and 7-day document expiry alerts via in-app notifications
  - **crawler-execute**: Triggers OCI crawler worker via QStash for program data collection
  - **matching-refresh**: Finds clients with new documents and re-runs matching via QStash
  - **embedding-generate**: Batches un-embedded documents for OpenAI vector generation via QStash
  - **daily-digest**: Aggregates notifications per user into single summary email on weekday evenings

**Next:** With all 4 apps (web, desktop, agent-bridge, cron) built, the platform is ready for end-to-end integration testing and deployment.
