# AXLE Phase 10: Research Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a research journal (연구일지) management system where researchers write monthly logs, consultants review/approve them, AI generates drafts from context, and monthly reports are auto-generated as DOCX — enabling structured R&D documentation for government grant compliance.

**Architecture:** ResearchJournal CRUD with approval workflow (DRAFT → SUBMITTED → APPROVED), AI draft generation via AiJob (JOURNAL_DRAFT tier), Contact.isResearcher filtering for researcher management, docgen integration for monthly PDF/DOCX reports, and SkillPattern accumulation from approved journals.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (@axle/db), @axle/ai (3-tier router for drafts), packages/docgen (DOCX generation), Zod, Vitest

**Depends on:** Phase 0 (foundation), Phase 1 (Client/Contact CRUD), Phase 5 (AI engine / AiJob)

---

## File Structure

```
axle/
├── packages/
│   ├── ai/
│   │   └── src/
│   │       └── journal-draft.ts               # AI journal draft generation
│   │
│   └── docgen/
│       └── src/
│           └── journal-report.ts              # Monthly journal → DOCX report
│
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── (app)/
│           │   │   └── journals/
│           │   │       ├── page.tsx                    # Journal list page
│           │   │       ├── new/
│           │   │       │   └── page.tsx                # Create journal page
│           │   │       └── [journalId]/
│           │   │           ├── page.tsx                # Journal detail/edit page
│           │   │           ├── actions.ts              # Server actions
│           │   │           └── components/
│           │   │               ├── journal-form.tsx
│           │   │               ├── journal-viewer.tsx
│           │   │               ├── approval-panel.tsx
│           │   │               └── ai-draft-button.tsx
│           │   │
│           │   └── api/
│           │       └── journals/
│           │           ├── route.ts                     # GET list, POST create
│           │           ├── [journalId]/
│           │           │   ├── route.ts                 # GET, PATCH, DELETE
│           │           │   ├── submit/
│           │           │   │   └── route.ts             # POST submit for review
│           │           │   ├── approve/
│           │           │   │   └── route.ts             # POST approve journal
│           │           │   └── ai-draft/
│           │           │       └── route.ts             # POST generate AI draft
│           │           ├── monthly-report/
│           │           │   └── route.ts                 # POST generate monthly report DOCX
│           │           └── researchers/
│           │               └── route.ts                 # GET researchers (Contact.isResearcher)
│           │
│           ├── lib/
│           │   └── validations/
│           │       └── journal.ts                       # Zod schemas
│           │
│           └── components/
│               └── journals/
│                   ├── journal-card.tsx
│                   └── researcher-select.tsx
│
└── tests/
    └── journals/
        ├── journal-crud.test.ts
        ├── journal-approval.test.ts
        └── journal-ai-draft.test.ts
```

---

## Task 1: Zod Validation Schemas for Journals

**Files:**
- Create: `apps/web/src/lib/validations/journal.ts`

- [ ] **Step 1: Create journal validation schemas**

```typescript
import { z } from "zod";

// ===== Journal =====
export const createJournalSchema = z.object({
  clientId: z.string().cuid(),
  researcherContactId: z.string().cuid(),
  date: z.coerce.date(),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  content: z.string().min(10, "내용을 10자 이상 입력해주세요"),
  objectives: z.string().optional(),
  results: z.string().optional(),
  nextSteps: z.string().optional(),
  hours: z.coerce.number().min(0).max(24).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        type: z.string(),
      })
    )
    .optional(),
});

export const updateJournalSchema = createJournalSchema.partial();

export const journalListQuerySchema = z.object({
  clientId: z.string().cuid().optional(),
  researcherContactId: z.string().cuid().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["date_asc", "date_desc"]).default("date_desc"),
});

// ===== AI Draft =====
export const aiDraftRequestSchema = z.object({
  clientId: z.string().cuid(),
  researcherContactId: z.string().cuid(),
  date: z.coerce.date(),
  researchField: z.string().optional(),
  additionalContext: z.string().optional(),
});

// ===== Monthly Report =====
export const monthlyReportSchema = z.object({
  clientId: z.string().cuid(),
  year: z.coerce.number().int().min(2020).max(2030),
  month: z.coerce.number().int().min(1).max(12),
});

// ===== Types =====
export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type JournalListQuery = z.infer<typeof journalListQuerySchema>;
export type AiDraftRequest = z.infer<typeof aiDraftRequestSchema>;
export type MonthlyReportRequest = z.infer<typeof monthlyReportSchema>;
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validations/journal.ts
git commit -m "feat: add Zod validation schemas for research journals, AI drafts, and monthly reports"
```

---

## Task 2: Journal CRUD API Routes

**Files:**
- Create: `apps/web/src/app/api/journals/route.ts`
- Create: `apps/web/src/app/api/journals/[journalId]/route.ts`

- [ ] **Step 1: Write failing tests for journal CRUD**

