# AXLE Phase 7: Calendar & Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified calendar system with schedule CRUD, program deadline auto-creation, Google Calendar bidirectional sync, and ProgramInfo management pages. Consultants can see all deadlines, meetings, reminders in one view and get timely alerts.

**Architecture:** Schedule and ProgramInfo data models (from Phase 0 schema) power the calendar views in `apps/web/(calendar)`. Google Calendar integration uses OAuth + Google Calendar API for bidirectional sync. A Vercel Cron job (`schedule-sync`) runs periodically to keep calendars in sync.

**Tech Stack:** Next.js 16, React 19, @axle/db (Schedule, ProgramInfo models), googleapis (Google Calendar API), date-fns, @axle/ui (shadcn/ui), Zod, Vitest, React Testing Library

**Depends on:** Phase 3 (projects — Project model, client-project relationships)

---

## File Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── calendar/
│   │   │   │   ├── page.tsx                   # Unified calendar view
│   │   │   │   ├── loading.tsx                # Calendar skeleton
│   │   │   │   └── _components/
│   │   │   │       ├── calendar-view.tsx       # Monthly/Weekly/Daily toggle
│   │   │   │       ├── month-grid.tsx          # Monthly grid view
│   │   │   │       ├── week-view.tsx           # Weekly timeline view
│   │   │   │       ├── day-view.tsx            # Daily detail view
│   │   │   │       ├── schedule-dialog.tsx     # Create/Edit schedule dialog
│   │   │   │       ├── schedule-filters.tsx    # ScheduleType + client filters
│   │   │   │       └── schedule-card.tsx       # Schedule item card
│   │   │   │
│   │   │   ├── programs/
│   │   │   │   ├── page.tsx                   # Program list with filters
│   │   │   │   ├── [programId]/
│   │   │   │   │   └── page.tsx               # Program detail view
│   │   │   │   └── _components/
│   │   │   │       ├── program-list.tsx        # Filterable program table
│   │   │   │       ├── program-form.tsx        # ProgramInfo CRUD form
│   │   │   │       └── program-filters.tsx     # Category, region, deadline filters
│   │   │   │
│   │   │   └── settings/
│   │   │       └── integrations/
│   │   │           └── _components/
│   │   │               └── google-calendar-connect.tsx  # OAuth connect button
│   │   │
│   │   └── api/
│   │       ├── schedules/
│   │       │   ├── route.ts                   # GET (list), POST (create)
│   │       │   └── [scheduleId]/
│   │       │       └── route.ts               # GET, PATCH, DELETE
│   │       ├── programs/
│   │       │   ├── route.ts                   # GET (list), POST (create)
│   │       │   └── [programId]/
│   │       │       └── route.ts               # GET, PATCH, DELETE
│   │       ├── google-calendar/
│   │       │   ├── auth/
│   │       │   │   ├── route.ts               # Initiate OAuth
│   │       │   │   └── callback/
│   │       │   │       └── route.ts           # OAuth callback
│   │       │   └── sync/
│   │       │       └── route.ts               # Manual sync trigger
│   │       └── cron/
│   │           └── schedule-sync/
│   │               └── route.ts               # Vercel Cron handler
│   │
│   └── lib/
│       ├── calendar/
│       │   ├── google-calendar.ts             # Google Calendar API wrapper
│       │   ├── schedule-service.ts            # Schedule business logic
│       │   ├── program-deadline.ts            # Auto-create deadlines from ProgramInfo
│       │   └── reminder.ts                    # Reminder scheduling logic
│       └── validations/
│           ├── schedule.ts                    # Schedule Zod schemas
│           └── program.ts                     # ProgramInfo Zod schemas
│
└── tests/
    ├── schedule-service.test.ts
    ├── program-deadline.test.ts
    ├── reminder.test.ts
    └── google-calendar.test.ts
```

---

## Task 1: Schedule and Program Zod Schemas

**Files:**
- Create: `apps/web/src/lib/validations/schedule.ts`
- Create: `apps/web/src/lib/validations/program.ts`

- [ ] **Step 1: Create schedule validation schemas**

Create `apps/web/src/lib/validations/schedule.ts`:

```typescript
import { z } from "zod";

export const CreateScheduleSchema = z.object({
  orgId: z.string(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  programId: z.string().optional(),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["DEADLINE", "MEETING", "REMINDER", "PROGRAM_DUE"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  isAllDay: z.boolean().default(false),
  reminderDays: z
    .array(z.number().min(0).max(365))
    .default([7, 3, 1]),
});

export const UpdateScheduleSchema = CreateScheduleSchema.partial().extend({
  id: z.string(),
});

export const ScheduleFilterSchema = z.object({
  orgId: z.string(),
  clientId: z.string().optional(),
  types: z
    .array(z.enum(["DEADLINE", "MEETING", "REMINDER", "PROGRAM_DUE"]))
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
});

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;
export type ScheduleFilter = z.infer<typeof ScheduleFilterSchema>;
```

- [ ] **Step 2: Create program validation schemas**

Create `apps/web/src/lib/validations/program.ts`:

```typescript
import { z } from "zod";

export const CreateProgramSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1, "사업명을 입력해주세요").max(300),
  agency: z.string().max(200).optional(),
  category: z.enum([
    "STARTUP",
    "VENTURE",
    "RND",
    "CERTIFICATION",
    "EXPORT",
    "SMART_FACTORY",
    "GENERAL",
  ]),
  announcementUrl: z.string().url().optional().or(z.literal("")),
  announcementDocId: z.string().optional(),
  applicationStart: z.coerce.date().optional(),
  applicationEnd: z.coerce.date().optional(),
  maxFunding: z.coerce.number().min(0).optional(),
  requirements: z.record(z.unknown()).optional(),
  eligibility: z.record(z.unknown()).optional(),
  region: z.string().max(100).optional(),
  memo: z.string().max(5000).optional(),
});

export const UpdateProgramSchema = CreateProgramSchema.partial().extend({
  id: z.string(),
});

export const ProgramFilterSchema = z.object({
  orgId: z.string(),
  category: z
    .enum([
      "STARTUP",
      "VENTURE",
      "RND",
      "CERTIFICATION",
      "EXPORT",
      "SMART_FACTORY",
      "GENERAL",
    ])
    .optional(),
  region: z.string().optional(),
  deadlineBefore: z.coerce.date().optional(),
  deadlineAfter: z.coerce.date().optional(),
  search: z.string().optional(),
  isCrawled: z.boolean().optional(),
});