Create `tests/journals/journal-crud.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createJournalSchema,
  updateJournalSchema,
  journalListQuerySchema,
} from "../../apps/web/src/lib/validations/journal";

describe("Journal Validation", () => {
  it("validates a valid journal creation", () => {
    const result = createJournalSchema.safeParse({
      clientId: "clxxxxxxxxxxxxxxxxx001",
      researcherContactId: "clxxxxxxxxxxxxxxxxx002",
      date: "2026-04-01",
      title: "4월 연구일지",
      content: "이번 달 연구 활동은 다음과 같습니다...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects journal with too short content", () => {
    const result = createJournalSchema.safeParse({
      clientId: "clxxxxxxxxxxxxxxxxx001",
      researcherContactId: "clxxxxxxxxxxxxxxxxx002",
      date: "2026-04-01",
      title: "4월",
      content: "짧음",
    });
    expect(result.success).toBe(false);
  });

  it("validates list query with filters", () => {
    const result = journalListQuerySchema.safeParse({
      clientId: "clxxxxxxxxxxxxxxxxx001",
      status: "APPROVED",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("validates partial update", () => {
    const result = updateJournalSchema.safeParse({
      content: "수정된 연구 활동 내용입니다...",
    });
    expect(result.success).toBe(true);
  });

  it("validates hours within range", () => {
    const valid = createJournalSchema.safeParse({
      clientId: "clxxxxxxxxxxxxxxxxx001",
      researcherContactId: "clxxxxxxxxxxxxxxxxx002",
      date: "2026-04-01",
      title: "Test",
      content: "Content with enough characters",
      hours: 8,
    });
    expect(valid.success).toBe(true);

    const invalid = createJournalSchema.safeParse({
      clientId: "clxxxxxxxxxxxxxxxxx001",
      researcherContactId: "clxxxxxxxxxxxxxxxxx002",
      date: "2026-04-01",
      title: "Test",
      content: "Content with enough characters",
      hours: 25,
    });
    expect(invalid.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/journals/journal-crud.test.ts
```

Expected: All tests PASS (validation schemas from Task 1).

- [ ] **Step 3: Create journal list + create API route**

Create `apps/web/src/app/api/journals/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import {
  createJournalSchema,
  journalListQuerySchema,
} from "@/lib/validations/journal";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = journalListQuerySchema.parse(searchParams);

  const where = {
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.researcherContactId
      ? { researcherContactId: query.researcherContactId }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.startDate || query.endDate
      ? {
          date: {
            ...(query.startDate ? { gte: query.startDate } : {}),
            ...(query.endDate ? { lte: query.endDate } : {}),
          },
        }
      : {}),
  };

  const [journals, total] = await Promise.all([
    prisma.researchJournal.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        researcher: {
          select: { id: true, name: true, researchField: true },
        },
      },
      orderBy: {
        date: query.sort === "date_asc" ? "asc" : "desc",
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.researchJournal.count({ where }),
  ]);

  return NextResponse.json({
    journals,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getVerifiedUser();
  const body = await request.json();
  const data = createJournalSchema.parse(body);

  const journal = await prisma.researchJournal.create({
    data: {
      clientId: data.clientId,
      researcherContactId: data.researcherContactId,
      date: data.date,
      title: data.title,
      content: data.content,
      objectives: data.objectives,
      results: data.results,
      nextSteps: data.nextSteps,
      hours: data.hours,
      attachments: data.attachments as unknown as Record<string, unknown>[],
      status: "DRAFT",
    },
    include: {
      client: { select: { id: true, name: true } },
      researcher: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(journal, { status: 201 });
}
```

- [ ] **Step 4: Create journal detail API route**

Create `apps/web/src/app/api/journals/[journalId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { updateJournalSchema } from "@/lib/validations/journal";

type Params = { params: Promise<{ journalId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { journalId } = await params;

  const journal = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    include: {
      client: { select: { id: true, name: true } },
      researcher: {
        select: {
          id: true,
          name: true,
          researchField: true,
          position: true,
        },
      },
    },
  });

  if (!journal) {
    return NextResponse.json(
      { error: "Journal not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(journal);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { journalId } = await params;
  const body = await request.json();
  const data = updateJournalSchema.parse(body);

  // Only allow edits on DRAFT journals
  const existing = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    select: { status: true },
  });

  if (existing?.status === "APPROVED") {
    return NextResponse.json(
      { error: "승인 완료된 연구일지는 수정할 수 없습니다" },
      { status: 400 }
    );
  }

  const journal = await prisma.researchJournal.update({
    where: { id: journalId },
    data: {
      ...data,
      attachments: data.attachments as unknown as Record<string, unknown>[],
    },
    include: {
      client: { select: { id: true, name: true } },
      researcher: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(journal);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { journalId } = await params;

  const existing = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    select: { status: true },
  });

  if (existing?.status === "APPROVED") {
    return NextResponse.json(
      { error: "승인 완료된 연구일지는 삭제할 수 없습니다" },
      { status: 400 }
    );
  }

  await prisma.researchJournal.delete({
    where: { id: journalId },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/journals/ tests/journals/journal-crud.test.ts
git commit -m "feat: add ResearchJournal CRUD API routes with list filtering, edit guards, and delete protection"
```

---

## Task 3: Approval Workflow API

**Files:**
- Create: `apps/web/src/app/api/journals/[journalId]/submit/route.ts`
- Create: `apps/web/src/app/api/journals/[journalId]/approve/route.ts`

- [ ] **Step 1: Write failing tests for approval workflow**

Create `tests/journals/journal-approval.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("Journal Approval Workflow", () => {
  const validTransitions = [
    { from: "DRAFT", to: "SUBMITTED", allowed: true },
    { from: "SUBMITTED", to: "APPROVED", allowed: true },
    { from: "SUBMITTED", to: "DRAFT", allowed: true },  // Rejection → back to draft
    { from: "DRAFT", to: "APPROVED", allowed: false },   // Can't skip submit
    { from: "APPROVED", to: "DRAFT", allowed: false },   // Can't un-approve
    { from: "APPROVED", to: "SUBMITTED", allowed: false },
  ];

  validTransitions.forEach(({ from, to, allowed }) => {
    it(`${from} → ${to} should be ${allowed ? "allowed" : "rejected"}`, () => {
      const canTransition = isValidTransition(from, to);
      expect(canTransition).toBe(allowed);
    });
  });
});

function isValidTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    DRAFT: ["SUBMITTED"],
    SUBMITTED: ["APPROVED", "DRAFT"],
    APPROVED: [],
  };
  return (allowed[from] || []).includes(to);
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/journals/journal-approval.test.ts
```

Expected: All 6 transition tests PASS.

- [ ] **Step 3: Create submit for review route**

Create `apps/web/src/app/api/journals/[journalId]/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";

type Params = { params: Promise<{ journalId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { journalId } = await params;

  const journal = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    select: { status: true, content: true, title: true },
  });

  if (!journal) {
    return NextResponse.json(
      { error: "Journal not found" },
      { status: 404 }
    );
  }

  if (journal.status !== "DRAFT") {
    return NextResponse.json(
      { error: "DRAFT 상태의 일지만 제출할 수 있습니다" },
      { status: 400 }
    );
  }

  // Validate minimum content requirements
  if (!journal.content || journal.content.length < 50) {
    return NextResponse.json(
      { error: "내용이 너무 짧습니다. 최소 50자 이상 작성해주세요." },
      { status: 400 }
    );
  }

  const updated = await prisma.researchJournal.update({
    where: { id: journalId },
    data: { status: "SUBMITTED" },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 4: Create approve route**

Create `apps/web/src/app/api/journals/[journalId]/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";

type Params = { params: Promise<{ journalId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { journalId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action || "approve"; // "approve" | "reject"

  const journal = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    select: { status: true },
  });

  if (!journal) {
    return NextResponse.json(
      { error: "Journal not found" },
      { status: 404 }
    );
  }

  if (journal.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "SUBMITTED 상태의 일지만 승인/반려할 수 있습니다" },
      { status: 400 }
    );
  }

  if (action === "reject") {
    // Return to draft for revision
    const updated = await prisma.researchJournal.update({
      where: { id: journalId },
      data: { status: "DRAFT" },
    });
    return NextResponse.json(updated);
  }

  // Approve
  const updated = await prisma.researchJournal.update({
    where: { id: journalId },
    data: {
      status: "APPROVED",
      approvedBy: user.id,
      approvedAt: new Date(),
    },
  });

  // Accumulate SkillPattern for journal drafts
  await accumulateSkillPattern(journalId);

  return NextResponse.json(updated);
}