export type CreateProgramInput = z.infer<typeof CreateProgramSchema>;
export type UpdateProgramInput = z.infer<typeof UpdateProgramSchema>;
export type ProgramFilter = z.infer<typeof ProgramFilterSchema>;
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validations/
git commit -m "feat: add Schedule and ProgramInfo Zod validation schemas"
```

---

## Task 2: Schedule Service (Business Logic)

**Files:**
- Create: `apps/web/src/lib/calendar/schedule-service.ts`
- Create: `apps/web/tests/schedule-service.test.ts`

- [ ] **Step 1: Write failing tests for schedule service**

Create `apps/web/tests/schedule-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSchedule = {
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findUnique: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: {
    schedule: mockSchedule,
  },
}));

import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "../src/lib/calendar/schedule-service";

describe("Schedule Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listSchedules", () => {
    it("returns schedules for org within date range", async () => {
      mockSchedule.findMany.mockResolvedValue([
        {
          id: "sched-1",
          title: "서류 제출 마감",
          type: "DEADLINE",
          startDate: new Date("2026-04-15"),
        },
      ]);

      const result = await listSchedules({
        orgId: "org-1",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-30"),
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("서류 제출 마감");
    });

    it("filters by schedule type", async () => {
      mockSchedule.findMany.mockResolvedValue([]);

      await listSchedules({
        orgId: "org-1",
        types: ["DEADLINE", "PROGRAM_DUE"],
      });

      expect(mockSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: ["DEADLINE", "PROGRAM_DUE"] },
          }),
        })
      );
    });

    it("filters by clientId", async () => {
      mockSchedule.findMany.mockResolvedValue([]);

      await listSchedules({
        orgId: "org-1",
        clientId: "client-1",
      });

      expect(mockSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: "client-1",
          }),
        })
      );
    });
  });

  describe("createSchedule", () => {
    it("creates a schedule with default reminder days", async () => {
      mockSchedule.create.mockResolvedValue({
        id: "sched-new",
        title: "미팅",
        type: "MEETING",
        reminderDays: [7, 3, 1],
      });

      const result = await createSchedule({
        orgId: "org-1",
        title: "미팅",
        type: "MEETING",
        startDate: new Date("2026-04-20T14:00:00"),
        reminderDays: [7, 3, 1],
      });

      expect(result.id).toBe("sched-new");
      expect(mockSchedule.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateSchedule", () => {
    it("updates schedule fields", async () => {
      mockSchedule.findUnique.mockResolvedValue({ id: "sched-1", orgId: "org-1" });
      mockSchedule.update.mockResolvedValue({ id: "sched-1", title: "변경된 제목" });

      const result = await updateSchedule({
        id: "sched-1",
        title: "변경된 제목",
      });

      expect(result.title).toBe("변경된 제목");
    });
  });

  describe("deleteSchedule", () => {
    it("deletes a schedule by id", async () => {
      mockSchedule.findUnique.mockResolvedValue({ id: "sched-1", orgId: "org-1" });
      mockSchedule.delete.mockResolvedValue({ id: "sched-1" });

      await deleteSchedule("sched-1");

      expect(mockSchedule.delete).toHaveBeenCalledWith({
        where: { id: "sched-1" },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/schedule-service.test.ts
```

Expected: FAIL — "Cannot find module '../src/lib/calendar/schedule-service'"

- [ ] **Step 3: Implement schedule service**

Create `apps/web/src/lib/calendar/schedule-service.ts`:

```typescript
import { prisma } from "@axle/db";
import type { Schedule } from "@axle/db";
import type {
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleFilter,
} from "../validations/schedule";

/**
 * List schedules with filters.
 */
export async function listSchedules(
  filter: ScheduleFilter
): Promise<Schedule[]> {
  const where: Record<string, unknown> = {
    orgId: filter.orgId,
  };

  if (filter.clientId) {
    where.clientId = filter.clientId;
  }

  if (filter.types && filter.types.length > 0) {
    where.type = { in: filter.types };
  }

  if (filter.startDate || filter.endDate) {
    where.startDate = {};
    if (filter.startDate) {
      (where.startDate as Record<string, Date>).gte = filter.startDate;
    }
    if (filter.endDate) {
      (where.startDate as Record<string, Date>).lte = filter.endDate;
    }
  }

  if (filter.search) {
    where.title = { contains: filter.search, mode: "insensitive" };
  }

  return prisma.schedule.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: {
      program: {
        select: { id: true, name: true, agency: true, category: true },
      },
    },
  });
}

/**
 * Create a new schedule.
 */
export async function createSchedule(
  input: CreateScheduleInput
): Promise<Schedule> {
  return prisma.schedule.create({
    data: {
      orgId: input.orgId,
      clientId: input.clientId,
      projectId: input.projectId,
      programId: input.programId,
      title: input.title,
      description: input.description,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      isAllDay: input.isAllDay,
      reminderDays: input.reminderDays,
    },
  });
}

/**
 * Update an existing schedule.
 */
export async function updateSchedule(
  input: UpdateScheduleInput
): Promise<Schedule> {
  const { id, ...data } = input;

  return prisma.schedule.update({
    where: { id },
    data,
  });
}

/**
 * Delete a schedule by ID.
 */
export async function deleteSchedule(id: string): Promise<void> {
  await prisma.schedule.delete({
    where: { id },
  });
}

/**
 * Get schedules for a specific month (for calendar view).
 */
export async function getMonthSchedules(
  orgId: string,
  year: number,
  month: number
): Promise<Schedule[]> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  return listSchedules({
    orgId,
    startDate,
    endDate,
  });
}

/**
 * Get upcoming schedules (next N days).
 */
export async function getUpcomingSchedules(
  orgId: string,
  days = 30
): Promise<Schedule[]> {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return listSchedules({
    orgId,
    startDate,
    endDate,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/schedule-service.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/calendar/schedule-service.ts apps/web/tests/schedule-service.test.ts
git commit -m "feat: add schedule service with CRUD, filtering, and monthly/upcoming queries"
```

---

## Task 3: Program Deadline Auto-Creation

**Files:**
- Create: `apps/web/src/lib/calendar/program-deadline.ts`
- Create: `apps/web/tests/program-deadline.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/tests/program-deadline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSchedule = {
  findFirst: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
};

const mockProgramInfo = {
  findMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: {
    schedule: mockSchedule,
    programInfo: mockProgramInfo,
  },
}));

import {
  createDeadlineFromProgram,
  generateReminderSchedules,
  syncProgramDeadlines,
} from "../src/lib/calendar/program-deadline";

describe("Program Deadline Auto-Creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a PROGRAM_DUE schedule from ProgramInfo", async () => {
    mockSchedule.findFirst.mockResolvedValue(null); // No existing deadline
    mockSchedule.create.mockResolvedValue({
      id: "sched-deadline",
      title: "AI 바우처 마감",
      type: "PROGRAM_DUE",
      startDate: new Date("2026-05-31"),
    });

    const result = await createDeadlineFromProgram({
      orgId: "org-1",
      programId: "prog-1",
      programName: "AI 바우처",
      applicationEnd: new Date("2026-05-31"),
      reminderDays: [30, 14, 7, 3, 1],
    });

    expect(result.title).toContain("AI 바우처");
    expect(result.type).toBe("PROGRAM_DUE");
  });

  it("skips creation if deadline already exists", async () => {
    mockSchedule.findFirst.mockResolvedValue({
      id: "existing-deadline",
      programId: "prog-1",
    });

    const result = await createDeadlineFromProgram({
      orgId: "org-1",
      programId: "prog-1",
      programName: "AI 바우처",
      applicationEnd: new Date("2026-05-31"),
    });

    expect(result.id).toBe("existing-deadline");
    expect(mockSchedule.create).not.toHaveBeenCalled();
  });

  it("generates reminder dates from deadline", () => {
    const deadline = new Date("2026-05-31");
    const reminderDays = [30, 14, 7, 3, 1];

    const reminders = generateReminderSchedules(
      "AI 바우처 마감",
      deadline,
      reminderDays
    );

    expect(reminders).toHaveLength(5);
    expect(reminders[0].title).toContain("D-30");
    expect(reminders[0].startDate.getTime()).toBe(
      new Date("2026-05-01").getTime()
    );
    expect(reminders[4].title).toContain("D-1");
  });

  it("syncs deadlines for all programs with applicationEnd", async () => {
    mockProgramInfo.findMany.mockResolvedValue([
      {
        id: "prog-1",
        orgId: "org-1",
        name: "AI 바우처",
        applicationEnd: new Date("2026-06-30"),
      },
      {
        id: "prog-2",
        orgId: "org-1",
        name: "스마트공장",
        applicationEnd: new Date("2026-07-15"),
      },
    ]);
    mockSchedule.findFirst.mockResolvedValue(null);
    mockSchedule.create.mockImplementation((args: { data: { title: string } }) =>
      Promise.resolve({ id: `sched-${Date.now()}`, ...args.data })
    );

    const created = await syncProgramDeadlines("org-1");

    expect(created).toBe(2);
    expect(mockSchedule.create).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/program-deadline.test.ts
```

Expected: FAIL — "Cannot find module '../src/lib/calendar/program-deadline'"

- [ ] **Step 3: Implement program deadline auto-creation**

Create `apps/web/src/lib/calendar/program-deadline.ts`:

```typescript
import { prisma } from "@axle/db";
import type { Schedule } from "@axle/db";

interface CreateDeadlineInput {
  orgId: string;
  programId: string;
  programName: string;
  applicationEnd: Date;
  reminderDays?: number[];
}

/**
 * Create a PROGRAM_DUE schedule from ProgramInfo.applicationEnd.
 * Skips if a deadline for this program already exists.
 */
export async function createDeadlineFromProgram(
  input: CreateDeadlineInput
): Promise<Schedule> {
  // Check for existing deadline
  const existing = await prisma.schedule.findFirst({
    where: {
      programId: input.programId,
      type: "PROGRAM_DUE",
    },
  });

  if (existing) return existing;

  // Create deadline schedule
  return prisma.schedule.create({
    data: {
      orgId: input.orgId,
      programId: input.programId,
      title: `${input.programName} 마감`,
      type: "PROGRAM_DUE",
      startDate: input.applicationEnd,
      isAllDay: true,
      reminderDays: input.reminderDays ?? [30, 14, 7, 3, 1],
    },
  });
}

/**
 * Generate reminder schedule objects from a deadline date.
 * Returns REMINDER-type schedule data (not persisted — use for display or batch creation).
 */
export function generateReminderSchedules(
  deadlineTitle: string,
  deadlineDate: Date,
  reminderDays: number[]
): Array<{
  title: string;
  type: "REMINDER";
  startDate: Date;
  isAllDay: boolean;
}> {
  return reminderDays
    .sort((a, b) => b - a) // Sort descending (D-30 first)
    .map((days) => {
      const reminderDate = new Date(deadlineDate);
      reminderDate.setDate(reminderDate.getDate() - days);

      return {
        title: `[D-${days}] ${deadlineTitle}`,
        type: "REMINDER" as const,
        startDate: reminderDate,
        isAllDay: true,
      };
    });
}

/**
 * Sync PROGRAM_DUE schedules for all programs with applicationEnd in an org.
 * Called by Vercel Cron or manually.
 */
export async function syncProgramDeadlines(orgId: string): Promise<number> {
  const programs = await prisma.programInfo.findMany({
    where: {
      orgId,
      applicationEnd: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      applicationEnd: true,
    },
  });

  let created = 0;

  for (const program of programs) {
    if (!program.applicationEnd) continue;

    // Only create for future deadlines
    if (program.applicationEnd < new Date()) continue;

    const existing = await prisma.schedule.findFirst({
      where: {
        programId: program.id,
        type: "PROGRAM_DUE",
      },
    });

    if (!existing) {
      await prisma.schedule.create({
        data: {
          orgId: program.orgId,
          programId: program.id,
          title: `${program.name} 마감`,
          type: "PROGRAM_DUE",
          startDate: program.applicationEnd,
          isAllDay: true,
          reminderDays: [30, 14, 7, 3, 1],
        },
      });
      created++;
    }
  }

  return created;
}

/**
 * Check which reminders should fire today and return them.
 * Used by Vercel Cron deadline-alert job.
 */
export async function getTodayReminders(
  orgId: string
): Promise<Schedule[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all upcoming deadlines
  const deadlines = await prisma.schedule.findMany({
    where: {
      orgId,
      type: { in: ["DEADLINE", "PROGRAM_DUE"] },
      startDate: { gte: today },
    },
  });

  // Filter to those whose reminderDays includes today's distance
  return deadlines.filter((schedule) => {
    const daysUntil = Math.ceil(
      (schedule.startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return schedule.reminderDays.includes(daysUntil);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/program-deadline.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/calendar/program-deadline.ts apps/web/tests/program-deadline.test.ts
git commit -m "feat: add program deadline auto-creation with D-N reminder generation"
```

---

## Task 4: Google Calendar Integration

**Files:**
- Create: `apps/web/src/lib/calendar/google-calendar.ts`
- Create: `apps/web/tests/google-calendar.test.ts`
- Create: `apps/web/src/app/api/google-calendar/auth/route.ts`
- Create: `apps/web/src/app/api/google-calendar/auth/callback/route.ts`
- Create: `apps/web/src/app/api/google-calendar/sync/route.ts`

- [ ] **Step 1: Write failing tests for Google Calendar wrapper**

Create `apps/web/tests/google-calendar.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock googleapis
vi.mock("googleapis", () => ({
  google: {
    calendar: vi.fn().mockReturnValue({
      events: {
        insert: vi.fn().mockResolvedValue({
          data: { id: "gcal-event-1", htmlLink: "https://calendar.google.com/event/1" },
        }),
        update: vi.fn().mockResolvedValue({
          data: { id: "gcal-event-1" },
        }),
        delete: vi.fn().mockResolvedValue({}),
        list: vi.fn().mockResolvedValue({
          data: {
            items: [
              {
                id: "gcal-event-1",
                summary: "미팅",
                start: { dateTime: "2026-04-20T14:00:00+09:00" },
                end: { dateTime: "2026-04-20T15:00:00+09:00" },
              },
            ],
          },
        }),
      },
    }),
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/o/oauth2/..."),
        getToken: vi.fn().mockResolvedValue({
          tokens: { access_token: "mock-access", refresh_token: "mock-refresh" },
        }),
        setCredentials: vi.fn(),
      })),
    },
  },
}));

import {
  getAuthUrl,
  exchangeCode,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  scheduleToCalendarEvent,
} from "../src/lib/calendar/google-calendar";

describe("Google Calendar Integration", () => {
  it("generates OAuth URL", () => {
    const url = getAuthUrl("org-1");
    expect(url).toContain("accounts.google.com");
  });

  it("creates a calendar event from schedule", async () => {
    const result = await createCalendarEvent("mock-token", {
      summary: "서류 제출 마감",
      description: "AI 바우처 사업계획서",
      start: { date: "2026-05-31" },
      end: { date: "2026-05-31" },
    });

    expect(result.id).toBe("gcal-event-1");
  });

  it("converts Schedule to Google Calendar event format", () => {
    const event = scheduleToCalendarEvent({
      title: "서류 제출",
      description: "테스트",
      startDate: new Date("2026-04-20T14:00:00"),
      endDate: new Date("2026-04-20T15:00:00"),
      isAllDay: false,
    });

    expect(event.summary).toBe("서류 제출");
    expect(event.start).toHaveProperty("dateTime");
  });

  it("converts all-day Schedule to Google Calendar event", () => {
    const event = scheduleToCalendarEvent({
      title: "마감일",
      startDate: new Date("2026-05-31"),
      isAllDay: true,
    });

    expect(event.start).toHaveProperty("date");
    expect(event.start).not.toHaveProperty("dateTime");
  });

  it("lists events from Google Calendar", async () => {
    const events = await listCalendarEvents(
      "mock-token",
      new Date("2026-04-01"),
      new Date("2026-04-30")
    );

    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("미팅");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/google-calendar.test.ts
```

Expected: FAIL — "Cannot find module '../src/lib/calendar/google-calendar'"

- [ ] **Step 3: Implement Google Calendar wrapper**

Create `apps/web/src/lib/calendar/google-calendar.ts`:

```typescript
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const REDIRECT_PATH = "/api/google-calendar/auth/callback";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}${REDIRECT_PATH}`
  );
}

/**
 * Generate Google OAuth URL for calendar authorization.
 */
export function getAuthUrl(orgId: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state: orgId, // Pass orgId to callback
    prompt: "consent",
  });
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(
  code: string
): Promise<{ access_token: string; refresh_token?: string }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? undefined,
  };
}

interface CalendarEventInput {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

/**
 * Create an event in Google Calendar.
 */
export async function createCalendarEvent(
  refreshToken: string,
  event: CalendarEventInput,
  calendarId = "primary"
): Promise<{ id: string; htmlLink?: string }> {
  const calendar = getCalendarClient(refreshToken);

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  return {
    id: response.data.id!,
    htmlLink: response.data.htmlLink ?? undefined,
  };
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateCalendarEvent(
  refreshToken: string,
  eventId: string,
  event: Partial<CalendarEventInput>,
  calendarId = "primary"
): Promise<void> {
  const calendar = getCalendarClient(refreshToken);

  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: event,
  });
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(
  refreshToken: string,
  eventId: string,
  calendarId = "primary"
): Promise<void> {
  const calendar = getCalendarClient(refreshToken);

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

/**
 * List events from Google Calendar within a date range.
 */
export async function listCalendarEvents(
  refreshToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId = "primary"
): Promise<
  Array<{
    id: string;
    summary: string;
    start: { date?: string; dateTime?: string };
    end: { date?: string; dateTime?: string };
    description?: string;
  }>
> {
  const calendar = getCalendarClient(refreshToken);

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return (response.data.items ?? []).map((item) => ({
    id: item.id!,
    summary: item.summary ?? "",
    start: {
      date: item.start?.date ?? undefined,
      dateTime: item.start?.dateTime ?? undefined,
    },
    end: {
      date: item.end?.date ?? undefined,
      dateTime: item.end?.dateTime ?? undefined,
    },
    description: item.description ?? undefined,
  }));
}

/**
 * Convert AXLE Schedule to Google Calendar event format.
 */
export function scheduleToCalendarEvent(schedule: {
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  isAllDay: boolean;
}): CalendarEventInput {
  const timeZone = "Asia/Seoul";

  if (schedule.isAllDay) {
    const startDate = schedule.startDate.toISOString().split("T")[0];
    const endDate = schedule.endDate
      ? schedule.endDate.toISOString().split("T")[0]
      : startDate;

    return {
      summary: schedule.title,
      description: schedule.description ?? undefined,
      start: { date: startDate },
      end: { date: endDate },
    };
  }

  return {
    summary: schedule.title,
    description: schedule.description ?? undefined,
    start: {
      dateTime: schedule.startDate.toISOString(),
      timeZone,
    },
    end: {
      dateTime: (schedule.endDate ?? schedule.startDate).toISOString(),
      timeZone,
    },
  };
}

function getCalendarClient(refreshToken: string) {
  const auth = getOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}
```

- [ ] **Step 4: Create OAuth API routes**

Create `apps/web/src/app/api/google-calendar/auth/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { getAuthUrl } from "@/lib/calendar/google-calendar";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  // Verify user is org member
  await getVerifiedOrgMember(orgId);

  const url = getAuthUrl(orgId);
  return NextResponse.redirect(url);
}
```

Create `apps/web/src/app/api/google-calendar/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { exchangeCode } from "@/lib/calendar/google-calendar";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const orgId = searchParams.get("state");

  if (!code || !orgId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings/integrations?error=missing_params`
    );
  }

  try {
    const tokens = await exchangeCode(code);

    // Store refresh token in org settings
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: {
          googleCalendar: {
            refreshToken: tokens.refresh_token,
            connectedAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings/integrations?success=google_calendar`
    );
  } catch (error) {
    console.error("Google Calendar OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings/integrations?error=oauth_failed`
    );
  }
}
```

Create `apps/web/src/app/api/google-calendar/sync/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  scheduleToCalendarEvent,
} from "@/lib/calendar/google-calendar";

export async function POST(request: Request) {
  const { orgId } = await request.json();

  const { org } = await getVerifiedOrgMember(orgId);

  const settings = org.settings as Record<string, unknown> | null;
  const gcalSettings = settings?.googleCalendar as
    | { refreshToken: string }
    | undefined;

  if (!gcalSettings?.refreshToken) {
    return NextResponse.json(
      { error: "Google Calendar not connected" },
      { status: 400 }
    );
  }

  const refreshToken = gcalSettings.refreshToken;

  // Get all AXLE schedules without googleCalendarId
  const unsynced = await prisma.schedule.findMany({
    where: {
      orgId,
      googleCalendarId: null,
    },
  });

  let synced = 0;

  for (const schedule of unsynced) {
    try {
      const event = scheduleToCalendarEvent({
        title: schedule.title,
        description: schedule.description,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isAllDay: schedule.isAllDay,
      });

      const result = await createCalendarEvent(refreshToken, event);

      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { googleCalendarId: result.id },
      });

      synced++;
    } catch (error) {
      console.error(`Failed to sync schedule ${schedule.id}:`, error);
    }
  }

  return NextResponse.json({ synced, total: unsynced.length });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/google-calendar.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/calendar/google-calendar.ts apps/web/src/app/api/google-calendar/ apps/web/tests/google-calendar.test.ts
git commit -m "feat: add Google Calendar OAuth integration with bidirectional sync"
```

---

## Task 5: Schedule API Routes

**Files:**
- Create: `apps/web/src/app/api/schedules/route.ts`
- Create: `apps/web/src/app/api/schedules/[scheduleId]/route.ts`
- Create: `apps/web/src/app/api/programs/route.ts`
- Create: `apps/web/src/app/api/programs/[programId]/route.ts`

- [ ] **Step 1: Create schedule list/create API route**

Create `apps/web/src/app/api/schedules/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { listSchedules, createSchedule } from "@/lib/calendar/schedule-service";
import { CreateScheduleSchema, ScheduleFilterSchema } from "@/lib/validations/schedule";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  await getVerifiedOrgMember(orgId);

  const filter = ScheduleFilterSchema.parse({
    orgId,
    clientId: searchParams.get("clientId") ?? undefined,
    types: searchParams.get("types")?.split(",") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  const schedules = await listSchedules(filter);
  return NextResponse.json(schedules);
}

export async function POST(request: Request) {
  const body = await request.json();
  const input = CreateScheduleSchema.parse(body);

  await getVerifiedOrgMember(input.orgId);

  const schedule = await createSchedule(input);
  return NextResponse.json(schedule, { status: 201 });
}
```

- [ ] **Step 2: Create schedule detail API route**

Create `apps/web/src/app/api/schedules/[scheduleId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { updateSchedule, deleteSchedule } from "@/lib/calendar/schedule-service";
import { UpdateScheduleSchema } from "@/lib/validations/schedule";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { scheduleId } = await params;
  await getVerifiedUser();

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      program: { select: { id: true, name: true, agency: true } },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { scheduleId } = await params;
  await getVerifiedUser();

  const body = await request.json();
  const input = UpdateScheduleSchema.parse({ ...body, id: scheduleId });

  const schedule = await updateSchedule(input);
  return NextResponse.json(schedule);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { scheduleId } = await params;
  await getVerifiedUser();

  await deleteSchedule(scheduleId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create program list/create API route**

Create `apps/web/src/app/api/programs/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { CreateProgramSchema, ProgramFilterSchema } from "@/lib/validations/program";
import { createDeadlineFromProgram } from "@/lib/calendar/program-deadline";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  await getVerifiedOrgMember(orgId);

  const filter = ProgramFilterSchema.parse({
    orgId,
    category: searchParams.get("category") ?? undefined,
    region: searchParams.get("region") ?? undefined,
    deadlineBefore: searchParams.get("deadlineBefore") ?? undefined,
    deadlineAfter: searchParams.get("deadlineAfter") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    isCrawled: searchParams.get("isCrawled")
      ? searchParams.get("isCrawled") === "true"
      : undefined,
  });

  const where: Record<string, unknown> = { orgId: filter.orgId };
  if (filter.category) where.category = filter.category;
  if (filter.region) where.region = { contains: filter.region, mode: "insensitive" };
  if (filter.search) where.name = { contains: filter.search, mode: "insensitive" };
  if (filter.isCrawled !== undefined) where.isCrawled = filter.isCrawled;
  if (filter.deadlineBefore || filter.deadlineAfter) {
    where.applicationEnd = {};
    if (filter.deadlineBefore) (where.applicationEnd as Record<string, Date>).lte = filter.deadlineBefore;
    if (filter.deadlineAfter) (where.applicationEnd as Record<string, Date>).gte = filter.deadlineAfter;
  }

  const programs = await prisma.programInfo.findMany({
    where,
    orderBy: { applicationEnd: "asc" },
  });

  return NextResponse.json(programs);
}

export async function POST(request: Request) {
  const body = await request.json();
  const input = CreateProgramSchema.parse(body);

  await getVerifiedOrgMember(input.orgId);

  const program = await prisma.programInfo.create({ data: input });

  // Auto-create deadline schedule if applicationEnd is set
  if (program.applicationEnd) {
    await createDeadlineFromProgram({
      orgId: program.orgId,
      programId: program.id,
      programName: program.name,
      applicationEnd: program.applicationEnd,
    });
  }

  return NextResponse.json(program, { status: 201 });
}
```

- [ ] **Step 4: Create program detail API route**

Create `apps/web/src/app/api/programs/[programId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { UpdateProgramSchema } from "@/lib/validations/program";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { programId } = await params;
  await getVerifiedUser();

  const program = await prisma.programInfo.findUnique({
    where: { id: programId },
    include: {
      projects: { select: { id: true, title: true, status: true } },
      matchingResults: { select: { id: true, clientId: true, score: true } },
      schedules: { select: { id: true, title: true, type: true, startDate: true } },
    },
  });

  if (!program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(program);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { programId } = await params;
  await getVerifiedUser();

  const body = await request.json();
  const input = UpdateProgramSchema.parse({ ...body, id: programId });
  const { id, ...data } = input;

  const program = await prisma.programInfo.update({
    where: { id },
    data,
  });

  return NextResponse.json(program);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { programId } = await params;
  await getVerifiedUser();

  await prisma.programInfo.delete({ where: { id: programId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/schedules/ apps/web/src/app/api/programs/
git commit -m "feat: add Schedule and ProgramInfo CRUD API routes with auto-deadline creation"
```

---

## Task 6: Cron Job — Schedule Sync

**Files:**
- Create: `apps/web/src/app/api/cron/schedule-sync/route.ts`
- Create: `apps/web/src/lib/calendar/reminder.ts`
- Create: `apps/web/tests/reminder.test.ts`

- [ ] **Step 1: Write failing tests for reminder logic**

Create `apps/web/tests/reminder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldSendReminder, formatReminderMessage } from "../src/lib/calendar/reminder";

describe("Reminder Logic", () => {
  it("returns true when today matches a reminder day", () => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7); // 7 days from now

    expect(shouldSendReminder(deadline, [30, 14, 7, 3, 1])).toBe(true);
  });

  it("returns false when today does not match any reminder day", () => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 10); // 10 days from now

    expect(shouldSendReminder(deadline, [30, 14, 7, 3, 1])).toBe(false);
  });

  it("returns false for past deadlines", () => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() - 1); // Yesterday

    expect(shouldSendReminder(deadline, [7, 3, 1])).toBe(false);
  });

  it("formats reminder message correctly", () => {
    const message = formatReminderMessage("AI 바우처 마감", 7);
    expect(message).toContain("D-7");
    expect(message).toContain("AI 바우처");
  });

  it("formats D-day message", () => {
    const message = formatReminderMessage("서류 제출", 0);
    expect(message).toContain("D-Day");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/reminder.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement reminder logic**

Create `apps/web/src/lib/calendar/reminder.ts`:

```typescript
/**
 * Check if a reminder should be sent today for a given deadline.
 */
export function shouldSendReminder(
  deadlineDate: Date,
  reminderDays: number[]
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) return false;

  return reminderDays.includes(daysUntil);
}

/**
 * Format a reminder notification message.
 */
export function formatReminderMessage(
  scheduleTitle: string,
  daysRemaining: number
): string {
  if (daysRemaining === 0) {
    return `[D-Day] ${scheduleTitle} - 오늘이 마감일입니다!`;
  }
  return `[D-${daysRemaining}] ${scheduleTitle} - ${daysRemaining}일 남았습니다.`;
}

/**
 * Calculate days remaining until a deadline.
 */
export function daysUntilDeadline(deadlineDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);

  return Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Group schedules by urgency for dashboard display.
 */
export function groupByUrgency(
  schedules: Array<{ startDate: Date; title: string }>
): {
  overdue: typeof schedules;
  today: typeof schedules;
  thisWeek: typeof schedules;
  upcoming: typeof schedules;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return {
    overdue: schedules.filter((s) => s.startDate < today),
    today: schedules.filter(
      (s) => s.startDate >= today && s.startDate < tomorrow
    ),
    thisWeek: schedules.filter(
      (s) => s.startDate >= tomorrow && s.startDate < weekEnd
    ),
    upcoming: schedules.filter((s) => s.startDate >= weekEnd),
  };
}
```

- [ ] **Step 4: Create Vercel Cron route**

Create `apps/web/src/app/api/cron/schedule-sync/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { syncProgramDeadlines, getTodayReminders } from "@/lib/calendar/program-deadline";
import { formatReminderMessage, daysUntilDeadline } from "@/lib/calendar/reminder";

/**
 * Vercel Cron: Schedule sync + deadline alerts.
 * Runs daily at 09:00 KST.
 *
 * cron: 0 0 * * * (UTC) = 09:00 KST
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });

  let totalSynced = 0;
  let totalReminders = 0;

  for (const org of orgs) {
    // 1. Sync program deadlines
    const synced = await syncProgramDeadlines(org.id);
    totalSynced += synced;

    // 2. Check today's reminders
    const reminders = await getTodayReminders(org.id);
    totalReminders += reminders.length;

    // 3. Create notifications for reminders
    for (const schedule of reminders) {
      const days = daysUntilDeadline(schedule.startDate);
      const message = formatReminderMessage(schedule.title, days);

      // Get all org members to notify
      const members = await prisma.orgMember.findMany({
        where: { orgId: org.id },
        select: { userId: true },
      });

      for (const member of members) {
        await prisma.notification.create({
          data: {
            userId: member.userId,
            type: "DEADLINE",
            title: message,
            body: schedule.description,
            link: `/calendar?date=${schedule.startDate.toISOString().split("T")[0]}`,
          },
        });
      }
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    reminders: totalReminders,
    orgs: orgs.length,
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run tests/reminder.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/calendar/reminder.ts apps/web/src/app/api/cron/schedule-sync/ apps/web/tests/reminder.test.ts
git commit -m "feat: add reminder logic and Vercel Cron schedule-sync job with deadline alerts"
```

---

## Task 7: Calendar UI Components

**Files:**
- Create: `apps/web/src/app/(app)/calendar/page.tsx`
- Create: `apps/web/src/app/(app)/calendar/loading.tsx`
- Create: `apps/web/src/app/(app)/calendar/_components/calendar-view.tsx`
- Create: `apps/web/src/app/(app)/calendar/_components/month-grid.tsx`
- Create: `apps/web/src/app/(app)/calendar/_components/schedule-dialog.tsx`
- Create: `apps/web/src/app/(app)/calendar/_components/schedule-filters.tsx`
- Create: `apps/web/src/app/(app)/calendar/_components/schedule-card.tsx`

- [ ] **Step 1: Create calendar page**

Create `apps/web/src/app/(app)/calendar/page.tsx`:

```tsx
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { getMonthSchedules } from "@/lib/calendar/schedule-service";
import { CalendarView } from "./_components/calendar-view";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; orgId?: string }>;
}) {
  const params = await searchParams;
  const orgId = params.orgId ?? ""; // In production, from session/context
  const now = new Date();
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1;

  let schedules: Awaited<ReturnType<typeof getMonthSchedules>> = [];

  if (orgId) {
    await getVerifiedOrgMember(orgId);
    schedules = await getMonthSchedules(orgId, year, month);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">일정 관리</h1>
      </div>
      <CalendarView
        schedules={schedules}
        year={year}
        month={month}
        orgId={orgId}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create calendar loading skeleton**

Create `apps/web/src/app/(app)/calendar/loading.tsx`:

```tsx
export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded bg-muted" />
          <div className="h-10 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create calendar view component**

Create `apps/web/src/app/(app)/calendar/_components/calendar-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@axle/ui/button";
import { MonthGrid } from "./month-grid";
import { ScheduleFilters } from "./schedule-filters";
import { ScheduleDialog } from "./schedule-dialog";
import type { Schedule, ScheduleType } from "@axle/db";

type ViewMode = "month" | "week" | "day";

interface CalendarViewProps {
  schedules: Schedule[];
  year: number;
  month: number;
  orgId: string;
}

export function CalendarView({
  schedules,
  year,
  month,
  orgId,
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [activeTypes, setActiveTypes] = useState<ScheduleType[]>([
    "DEADLINE",
    "MEETING",
    "REMINDER",
    "PROGRAM_DUE",
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const filteredSchedules = schedules.filter((s) =>
    activeTypes.includes(s.type)
  );

  const monthName = new Date(year, month - 1).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });

  function navigateMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    window.location.href = `/calendar?year=${newYear}&month=${newMonth}&orgId=${orgId}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
            &larr;
          </Button>
          <span className="text-lg font-semibold">{monthName}</span>
          <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
            &rarr;
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <ScheduleFilters
            activeTypes={activeTypes}
            onTypesChange={setActiveTypes}
          />
          <div className="flex rounded-md border">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(mode)}
              >
                {mode === "month" ? "월" : mode === "week" ? "주" : "일"}
              </Button>
            ))}
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>+ 일정 추가</Button>
        </div>
      </div>

      {viewMode === "month" && (
        <MonthGrid
          schedules={filteredSchedules}
          year={year}
          month={month}
          onDateClick={(date) => {
            setSelectedDate(date);
            setIsDialogOpen(true);
          }}
        />
      )}

      <ScheduleDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        orgId={orgId}
        defaultDate={selectedDate}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create month grid component**

Create `apps/web/src/app/(app)/calendar/_components/month-grid.tsx`:

```tsx
"use client";

import type { Schedule } from "@axle/db";
import { ScheduleCard } from "./schedule-card";

interface MonthGridProps {
  schedules: Schedule[];
  year: number;
  month: number;
  onDateClick: (date: Date) => void;
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthGrid({ schedules, year, month, onDateClick }: MonthGridProps) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build grid cells
  const cells: Array<{ date: Date | null; schedules: Schedule[] }> = [];

  // Leading empty cells
  for (let i = 0; i < startDow; i++) {
    cells.push({ date: null, schedules: [] });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const daySchedules = schedules.filter((s) => {
      const sd = new Date(s.startDate);
      return (
        sd.getFullYear() === year &&
        sd.getMonth() === month - 1 &&
        sd.getDate() === d
      );
    });
    cells.push({ date, schedules: daySchedules });
  }

  return (
    <div>
      <div className="grid grid-cols-7 border-b">
        {DAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`p-2 text-center text-sm font-medium ${
              idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-muted-foreground"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const isToday =
            cell.date && cell.date.getTime() === today.getTime();

          return (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r p-1 ${
                cell.date ? "cursor-pointer hover:bg-accent/50" : "bg-muted/30"
              } ${isToday ? "bg-primary/5" : ""}`}
              onClick={() => cell.date && onDateClick(cell.date)}
            >
              {cell.date && (
                <>
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : ""
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {cell.schedules.slice(0, 3).map((s) => (
                      <ScheduleCard key={s.id} schedule={s} compact />
                    ))}
                    {cell.schedules.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{cell.schedules.length - 3}개 더
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create schedule card, dialog, and filters**

Create `apps/web/src/app/(app)/calendar/_components/schedule-card.tsx`:

```tsx
import type { Schedule, ScheduleType } from "@axle/db";
import { Badge } from "@axle/ui/badge";

const TYPE_COLORS: Record<ScheduleType, string> = {
  DEADLINE: "bg-red-100 text-red-800",
  MEETING: "bg-blue-100 text-blue-800",
  REMINDER: "bg-yellow-100 text-yellow-800",
  PROGRAM_DUE: "bg-purple-100 text-purple-800",
};

const TYPE_LABELS: Record<ScheduleType, string> = {
  DEADLINE: "마감",
  MEETING: "미팅",
  REMINDER: "리마인더",
  PROGRAM_DUE: "사업마감",
};

interface ScheduleCardProps {
  schedule: Schedule;
  compact?: boolean;
}

export function ScheduleCard({ schedule, compact }: ScheduleCardProps) {
  if (compact) {
    return (
      <div
        className={`truncate rounded px-1 py-0.5 text-[10px] ${
          TYPE_COLORS[schedule.type]
        }`}
      >
        {schedule.title}
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{schedule.title}</h4>
        <Badge className={TYPE_COLORS[schedule.type]} variant="secondary">
          {TYPE_LABELS[schedule.type]}
        </Badge>
      </div>
      {schedule.description && (
        <p className="mt-1 text-sm text-muted-foreground">
          {schedule.description}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {new Date(schedule.startDate).toLocaleDateString("ko-KR")}
        {schedule.endDate &&
          ` ~ ${new Date(schedule.endDate).toLocaleDateString("ko-KR")}`}
      </p>
    </div>
  );
}
```

Create `apps/web/src/app/(app)/calendar/_components/schedule-filters.tsx`:

```tsx
"use client";

import type { ScheduleType } from "@axle/db";
import { Badge } from "@axle/ui/badge";

const TYPES: Array<{ value: ScheduleType; label: string; color: string }> = [
  { value: "DEADLINE", label: "마감", color: "bg-red-100 text-red-800" },
  { value: "MEETING", label: "미팅", color: "bg-blue-100 text-blue-800" },
  { value: "REMINDER", label: "리마인더", color: "bg-yellow-100 text-yellow-800" },
  { value: "PROGRAM_DUE", label: "사업마감", color: "bg-purple-100 text-purple-800" },
];

interface ScheduleFiltersProps {
  activeTypes: ScheduleType[];
  onTypesChange: (types: ScheduleType[]) => void;
}

export function ScheduleFilters({
  activeTypes,
  onTypesChange,
}: ScheduleFiltersProps) {
  function toggleType(type: ScheduleType) {
    if (activeTypes.includes(type)) {
      onTypesChange(activeTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...activeTypes, type]);
    }
  }

  return (
    <div className="flex gap-1">
      {TYPES.map(({ value, label, color }) => (
        <Badge
          key={value}
          variant={activeTypes.includes(value) ? "default" : "outline"}
          className={`cursor-pointer ${
            activeTypes.includes(value) ? color : "opacity-50"
          }`}
          onClick={() => toggleType(value)}
        >
          {label}
        </Badge>
      ))}
    </div>
  );
}
```

Create `apps/web/src/app/(app)/calendar/_components/schedule-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  defaultDate?: Date | null;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  orgId,
  defaultDate,
}: ScheduleDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("MEETING");
  const [startDate, setStartDate] = useState(
    defaultDate?.toISOString().split("T")[0] ??
      new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          title,
          type,
          startDate: new Date(startDate),
          isAllDay: true,
        }),
      });
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to create schedule:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">일정 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">유형</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="DEADLINE">마감</option>
              <option value="MEETING">미팅</option>
              <option value="REMINDER">리마인더</option>
              <option value="PROGRAM_DUE">사업 마감</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">날짜</Label>
            <Input
              id="date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/calendar/
git commit -m "feat: add calendar UI with monthly grid, schedule CRUD dialog, and type filters"
```

---

## Task 8: Program Management Pages

**Files:**
- Create: `apps/web/src/app/(app)/programs/page.tsx`
- Create: `apps/web/src/app/(app)/programs/[programId]/page.tsx`
- Create: `apps/web/src/app/(app)/programs/_components/program-list.tsx`
- Create: `apps/web/src/app/(app)/programs/_components/program-form.tsx`

- [ ] **Step 1: Create program list page**

Create `apps/web/src/app/(app)/programs/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { ProgramList } from "./_components/program-list";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; category?: string; search?: string }>;
}) {
  const params = await searchParams;
  const orgId = params.orgId ?? "";

  if (!orgId) {
    return <p className="text-muted-foreground">조직을 선택해주세요.</p>;
  }

  await getVerifiedOrgMember(orgId);

  const where: Record<string, unknown> = { orgId };
  if (params.category) where.category = params.category;
  if (params.search) where.name = { contains: params.search, mode: "insensitive" };

  const programs = await prisma.programInfo.findMany({
    where,
    orderBy: { applicationEnd: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">지원사업 관리</h1>
      </div>
      <ProgramList programs={programs} orgId={orgId} />
    </div>
  );
}
```

- [ ] **Step 2: Create program list component**

Create `apps/web/src/app/(app)/programs/_components/program-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ProgramInfo, ProgramCategory } from "@axle/db";
import { Badge } from "@axle/ui/badge";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";

const CATEGORY_LABELS: Record<ProgramCategory, string> = {
  STARTUP: "창업",
  VENTURE: "벤처",
  RND: "R&D",
  CERTIFICATION: "인증",
  EXPORT: "수출",
  SMART_FACTORY: "스마트공장",
  GENERAL: "일반",
};

interface ProgramListProps {
  programs: ProgramInfo[];
  orgId: string;
}

export function ProgramList({ programs, orgId }: ProgramListProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const filtered = programs.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (categoryFilter && p.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="사업명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">전체 카테고리</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">사업명</th>
              <th className="px-4 py-3 text-left text-sm font-medium">주관기관</th>
              <th className="px-4 py-3 text-left text-sm font-medium">카테고리</th>
              <th className="px-4 py-3 text-left text-sm font-medium">마감일</th>
              <th className="px-4 py-3 text-left text-sm font-medium">최대지원금</th>
              <th className="px-4 py-3 text-left text-sm font-medium">소스</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((program) => {
              const daysLeft = program.applicationEnd
                ? Math.ceil(
                    (new Date(program.applicationEnd).getTime() -
                      Date.now()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;

              return (
                <tr
                  key={program.id}
                  className="cursor-pointer border-b hover:bg-accent/50"
                  onClick={() =>
                    (window.location.href = `/programs/${program.id}`)
                  }
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    {program.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {program.agency ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[program.category]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {program.applicationEnd ? (
                      <span
                        className={
                          daysLeft !== null && daysLeft <= 7
                            ? "font-semibold text-red-600"
                            : ""
                        }
                      >
                        {new Date(program.applicationEnd).toLocaleDateString(
                          "ko-KR"
                        )}
                        {daysLeft !== null && daysLeft >= 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (D-{daysLeft})
                          </span>
                        )}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {program.maxFunding
                      ? `${(Number(program.maxFunding) / 100000000).toFixed(1)}억`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={program.isCrawled ? "default" : "outline"}>
                      {program.isCrawled ? "크롤링" : "수동"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">
            지원사업 정보가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create program detail page**

Create `apps/web/src/app/(app)/programs/[programId]/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  await getVerifiedUser();

  const program = await prisma.programInfo.findUnique({
    where: { id: programId },
    include: {
      projects: { select: { id: true, title: true, status: true, client: { select: { name: true } } } },
      schedules: { select: { id: true, title: true, type: true, startDate: true } },
    },
  });

  if (!program) {
    return <p className="text-muted-foreground">지원사업을 찾을 수 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{program.name}</h1>
          {program.agency && (
            <p className="text-muted-foreground">{program.agency}</p>
          )}
        </div>
        <Badge>{program.category}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">접수기간</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {program.applicationStart
                ? new Date(program.applicationStart).toLocaleDateString("ko-KR")
                : "미정"}{" "}
              ~{" "}
              {program.applicationEnd
                ? new Date(program.applicationEnd).toLocaleDateString("ko-KR")
                : "미정"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">최대지원금</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {program.maxFunding
                ? `${(Number(program.maxFunding) / 100000000).toFixed(1)}억원`
                : "미정"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">연결 프로젝트</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{program.projects.length}건</p>
          </CardContent>
        </Card>
      </div>

      {program.memo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">메모</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{program.memo}</p>
          </CardContent>
        </Card>
      )}

      {program.projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>연결된 프로젝트</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {program.projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{project.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {project.client.name}
                    </p>
                  </div>
                  <Badge variant="outline">{project.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/programs/
git commit -m "feat: add ProgramInfo management pages with list, detail, and filters"
```

---

## Task 9: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run
```

Expected: All tests PASS (schedule-service, program-deadline, reminder, google-calendar).

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Verify dev server starts**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected: Next.js dev server starts. Calendar page renders at `/calendar`. Programs page renders at `/programs`.

- [ ] **Step 4: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 7 complete — calendar, schedules, program management, Google Calendar sync"
```

---

## Summary

Phase 7 delivers:
- **Schedule CRUD**: Create/edit/delete schedules with type filtering (DEADLINE, MEETING, REMINDER, PROGRAM_DUE)
- **Calendar UI**: Monthly grid view with color-coded schedule types, date click to add, schedule dialog
- **Program Deadline Auto-Creation**: ProgramInfo.applicationEnd automatically creates PROGRAM_DUE schedules
- **Reminder System**: D-N reminder generation (30, 14, 7, 3, 1 day alerts) with cron-based notifications
- **Google Calendar Sync**: OAuth flow, bidirectional sync (AXLE to Google, Google to AXLE), Vercel Cron daily sync
- **ProgramInfo Management**: Filterable list, detail view with linked projects, category/region/deadline filters
- **API Routes**: Full REST for schedules and programs with Zod validation
- **Cron Job**: `schedule-sync` for daily deadline sync and reminder notifications

**Next:** Phase 8 (Matching & Crawler) builds on ProgramInfo for AI-powered client-program matching and automated government portal crawling.