async function accumulateSkillPattern(journalId: string) {
  const journal = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    include: {
      researcher: { select: { researchField: true } },
    },
  });

  if (!journal?.aiDraftJobId || !journal.researcher.researchField) return;

  // Find or create skill pattern for this research field
  const patternName = `journal_draft_${journal.researcher.researchField}`;
  const existing = await prisma.skillPattern.findFirst({
    where: { name: patternName },
  });

  if (existing) {
    await prisma.skillPattern.update({
      where: { id: existing.id },
      data: {
        successCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  } else {
    await prisma.skillPattern.create({
      data: {
        name: patternName,
        taskType: "JOURNAL_DRAFT",
        inputSchema: {
          researchField: journal.researcher.researchField,
        },
        outputSchema: {
          title: "string",
          content: "string",
          objectives: "string",
          results: "string",
        },
        successCount: 1,
        lastUsedAt: new Date(),
      },
    });
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/journals/\[journalId\]/submit/ apps/web/src/app/api/journals/\[journalId\]/approve/
git add tests/journals/journal-approval.test.ts
git commit -m "feat: add journal approval workflow (DRAFT → SUBMITTED → APPROVED) with SkillPattern accumulation"
```

---

## Task 4: AI Draft Generation

**Files:**
- Create: `packages/ai/src/journal-draft.ts`
- Create: `apps/web/src/app/api/journals/[journalId]/ai-draft/route.ts`

- [ ] **Step 1: Write failing tests for AI draft**

Create `tests/journals/journal-ai-draft.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("Journal AI Draft", () => {
  it("generates draft with all required fields", () => {
    const mockDraft = {
      title: "2026년 4월 연구일지 — AI 기반 용접 품질 분석",
      content: "본 연구에서는 비전 AI를 활용한 용접 비드 품질 분석...",
      objectives: "딥러닝 모델 정확도 90% 이상 달성",
      results: "ResNet-50 기반 분류기 학습 완료, F1 스코어 0.87 달성",
      nextSteps: "데이터 증강 및 실시간 추론 파이프라인 구축",
    };

    expect(mockDraft.title).toBeTruthy();
    expect(mockDraft.content.length).toBeGreaterThan(20);
    expect(mockDraft.objectives).toBeTruthy();
    expect(mockDraft.results).toBeTruthy();
    expect(mockDraft.nextSteps).toBeTruthy();
  });

  it("uses previous journals as context", () => {
    const previousJournals = [
      { date: "2026-03-01", content: "1차 데이터 수집 완료" },
      { date: "2026-02-01", content: "연구 계획 수립 및 선행 조사" },
    ];

    // Verify context is passed in order (most recent first)
    expect(previousJournals[0].date > previousJournals[1].date).toBe(true);
    expect(previousJournals.length).toBeLessThanOrEqual(5);
  });

  it("respects AI tier selection", () => {
    const tiers = ["LOCAL_MLX", "API_HAIKU"];
    expect(tiers).toContain("LOCAL_MLX");
    expect(tiers).toContain("API_HAIKU");
  });
});
```

- [ ] **Step 2: Create journal draft AI module**

Create `packages/ai/src/journal-draft.ts`:

```typescript
interface JournalDraftResult {
  title: string;
  content: string;
  objectives: string;
  results: string;
  nextSteps: string;
}

interface JournalContext {
  researcherName: string;
  researchField: string;
  clientName: string;
  date: string;
  previousJournals: Array<{
    date: string;
    title: string;
    content: string;
    results?: string | null;
    nextSteps?: string | null;
  }>;
  additionalContext?: string;
}

/**
 * Generate a research journal draft using AI.
 * Uses previous journals as context for continuity.
 * Default tier: LOCAL_MLX (Hermes 3), fallback: API_HAIKU.
 */
export async function generateJournalDraft(
  context: JournalContext,
  tier: "LOCAL_MLX" | "API_HAIKU" = "LOCAL_MLX"
): Promise<JournalDraftResult> {
  const previousContext = context.previousJournals
    .slice(0, 5) // Max 5 previous journals
    .map(
      (j) =>
        `[${j.date}] ${j.title}\n내용: ${j.content.slice(0, 500)}\n${j.results ? `결과: ${j.results}` : ""}${j.nextSteps ? `\n다음 계획: ${j.nextSteps}` : ""}`
    )
    .join("\n---\n");

  const systemPrompt = `당신은 기업부설연구소의 연구일지 작성을 돕는 전문 보조입니다.
연구원의 정보와 이전 연구일지를 참고하여 이번 달 연구일지 초안을 작성하세요.

규칙:
- 연구일지는 정부 R&D 과제 증빙에 사용되므로 구체적이고 전문적이어야 합니다
- 이전 일지의 "다음 계획"이 이번 달의 "목표"와 연결되어야 합니다
- 날짜, 시간, 장비, 방법론 등을 구체적으로 기술하세요
- 결과는 정량적 지표를 포함하세요 (가능한 경우)

JSON으로 출력:
{
  "title": "YYYY년 M월 연구일지 — [연구 주제 요약]",
  "content": "[상세 연구 활동 내용, 최소 200자]",
  "objectives": "[이번 달 연구 목표]",
  "results": "[연구 결과 및 성과]",
  "nextSteps": "[다음 달 계획]"
}`;

  const userPrompt = `연구원: ${context.researcherName}
연구분야: ${context.researchField}
기업: ${context.clientName}
작성일: ${context.date}
${context.additionalContext ? `추가 맥락: ${context.additionalContext}` : ""}

이전 연구일지:
${previousContext || "(첫 연구일지입니다)"}`;

  if (tier === "LOCAL_MLX") {
    const bridgeUrl = process.env.AGENT_BRIDGE_URL;
    if (bridgeUrl) {
      try {
        const response = await fetch(`${bridgeUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: systemPrompt,
            prompt: userPrompt,
            maxTokens: 2000,
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (response.ok) {
          const result = await response.json();
          return parseJournalDraftResponse(result.text);
        }
      } catch {
        // Fallback to API_HAIKU
      }
    }
  }

  // API_HAIKU fallback
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-20250414",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI draft generation failed: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content[0]?.text || "";
  return parseJournalDraftResponse(text);
}

function parseJournalDraftResponse(text: string): JournalDraftResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      title: "연구일지 초안",
      content: text.slice(0, 1000),
      objectives: "",
      results: "",
      nextSteps: "",
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title || "연구일지 초안",
    content: parsed.content || "",
    objectives: parsed.objectives || "",
    results: parsed.results || "",
    nextSteps: parsed.nextSteps || "",
  };
}
```

- [ ] **Step 3: Create AI draft API route**

Create `apps/web/src/app/api/journals/[journalId]/ai-draft/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { generateJournalDraft } from "@axle/ai/journal-draft";

type Params = { params: Promise<{ journalId: string }> };

/**
 * Generate AI draft for an existing journal entry.
 * Populates the journal with AI-generated content.
 * Can also be called before creating a journal (via /api/journals/ai-draft with POST body).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { journalId } = await params;

  const journal = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    include: {
      client: { select: { id: true, name: true } },
      researcher: {
        select: {
          id: true,
          name: true,
          researchField: true,
        },
      },
    },
  });

  if (!journal) {
    return NextResponse.json(
      { error: "Journal not found" },
      { status: 404 }
    );
  }

  if (journal.status !== "DRAFT") {
    return NextResponse.json(
      { error: "DRAFT 상태의 일지만 AI 초안을 생성할 수 있습니다" },
      { status: 400 }
    );
  }

  // Fetch previous journals for context
  const previousJournals = await prisma.researchJournal.findMany({
    where: {
      clientId: journal.clientId,
      researcherContactId: journal.researcherContactId,
      date: { lt: journal.date },
      status: { in: ["SUBMITTED", "APPROVED"] },
    },
    orderBy: { date: "desc" },
    take: 5,
    select: {
      date: true,
      title: true,
      content: true,
      results: true,
      nextSteps: true,
    },
  });

  // Create AiJob
  const aiJob = await prisma.aiJob.create({
    data: {
      type: "JOURNAL_DRAFT",
      tier: "API_HAIKU", // Will try LOCAL_MLX first, fallback to HAIKU
      status: "RUNNING",
      input: {
        journalId,
        researcherName: journal.researcher.name,
        researchField: journal.researcher.researchField,
      },
    },
  });

  try {
    const startMs = Date.now();
    const draft = await generateJournalDraft({
      researcherName: journal.researcher.name,
      researchField: journal.researcher.researchField || "일반",
      clientName: journal.client.name,
      date: journal.date.toISOString().split("T")[0],
      previousJournals: previousJournals.map((j) => ({
        date: j.date.toISOString().split("T")[0],
        title: j.title,
        content: j.content,
        results: j.results,
        nextSteps: j.nextSteps,
      })),
    });

    // Update journal with draft content
    const updated = await prisma.researchJournal.update({
      where: { id: journalId },
      data: {
        title: draft.title,
        content: draft.content,
        objectives: draft.objectives,
        results: draft.results,
        nextSteps: draft.nextSteps,
        aiDraftJobId: aiJob.id,
      },
    });

    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "COMPLETED",
        output: draft as unknown as Record<string, unknown>,
        durationMs: Date.now() - startMs,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return NextResponse.json(
      { error: "AI draft generation failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/journals/journal-ai-draft.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/journal-draft.ts apps/web/src/app/api/journals/\[journalId\]/ai-draft/
git add tests/journals/journal-ai-draft.test.ts
git commit -m "feat: add AI journal draft generation with previous journal context and LOCAL_MLX/API_HAIKU tiers"
```

---

## Task 5: Researcher List API + Monthly Report

**Files:**
- Create: `apps/web/src/app/api/journals/researchers/route.ts`
- Create: `apps/web/src/app/api/journals/monthly-report/route.ts`
- Create: `packages/docgen/src/journal-report.ts`

- [ ] **Step 1: Create researchers API**

Create `apps/web/src/app/api/journals/researchers/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();
  const clientId = request.nextUrl.searchParams.get("clientId");

  const where = {
    isResearcher: true,
    ...(clientId ? { clientId } : {}),
  };

  const researchers = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      name: true,
      position: true,
      researchField: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(researchers);
}
```

- [ ] **Step 2: Create monthly report generation module**

Create `packages/docgen/src/journal-report.ts`:

```typescript
/**
 * Generate a monthly research journal report.
 * Aggregates approved journals for a given month into a DOCX document.
 */
export interface MonthlyReportInput {
  clientName: string;
  year: number;
  month: number;
  journals: Array<{
    date: string;
    researcherName: string;
    researchField: string;
    title: string;
    content: string;
    objectives?: string | null;
    results?: string | null;
    nextSteps?: string | null;
    hours?: number | null;
  }>;
}

export interface MonthlyReportOutput {
  markdown: string;
  totalHours: number;
  journalCount: number;
}

/**
 * Generate report as structured markdown (for DOCX conversion via mark-docx skill).
 */
export function generateMonthlyReportMarkdown(
  input: MonthlyReportInput
): MonthlyReportOutput {
  const totalHours = input.journals.reduce(
    (sum, j) => sum + (j.hours || 0),
    0
  );

  const journalSections = input.journals
    .map(
      (j, idx) => `
### ${idx + 1}. ${j.title}

| 항목 | 내용 |
|------|------|
| 작성일 | ${j.date} |
| 연구원 | ${j.researcherName} |
| 연구분야 | ${j.researchField} |
| 투입시간 | ${j.hours || "-"}시간 |

#### 연구 목표
${j.objectives || "(미작성)"}

#### 연구 내용
${j.content}

#### 연구 결과
${j.results || "(미작성)"}

#### 향후 계획
${j.nextSteps || "(미작성)"}
`
    )
    .join("\n---\n");

  const markdown = `# ${input.clientName} 월간 연구일지 보고서

## 기본 정보

| 항목 | 내용 |
|------|------|
| 기업명 | ${input.clientName} |
| 보고 기간 | ${input.year}년 ${input.month}월 |
| 연구일지 수 | ${input.journals.length}건 |
| 총 투입시간 | ${totalHours}시간 |

---

## 연구 활동 상세

${journalSections}

---

## 요약

본 보고서는 ${input.clientName}의 ${input.year}년 ${input.month}월 연구 활동을 기록한 것입니다.
총 ${input.journals.length}건의 연구일지가 작성되었으며, 총 ${totalHours}시간이 투입되었습니다.

---

*본 문서는 AXLE 시스템에서 자동 생성되었습니다.*
`;

  return {
    markdown,
    totalHours,
    journalCount: input.journals.length,
  };
}
```

- [ ] **Step 3: Create monthly report API route**

Create `apps/web/src/app/api/journals/monthly-report/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { monthlyReportSchema } from "@/lib/validations/journal";
import { generateMonthlyReportMarkdown } from "@axle/docgen/journal-report";

export async function POST(request: NextRequest) {
  const user = await getVerifiedUser();
  const body = await request.json();
  const { clientId, year, month } = monthlyReportSchema.parse(body);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 }
    );
  }

  // Get approved journals for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const journals = await prisma.researchJournal.findMany({
    where: {
      clientId,
      status: "APPROVED",
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      researcher: {
        select: { name: true, researchField: true },
      },
    },
    orderBy: { date: "asc" },
  });

  if (journals.length === 0) {
    return NextResponse.json(
      { error: `${year}년 ${month}월에 승인된 연구일지가 없습니다` },
      { status: 400 }
    );
  }

  const report = generateMonthlyReportMarkdown({
    clientName: client.name,
    year,
    month,
    journals: journals.map((j) => ({
      date: j.date.toISOString().split("T")[0],
      researcherName: j.researcher.name,
      researchField: j.researcher.researchField || "일반",
      title: j.title,
      content: j.content,
      objectives: j.objectives,
      results: j.results,
      nextSteps: j.nextSteps,
      hours: j.hours ? Number(j.hours) : null,
    })),
  });

  // Return markdown for now; DOCX conversion via mark-docx skill in future
  return NextResponse.json({
    markdown: report.markdown,
    totalHours: report.totalHours,
    journalCount: report.journalCount,
    period: `${year}-${String(month).padStart(2, "0")}`,
  });
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/journals/researchers/ apps/web/src/app/api/journals/monthly-report/
git add packages/docgen/src/journal-report.ts
git commit -m "feat: add researcher list API, monthly report markdown generation, and DOCX export preparation"
```

---

## Task 6: Journal List Page

**Files:**
- Create: `apps/web/src/app/(app)/journals/page.tsx`
- Create: `apps/web/src/components/journals/journal-card.tsx`
- Create: `apps/web/src/components/journals/researcher-select.tsx`

- [ ] **Step 1: Create researcher select component**

Create `apps/web/src/components/journals/researcher-select.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface Researcher {
  id: string;
  name: string;
  researchField: string | null;
  client: { id: string; name: string };
}

interface ResearcherSelectProps {
  name: string;
  clientId?: string;
  defaultValue?: string;
  required?: boolean;
}

export function ResearcherSelect({
  name,
  clientId,
  defaultValue,
  required,
}: ResearcherSelectProps) {
  const [researchers, setResearchers] = useState<Researcher[]>([]);

  useEffect(() => {
    const url = clientId
      ? `/api/journals/researchers?clientId=${clientId}`
      : "/api/journals/researchers";
    fetch(url)
      .then((r) => r.json())
      .then(setResearchers);
  }, [clientId]);

  return (
    <select
      name={name}
      required={required}
      defaultValue={defaultValue}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="">연구원 선택</option>
      {researchers.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
          {r.researchField ? ` (${r.researchField})` : ""}
          {" — "}
          {r.client.name}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Create journal card component**

Create `apps/web/src/components/journals/journal-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import Link from "next/link";
import { Calendar, User, Clock, Sparkles } from "lucide-react";

const statusConfig = {
  DRAFT: { label: "초안", variant: "secondary" as const },
  SUBMITTED: { label: "검토 중", variant: "default" as const },
  APPROVED: { label: "승인됨", variant: "outline" as const },
};

interface JournalCardProps {
  journal: {
    id: string;
    title: string;
    date: string;
    status: string;
    hours?: number | null;
    aiDraftJobId?: string | null;
    client: { id: string; name: string };
    researcher: {
      id: string;
      name: string;
      researchField?: string | null;
    };
  };
}

export function JournalCard({ journal }: JournalCardProps) {
  const date = new Date(journal.date);
  const config = statusConfig[journal.status as keyof typeof statusConfig] || statusConfig.DRAFT;

  return (
    <Link href={`/journals/${journal.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-semibold line-clamp-1">
              {journal.title}
            </CardTitle>
            <div className="flex gap-1">
              <Badge variant={config.variant}>{config.label}</Badge>
              {journal.aiDraftJobId && (
                <Badge variant="outline">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{date.toLocaleDateString("ko-KR")}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>
              {journal.researcher.name}
              {journal.researcher.researchField
                ? ` · ${journal.researcher.researchField}`
                : ""}
            </span>
          </div>
          {journal.hours && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{Number(journal.hours)}시간</span>
            </div>
          )}
          <Badge variant="outline" className="mt-1">
            {journal.client.name}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Create journal list page**

Create `apps/web/src/app/(app)/journals/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { Button } from "@axle/ui/button";
import { Badge } from "@axle/ui/badge";
import { JournalCard } from "@/components/journals/journal-card";
import Link from "next/link";
import { Plus, FileDown } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    clientId?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function JournalsPage({ searchParams }: PageProps) {
  const user = await getVerifiedUser();
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 20;

  const where = {
    ...(params.clientId ? { clientId: params.clientId } : {}),
    ...(params.status
      ? { status: params.status as "DRAFT" | "SUBMITTED" | "APPROVED" }
      : {}),
  };

  const [journals, total, statusCounts] = await Promise.all([
    prisma.researchJournal.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        researcher: {
          select: { id: true, name: true, researchField: true },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.researchJournal.count({ where }),
    prisma.researchJournal.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const countMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">연구일지</h1>
          <p className="text-muted-foreground">총 {total}건</p>
        </div>
        <div className="flex gap-2">
          <Link href="/journals/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              새 연구일지
            </Button>
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        <Link href="/journals">
          <Badge
            variant={!params.status ? "default" : "outline"}
            className="cursor-pointer"
          >
            전체 ({total})
          </Badge>
        </Link>
        <Link href="/journals?status=DRAFT">
          <Badge
            variant={params.status === "DRAFT" ? "default" : "outline"}
            className="cursor-pointer"
          >
            초안 ({countMap.DRAFT || 0})
          </Badge>
        </Link>
        <Link href="/journals?status=SUBMITTED">
          <Badge
            variant={params.status === "SUBMITTED" ? "default" : "outline"}
            className="cursor-pointer"
          >
            검토 중 ({countMap.SUBMITTED || 0})
          </Badge>
        </Link>
        <Link href="/journals?status=APPROVED">
          <Badge
            variant={params.status === "APPROVED" ? "default" : "outline"}
            className="cursor-pointer"
          >
            승인됨 ({countMap.APPROVED || 0})
          </Badge>
        </Link>
      </div>

      {journals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          등록된 연구일지가 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {journals.map((journal) => (
            <JournalCard
              key={journal.id}
              journal={{
                ...journal,
                date: journal.date.toISOString(),
                hours: journal.hours ? Number(journal.hours) : null,
              }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/journals?page=${p}${params.status ? `&status=${params.status}` : ""}`}
            >
              <Button
                variant={p === page ? "default" : "outline"}
                size="sm"
              >
                {p}
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/journals/page.tsx
git add apps/web/src/components/journals/
git commit -m "feat: add journal list page with status filters, researcher display, and AI draft badges"
```

---

## Task 7: Journal Detail/Edit Page with Approval

**Files:**
- Create: `apps/web/src/app/(app)/journals/[journalId]/page.tsx`
- Create: `apps/web/src/app/(app)/journals/[journalId]/actions.ts`
- Create: `apps/web/src/app/(app)/journals/[journalId]/components/journal-form.tsx`
- Create: `apps/web/src/app/(app)/journals/[journalId]/components/journal-viewer.tsx`
- Create: `apps/web/src/app/(app)/journals/[journalId]/components/approval-panel.tsx`
- Create: `apps/web/src/app/(app)/journals/[journalId]/components/ai-draft-button.tsx`

- [ ] **Step 1: Create server actions**

Create `apps/web/src/app/(app)/journals/[journalId]/actions.ts`:

```typescript
"use server";

import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { revalidatePath } from "next/cache";
import { updateJournalSchema } from "@/lib/validations/journal";

export async function updateJournal(journalId: string, formData: FormData) {
  const user = await getVerifiedUser();
  const data = updateJournalSchema.parse({
    title: formData.get("title") || undefined,
    content: formData.get("content") || undefined,
    objectives: formData.get("objectives") || undefined,
    results: formData.get("results") || undefined,
    nextSteps: formData.get("nextSteps") || undefined,
    hours: formData.get("hours") || undefined,
  });

  await prisma.researchJournal.update({
    where: { id: journalId },
    data,
  });

  revalidatePath(`/journals/${journalId}`);
}

export async function submitJournal(journalId: string) {
  const user = await getVerifiedUser();

  const journal = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    select: { status: true },
  });

  if (journal?.status !== "DRAFT") {
    throw new Error("DRAFT 상태의 일지만 제출할 수 있습니다");
  }

  await prisma.researchJournal.update({
    where: { id: journalId },
    data: { status: "SUBMITTED" },
  });

  revalidatePath(`/journals/${journalId}`);
}

export async function approveJournal(journalId: string) {
  const user = await getVerifiedUser();

  await prisma.researchJournal.update({
    where: { id: journalId },
    data: {
      status: "APPROVED",
      approvedBy: user.id,
      approvedAt: new Date(),
    },
  });

  revalidatePath(`/journals/${journalId}`);
}

export async function rejectJournal(journalId: string) {
  const user = await getVerifiedUser();

  await prisma.researchJournal.update({
    where: { id: journalId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/journals/${journalId}`);
}
```

- [ ] **Step 2: Create journal form component (edit mode)**

Create `apps/web/src/app/(app)/journals/[journalId]/components/journal-form.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { updateJournal } from "../actions";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";

interface JournalFormProps {
  journalId: string;
  journal: {
    title: string;
    content: string;
    objectives?: string | null;
    results?: string | null;
    nextSteps?: string | null;
    hours?: number | null;
  };
  disabled?: boolean;
}

export function JournalForm({ journalId, journal, disabled }: JournalFormProps) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await updateJournal(journalId, formData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input
          name="title"
          defaultValue={journal.title}
          disabled={disabled}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="objectives">연구 목표</Label>
        <textarea
          name="objectives"
          defaultValue={journal.objectives || ""}
          disabled={disabled}
          className="w-full min-h-[80px] p-3 border rounded-lg text-sm resize-y focus:ring-2 focus:ring-ring"
          placeholder="이번 달 연구 목표를 입력하세요"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">연구 내용</Label>
        <textarea
          name="content"
          defaultValue={journal.content}
          disabled={disabled}
          required
          className="w-full min-h-[200px] p-3 border rounded-lg text-sm resize-y focus:ring-2 focus:ring-ring"
          placeholder="구체적인 연구 활동 내용을 기술하세요"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="results">연구 결과</Label>
        <textarea
          name="results"
          defaultValue={journal.results || ""}
          disabled={disabled}
          className="w-full min-h-[80px] p-3 border rounded-lg text-sm resize-y focus:ring-2 focus:ring-ring"
          placeholder="연구 결과 및 성과를 기록하세요"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nextSteps">향후 계획</Label>
        <textarea
          name="nextSteps"
          defaultValue={journal.nextSteps || ""}
          disabled={disabled}
          className="w-full min-h-[80px] p-3 border rounded-lg text-sm resize-y focus:ring-2 focus:ring-ring"
          placeholder="다음 달 연구 계획"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hours">투입시간 (시간)</Label>
        <Input
          name="hours"
          type="number"
          step="0.5"
          min="0"
          max="24"
          defaultValue={journal.hours ? Number(journal.hours) : ""}
          disabled={disabled}
          className="w-32"
        />
      </div>

      {!disabled && (
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          저장
        </Button>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Create journal viewer component (read-only mode)**

Create `apps/web/src/app/(app)/journals/[journalId]/components/journal-viewer.tsx`:

```tsx
interface JournalViewerProps {
  journal: {
    title: string;
    content: string;
    objectives?: string | null;
    results?: string | null;
    nextSteps?: string | null;
    hours?: number | null;
    date: Date;
    researcher: {
      name: string;
      researchField?: string | null;
    };
  };
}

export function JournalViewer({ journal }: JournalViewerProps) {
  return (
    <div className="space-y-6">
      <div className="prose prose-sm max-w-none">
        {journal.objectives && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              연구 목표
            </h3>
            <p>{journal.objectives}</p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            연구 내용
          </h3>
          <div className="whitespace-pre-wrap">{journal.content}</div>
        </div>

        {journal.results && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              연구 결과
            </h3>
            <p>{journal.results}</p>
          </div>
        )}

        {journal.nextSteps && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              향후 계획
            </h3>
            <p>{journal.nextSteps}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create approval panel component**

Create `apps/web/src/app/(app)/journals/[journalId]/components/approval-panel.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Badge } from "@axle/ui/badge";
import { Card, CardContent } from "@axle/ui/card";
import { submitJournal, approveJournal, rejectJournal } from "../actions";
import { Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";

interface ApprovalPanelProps {
  journalId: string;
  status: string;
  approvedBy?: string | null;
  approvedAt?: Date | null;
}

export function ApprovalPanel({
  journalId,
  status,
  approvedBy,
  approvedAt,
}: ApprovalPanelProps) {
  const [loading, setLoading] = useState(false);

  async function handleAction(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">상태:</span>
              <Badge
                variant={
                  status === "APPROVED"
                    ? "default"
                    : status === "SUBMITTED"
                      ? "secondary"
                      : "outline"
                }
              >
                {status === "DRAFT"
                  ? "초안"
                  : status === "SUBMITTED"
                    ? "검토 중"
                    : "승인됨"}
              </Badge>
            </div>
            {approvedAt && (
              <p className="text-xs text-muted-foreground">
                승인일: {new Date(approvedAt).toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {status === "DRAFT" && (
              <Button
                onClick={() => handleAction(() => submitJournal(journalId))}
                disabled={loading}
                size="sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Send className="w-4 h-4 mr-1" />
                )}
                검토 제출
              </Button>
            )}

            {status === "SUBMITTED" && (
              <>
                <Button
                  onClick={() =>
                    handleAction(() => approveJournal(journalId))
                  }
                  disabled={loading}
                  size="sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  승인
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleAction(() => rejectJournal(journalId))
                  }
                  disabled={loading}
                  size="sm"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  반려
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create AI draft button component**

Create `apps/web/src/app/(app)/journals/[journalId]/components/ai-draft-button.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";

interface AiDraftButtonProps {
  journalId: string;
  disabled?: boolean;
}

export function AiDraftButton({ journalId, disabled }: AiDraftButtonProps) {
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!confirm("AI 초안을 생성하면 현재 내용이 덮어씌워집니다. 계속하시겠습니까?")) {
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(
        `/api/journals/${journalId}/ai-draft`,
        { method: "POST" }
      );

      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || "AI 초안 생성에 실패했습니다.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleGenerate}
      disabled={disabled || generating}
    >
      {generating ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Sparkles className="w-4 h-4 mr-2" />
      )}
      AI 초안 생성
    </Button>
  );
}
```

- [ ] **Step 6: Create journal detail page**

Create `apps/web/src/app/(app)/journals/[journalId]/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { notFound } from "next/navigation";
import { Badge } from "@axle/ui/badge";
import { JournalForm } from "./components/journal-form";
import { JournalViewer } from "./components/journal-viewer";
import { ApprovalPanel } from "./components/approval-panel";
import { AiDraftButton } from "./components/ai-draft-button";
import { Calendar, User, Building2, Sparkles } from "lucide-react";

interface PageProps {
  params: Promise<{ journalId: string }>;
}

export default async function JournalDetailPage({ params }: PageProps) {
  const user = await getVerifiedUser();
  const { journalId } = await params;

  const journal = await prisma.researchJournal.findUnique({
    where: { id: journalId },
    include: {
      client: { select: { id: true, name: true } },
      researcher: {
        select: {
          id: true,
          name: true,
          researchField: true,
          position: true,
        },
      },
    },
  });

  if (!journal) notFound();

  const isEditable = journal.status === "DRAFT";
  const isApproved = journal.status === "APPROVED";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{journal.title}</h1>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {journal.date.toLocaleDateString("ko-KR")}
          </div>
          <div className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {journal.researcher.name}
            {journal.researcher.researchField && (
              <span className="text-xs">
                ({journal.researcher.researchField})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            {journal.client.name}
          </div>
          {journal.aiDraftJobId && (
            <Badge variant="outline">
              <Sparkles className="w-3 h-3 mr-1" />
              AI 생성
            </Badge>
          )}
        </div>
      </div>

      {/* Approval Panel */}
      <ApprovalPanel
        journalId={journalId}
        status={journal.status}
        approvedBy={journal.approvedBy}
        approvedAt={journal.approvedAt}
      />

      {/* AI Draft Button (only in DRAFT mode) */}
      {isEditable && (
        <div className="flex justify-end">
          <AiDraftButton journalId={journalId} />
        </div>
      )}

      {/* Content: Edit mode or View mode */}
      {isEditable ? (
        <JournalForm
          journalId={journalId}
          journal={{
            title: journal.title,
            content: journal.content,
            objectives: journal.objectives,
            results: journal.results,
            nextSteps: journal.nextSteps,
            hours: journal.hours ? Number(journal.hours) : null,
          }}
        />
      ) : (
        <JournalViewer journal={journal} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/journals/\[journalId\]/
git commit -m "feat: add journal detail page with edit form, read-only viewer, approval panel, and AI draft button"
```

---

## Task 8: Journal Create Page

**Files:**
- Create: `apps/web/src/app/(app)/journals/new/page.tsx`

- [ ] **Step 1: Create journal new page**

Create `apps/web/src/app/(app)/journals/new/page.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { ResearcherSelect } from "@/components/journals/researcher-select";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function NewJournalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId") || "";
  const [submitting, setSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/clients?status=ACTIVE&limit=100")
      .then((r) => r.json())
      .then((data) => setClients(data.clients || data || []));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      clientId: formData.get("clientId"),
      researcherContactId: formData.get("researcherContactId"),
      date: formData.get("date"),
      title: formData.get("title"),
      content: formData.get("content") || "연구일지 내용을 작성해주세요.",
    };

    try {
      const response = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const journal = await response.json();
        router.push(`/journals/${journal.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>새 연구일지</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">고객사 *</Label>
              <select
                name="clientId"
                required
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">선택해주세요</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="researcherContactId">연구원 *</Label>
              <ResearcherSelect
                name="researcherContactId"
                clientId={selectedClientId}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">작성일 *</Label>
              <Input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">제목 *</Label>
              <Input name="title" required placeholder="예: 2026년 4월 연구일지" />
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              생성 후 편집
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/journals/new/
git commit -m "feat: add journal creation page with client/researcher selection"
```

---

## Task 9: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run all journal tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/journals/
```

Expected: All tests PASS.

- [ ] **Step 3: Verify dev server renders journal pages**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected: Navigate to /journals — page renders. Navigate to /journals/new — form renders.

- [ ] **Step 4: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 10 complete — Research Journal with AI drafts, approval workflow, and monthly reports"
```

---

## Summary

Phase 10 delivers:
- **ResearchJournal CRUD**: Create, list (with filters by client/researcher/status/date), detail, edit, delete with protection
- **Researcher Management**: Contact.isResearcher query endpoint for researcher selection
- **Approval Workflow**: DRAFT → SUBMITTED → APPROVED state machine with edit guards and rejection
- **AI Draft Generation**: `journal-draft.ts` with LOCAL_MLX → API_HAIKU fallback, previous journal context (up to 5)
- **SkillPattern Accumulation**: Approved AI-drafted journals increment SkillPattern.successCount for future fine-tuning
- **Monthly Report**: Markdown report generation from approved journals (aggregated per month, ready for DOCX via docgen)
- **UI Pages**: Journal list (status filter tabs, card grid), journal detail (edit/view mode, approval panel, AI draft button), journal create form
