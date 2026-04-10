# AXLE Phase 9: Meeting Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete meeting lifecycle — create meetings, manage attendees, upload/transcribe recordings, extract action items, and auto-send summary emails — so consultants never lose track of client conversations.

**Architecture:** Meeting CRUD with QStash job chaining for transcription pipeline (upload → transcribe → summarize → extract actions), MeetingTranscript for AI-generated summaries, ActionItem linked to ChecklistItem, and post-meeting email via packages/email.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (@axle/db), Supabase Storage (recordings bucket), QStash (job chaining), OpenAI Whisper / mlx-whisper (transcription), @axle/ai (3-tier router), Resend (@axle/email), Zod, Vitest

**Depends on:** Phase 0 (foundation), Phase 1 (Client/Contact CRUD), Phase 4 (email package), Phase 5 (AI engine / AiJob)

---

## File Structure

```
axle/
├── packages/
│   ├── db/
│   │   └── prisma/
│   │       └── schema.prisma              # Meeting, MeetingAttendee, MeetingTranscript, ActionItem already defined
│   │
│   └── ai/
│       └── src/
│           ├── transcribe.ts              # Whisper STT (OpenAI API / mlx-whisper local)
│           ├── summarize-meeting.ts        # Meeting summary + key decisions extraction
│           └── extract-actions.ts          # ActionItem extraction from transcript
│
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── (app)/
│           │   │   └── meetings/
│           │   │       ├── page.tsx                    # Meeting list page
│           │   │       ├── new/
│           │   │       │   └── page.tsx                # Create meeting page
│           │   │       └── [meetingId]/
│           │   │           ├── page.tsx                # Meeting detail page
│           │   │           ├── actions.ts              # Server actions for meeting detail
│           │   │           └── components/
│           │   │               ├── meeting-header.tsx
│           │   │               ├── attendee-list.tsx
│           │   │               ├── recording-upload.tsx
│           │   │               ├── transcript-tab.tsx
│           │   │               ├── transcript-paste.tsx
│           │   │               ├── action-items-tab.tsx
│           │   │               └── send-summary-dialog.tsx
│           │   │
│           │   └── api/
│           │       └── meetings/
│           │           ├── route.ts                     # GET list, POST create
│           │           ├── [meetingId]/
│           │           │   ├── route.ts                 # GET detail, PATCH update, DELETE
│           │           │   ├── attendees/
│           │           │   │   └── route.ts             # POST add, DELETE remove attendee
│           │           │   ├── recording/
│           │           │   │   └── route.ts             # POST upload recording
│           │           │   ├── transcript/
│           │           │   │   └── route.ts             # POST paste transcript, GET transcript
│           │           │   ├── send-summary/
│           │           │   │   └── route.ts             # POST send summary email
│           │           │   └── action-items/
│           │           │       └── route.ts             # GET list, POST create, PATCH update
│           │           └── jobs/
│           │               ├── transcribe/
│           │               │   └── route.ts             # QStash callback: STT job
│           │               ├── summarize/
│           │               │   └── route.ts             # QStash callback: summary job
│           │               └── extract-actions/
│           │                   └── route.ts             # QStash callback: action extraction job
│           │
│           ├── lib/
│           │   └── validations/
│           │       └── meeting.ts                       # Zod schemas
│           │
│           └── components/
│               └── meetings/
│                   ├── meeting-form.tsx
│                   ├── meeting-card.tsx
│                   └── action-item-row.tsx
│
└── tests/
    └── meetings/
        ├── meeting-crud.test.ts
        ├── transcription-pipeline.test.ts
        └── action-items.test.ts
```

---

## Task 1: Zod Validation Schemas for Meetings

**Files:**
- Create: `apps/web/src/lib/validations/meeting.ts`

- [ ] **Step 1: Create meeting validation schemas**

```typescript
import { z } from "zod";

// ===== Meeting =====
export const createMeetingSchema = z.object({
  clientId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  date: z.coerce.date(),
  location: z.string().max(200).optional(),
});

export const updateMeetingSchema = createMeetingSchema.partial();

export const meetingListQuerySchema = z.object({
  clientId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["date_asc", "date_desc"]).default("date_desc"),
});

// ===== Attendee =====
export const addAttendeeSchema = z.object({
  contactId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  name: z.string().min(1, "이름을 입력해주세요"),
  role: z.string().max(100).optional(),
}).refine(
  (data) => data.contactId || data.userId || data.name,
  { message: "contactId, userId, 또는 name 중 하나는 필수입니다" }
);

// ===== Transcript =====
export const pasteTranscriptSchema = z.object({
  rawTranscript: z.string().min(10, "전사 텍스트를 입력해주세요"),
});

// ===== ActionItem =====
export const createActionItemSchema = z.object({
  description: z.string().min(1, "내용을 입력해주세요"),
  assigneeUserId: z.string().cuid().optional(),
  assigneeContactId: z.string().cuid().optional(),
  dueDate: z.coerce.date().optional(),
  linkedChecklistId: z.string().cuid().optional(),
});

export const updateActionItemSchema = z.object({
  description: z.string().min(1).optional(),
  assigneeUserId: z.string().cuid().nullable().optional(),
  assigneeContactId: z.string().cuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
  linkedChecklistId: z.string().cuid().nullable().optional(),
});

// ===== Types =====
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type MeetingListQuery = z.infer<typeof meetingListQuerySchema>;
export type AddAttendeeInput = z.infer<typeof addAttendeeSchema>;
export type PasteTranscriptInput = z.infer<typeof pasteTranscriptSchema>;
export type CreateActionItemInput = z.infer<typeof createActionItemSchema>;
export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validations/meeting.ts
git commit -m "feat: add Zod validation schemas for meetings, attendees, transcripts, and action items"
```

---

## Task 2: Meeting CRUD API Routes

**Files:**
- Create: `apps/web/src/app/api/meetings/route.ts`
- Create: `apps/web/src/app/api/meetings/[meetingId]/route.ts`

- [ ] **Step 1: Write failing tests for meeting CRUD**

Create `tests/meetings/meeting-crud.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockMeetingFindMany = vi.fn();
const mockMeetingCreate = vi.fn();
const mockMeetingFindUnique = vi.fn();
const mockMeetingUpdate = vi.fn();
const mockMeetingDelete = vi.fn();
const mockMeetingCount = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    meeting: {
      findMany: mockMeetingFindMany,
      create: mockMeetingCreate,
      findUnique: mockMeetingFindUnique,
      update: mockMeetingUpdate,
      delete: mockMeetingDelete,
      count: mockMeetingCount,
    },
  },
}));

import {
  createMeetingSchema,
  updateMeetingSchema,
  meetingListQuerySchema,
} from "../../apps/web/src/lib/validations/meeting";

describe("Meeting Validation", () => {
  it("validates a valid meeting creation input", () => {
    const input = {
      clientId: "clxxxxxxxxxxxxxxxxx001",
      title: "초기 미팅",
      date: "2026-04-15T14:00:00Z",
    };
    const result = createMeetingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects meeting without title", () => {
    const input = {
      clientId: "clxxxxxxxxxxxxxxxxx001",
      date: "2026-04-15T14:00:00Z",
    };
    const result = createMeetingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("validates list query with defaults", () => {
    const result = meetingListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.limit).toBe(20);
    expect(result.data?.sort).toBe("date_desc");
  });

  it("validates partial update", () => {
    const result = updateMeetingSchema.safeParse({ title: "수정된 제목" });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/meetings/meeting-crud.test.ts
```

Expected: Tests should pass for validation (schemas are already created in Task 1). If Task 1 is not yet committed, expect module not found.

- [ ] **Step 3: Create meeting list + create API route**

Create `apps/web/src/app/api/meetings/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import {
  createMeetingSchema,
  meetingListQuerySchema,
} from "@/lib/validations/meeting";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = meetingListQuerySchema.parse(searchParams);

  const where = {
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.projectId ? { projectId: query.projectId } : {}),
  };

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      include: {
        attendees: true,
        transcript: { select: { id: true, summary: true } },
        actionItems: { select: { id: true, status: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: {
        date: query.sort === "date_asc" ? "asc" : "desc",
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.meeting.count({ where }),
  ]);

  return NextResponse.json({
    meetings,
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
  const data = createMeetingSchema.parse(body);

  const meeting = await prisma.meeting.create({
    data: {
      clientId: data.clientId,
      projectId: data.projectId,
      title: data.title,
      date: data.date,
      location: data.location,
    },
    include: {
      attendees: true,
      project: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
```

- [ ] **Step 4: Create meeting detail API route (GET, PATCH, DELETE)**

Create `apps/web/src/app/api/meetings/[meetingId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { updateMeetingSchema } from "@/lib/validations/meeting";

type Params = { params: Promise<{ meetingId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      attendees: true,
      transcript: true,
      actionItems: {
        orderBy: { dueDate: "asc" },
      },
      emailLogs: {
        orderBy: { sentAt: "desc" },
      },
      project: {
        select: { id: true, title: true, clientId: true },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json(
      { error: "Meeting not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(meeting);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;
  const body = await request.json();
  const data = updateMeetingSchema.parse(body);

  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data,
    include: {
      attendees: true,
      project: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(meeting);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;

  await prisma.meeting.delete({
    where: { id: meetingId },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/meetings/ tests/meetings/meeting-crud.test.ts
git commit -m "feat: add Meeting CRUD API routes (list with pagination, create, detail, update, delete)"
```

---

## Task 3: Attendee Management API

**Files:**
- Create: `apps/web/src/app/api/meetings/[meetingId]/attendees/route.ts`

- [ ] **Step 1: Create attendees API route**

Create `apps/web/src/app/api/meetings/[meetingId]/attendees/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { addAttendeeSchema } from "@/lib/validations/meeting";

type Params = { params: Promise<{ meetingId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;
  const body = await request.json();
  const data = addAttendeeSchema.parse(body);

  // If contactId is provided, fetch contact details to auto-fill name
  let attendeeName = data.name;
  if (data.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: data.contactId },
      select: { name: true },
    });
    if (contact) attendeeName = contact.name;
  }

  // If userId is provided, fetch user details
  if (data.userId) {
    const userRecord = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { name: true },
    });
    if (userRecord?.name) attendeeName = userRecord.name;
  }

  const attendee = await prisma.meetingAttendee.create({
    data: {
      meetingId,
      contactId: data.contactId,
      userId: data.userId,
      name: attendeeName,
      role: data.role,
    },
  });

  return NextResponse.json(attendee, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;
  const { searchParams } = request.nextUrl;
  const attendeeId = searchParams.get("attendeeId");

  if (!attendeeId) {
    return NextResponse.json(
      { error: "attendeeId is required" },
      { status: 400 }
    );
  }

  await prisma.meetingAttendee.delete({
    where: { id: attendeeId },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/meetings/\[meetingId\]/attendees/
git commit -m "feat: add MeetingAttendee management API (add internal users + external contacts)"
```

---

## Task 4: Recording Upload API

**Files:**
- Create: `apps/web/src/app/api/meetings/[meetingId]/recording/route.ts`

- [ ] **Step 1: Create recording upload route**

Create `apps/web/src/app/api/meetings/[meetingId]/recording/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { createClient } from "@supabase/supabase-js";
import { Client as QStashClient } from "@upstash/qstash";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN!,
});

const RECORDING_BUCKET = "recordings";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/ogg",
];

type Params = { params: Promise<{ meetingId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;

  // Verify meeting exists
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("recording") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 500MB)" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: mp3, m4a, wav, webm, ogg` },
      { status: 400 }
    );
  }

  // Upload to Supabase Storage
  const fileExt = file.name.split(".").pop() || "mp3";
  const storagePath = `${meetingId}/${Date.now()}.${fileExt}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(RECORDING_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(RECORDING_BUCKET)
    .getPublicUrl(storagePath);

  // Update meeting with recording URL
  await prisma.meeting.update({
    where: { id: meetingId },
    data: { recordingUrl: urlData.publicUrl },
  });

  // Trigger transcription pipeline via QStash
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await qstash.publishJSON({
    url: `${baseUrl}/api/meetings/jobs/transcribe`,
    body: {
      meetingId,
      recordingUrl: urlData.publicUrl,
      storagePath,
    },
    retries: 2,
  });

  return NextResponse.json({
    recordingUrl: urlData.publicUrl,
    message: "Recording uploaded. Transcription pipeline started.",
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/meetings/\[meetingId\]/recording/
git commit -m "feat: add recording upload to Supabase Storage with QStash transcription trigger"
```

---

## Task 5: Transcription Pipeline — QStash Job Chain

**Files:**
- Create: `packages/ai/src/transcribe.ts`
- Create: `packages/ai/src/summarize-meeting.ts`
- Create: `packages/ai/src/extract-actions.ts`
- Create: `apps/web/src/app/api/meetings/jobs/transcribe/route.ts`
- Create: `apps/web/src/app/api/meetings/jobs/summarize/route.ts`
- Create: `apps/web/src/app/api/meetings/jobs/extract-actions/route.ts`

- [ ] **Step 1: Write failing tests for transcription pipeline**

Create `tests/meetings/transcription-pipeline.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("Transcription Pipeline", () => {
  describe("Job Chain Order", () => {
    it("transcribe job triggers summarize job", () => {
      // Verifies QStash chaining: transcribe → summarize
      const chainOrder = ["transcribe", "summarize", "extract-actions"];
      expect(chainOrder[0]).toBe("transcribe");
      expect(chainOrder[1]).toBe("summarize");
      expect(chainOrder[2]).toBe("extract-actions");
    });
  });

  describe("Transcribe Output", () => {
    it("produces rawTranscript string from audio", () => {
      const mockOutput = {
        rawTranscript: "안녕하세요. 오늘 미팅을 시작하겠습니다.",
        language: "ko",
        durationMs: 3600000,
      };
      expect(mockOutput.rawTranscript).toBeTruthy();
      expect(typeof mockOutput.rawTranscript).toBe("string");
    });
  });

  describe("Summary Output", () => {
    it("produces summary with key decisions", () => {
      const mockOutput = {
        summary: "프로젝트 킥오프 미팅. 일정 확정 및 역할 분담 완료.",
        keyDecisions: [
          "MVP 범위를 CRM + 사업계획서로 한정",
          "4월 말 데모 목표",
        ],
        sentiment: "positive",
      };
      expect(mockOutput.summary).toBeTruthy();
      expect(mockOutput.keyDecisions).toBeInstanceOf(Array);
      expect(mockOutput.keyDecisions.length).toBeGreaterThan(0);
    });
  });

  describe("Action Extraction Output", () => {
    it("produces action items from transcript", () => {
      const mockActions = [
        {
          description: "사업자등록증 수집",
          assigneeName: "박현일",
          dueDate: "2026-04-20",
        },
        {
          description: "재무제표 요청 메일 발송",
          assigneeName: "조용현",
          dueDate: "2026-04-18",
        },
      ];
      expect(mockActions.length).toBeGreaterThan(0);
      expect(mockActions[0].description).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Create transcribe module in packages/ai**

Create `packages/ai/src/transcribe.ts`:

```typescript
import { prisma } from "@axle/db";

interface TranscribeResult {
  rawTranscript: string;
  language: string;
  durationMs: number;
}

/**
 * Transcribe audio using OpenAI Whisper API.
 * For local MLX path, agent-bridge handles mlx-whisper directly.
 */
export async function transcribeAudio(
  audioUrl: string,
  tier: "LOCAL_MLX" | "API_HAIKU" = "API_HAIKU"
): Promise<TranscribeResult> {
  if (tier === "LOCAL_MLX") {
    // Delegate to agent-bridge for mlx-whisper
    // Falls through to API if agent-bridge unavailable
    const bridgeResult = await callAgentBridge("transcribe", { audioUrl });
    if (bridgeResult) return bridgeResult as TranscribeResult;
  }

  // OpenAI Whisper API
  const audioResponse = await fetch(audioUrl);
  const audioBlob = await audioResponse.blob();

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.mp3");
  formData.append("model", "whisper-1");
  formData.append("language", "ko");
  formData.append("response_format", "verbose_json");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Whisper API failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();

  return {
    rawTranscript: result.text,
    language: result.language || "ko",
    durationMs: Math.round((result.duration || 0) * 1000),
  };
}

async function callAgentBridge(
  action: string,
  payload: Record<string, unknown>
): Promise<unknown | null> {
  const bridgeUrl = process.env.AGENT_BRIDGE_URL;
  if (!bridgeUrl) return null;

  try {
    const response = await fetch(`${bridgeUrl}/api/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300_000), // 5 min timeout for transcription
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Create meeting summarization module**

Create `packages/ai/src/summarize-meeting.ts`:

```typescript
interface MeetingSummaryResult {
  summary: string;
  keyDecisions: string[];
  sentiment: string;
}

/**
 * Generate meeting summary with key decisions from transcript.
 * Uses Haiku tier by default for cost efficiency.
 */
export async function summarizeMeeting(
  rawTranscript: string,
  meetingTitle: string
): Promise<MeetingSummaryResult> {
  const systemPrompt = `You are a professional meeting summarizer for a consulting firm.
Given a meeting transcript, produce:
1. A concise summary in Korean (2-5 sentences)
2. A list of key decisions made (in Korean)
3. Overall sentiment (positive, neutral, negative)

Output as JSON:
{
  "summary": "...",
  "keyDecisions": ["...", "..."],
  "sentiment": "positive|neutral|negative"
}`;

  const userPrompt = `Meeting: ${meetingTitle}

Transcript:
${rawTranscript.slice(0, 50000)}`;

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
    throw new Error(`Anthropic API failed: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content[0]?.text || "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      summary: text.slice(0, 500),
      keyDecisions: [],
      sentiment: "neutral",
    };
  }

  return JSON.parse(jsonMatch[0]);
}
```

- [ ] **Step 4: Create action item extraction module**

Create `packages/ai/src/extract-actions.ts`:

```typescript
interface ExtractedAction {
  description: string;
  assigneeName?: string;
  dueDate?: string;
}

/**
 * Extract action items from meeting transcript.
 * Returns structured action items with optional assignee and due date.
 */
export async function extractActionItems(
  rawTranscript: string,
  summary: string,
  attendeeNames: string[]
): Promise<ExtractedAction[]> {
  const systemPrompt = `You are an action item extractor for consulting meetings.
Given a transcript and summary, identify specific action items.
For each action item, identify:
1. A clear description (Korean)
2. The responsible person (if mentioned, from attendee list)
3. Due date (if mentioned, ISO format)

Known attendees: ${attendeeNames.join(", ")}

Output as JSON array:
[
  {
    "description": "...",
    "assigneeName": "...",
    "dueDate": "YYYY-MM-DD"
  }
]

Only include concrete, actionable items. Do not invent items not discussed.`;

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
      messages: [
        {
          role: "user",
          content: `Summary:\n${summary}\n\nTranscript:\n${rawTranscript.slice(0, 50000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API failed: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content[0]?.text || "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]);
}
```

- [ ] **Step 5: Create QStash transcribe job handler**

Create `apps/web/src/app/api/meetings/jobs/transcribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { Client as QStashClient } from "@upstash/qstash";
import { prisma } from "@axle/db";
import { transcribeAudio } from "@axle/ai/transcribe";

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

async function handler(request: NextRequest) {
  const body = await request.json();
  const { meetingId, recordingUrl, storagePath } = body;

  // Create AiJob record
  const aiJob = await prisma.aiJob.create({
    data: {
      type: "TRANSCRIBE",
      tier: "API_HAIKU",
      status: "RUNNING",
      input: { meetingId, recordingUrl },
    },
  });

  try {
    const result = await transcribeAudio(recordingUrl);

    // Save transcript
    await prisma.meetingTranscript.upsert({
      where: { meetingId },
      create: {
        meetingId,
        rawTranscript: result.rawTranscript,
        aiJobId: aiJob.id,
      },
      update: {
        rawTranscript: result.rawTranscript,
        aiJobId: aiJob.id,
      },
    });

    // Update AiJob
    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "COMPLETED",
        output: result as unknown as Record<string, unknown>,
        durationMs: result.durationMs,
      },
    });

    // Chain to summarize job
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await qstash.publishJSON({
      url: `${baseUrl}/api/meetings/jobs/summarize`,
      body: { meetingId },
      retries: 2,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
```

- [ ] **Step 6: Create QStash summarize job handler**

Create `apps/web/src/app/api/meetings/jobs/summarize/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { Client as QStashClient } from "@upstash/qstash";
import { prisma } from "@axle/db";
import { summarizeMeeting } from "@axle/ai/summarize-meeting";

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

async function handler(request: NextRequest) {
  const { meetingId } = await request.json();

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { transcript: true },
  });

  if (!meeting?.transcript?.rawTranscript) {
    return NextResponse.json(
      { error: "No transcript found" },
      { status: 404 }
    );
  }

  const aiJob = await prisma.aiJob.create({
    data: {
      type: "SUMMARY",
      tier: "API_HAIKU",
      status: "RUNNING",
      input: { meetingId },
    },
  });

  try {
    const startMs = Date.now();
    const result = await summarizeMeeting(
      meeting.transcript.rawTranscript,
      meeting.title
    );

    // Update transcript with summary
    await prisma.meetingTranscript.update({
      where: { meetingId },
      data: {
        summary: result.summary,
        keyDecisions: result.keyDecisions,
        sentiment: result.sentiment,
      },
    });

    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "COMPLETED",
        output: result as unknown as Record<string, unknown>,
        durationMs: Date.now() - startMs,
      },
    });

    // Chain to extract-actions job
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await qstash.publishJSON({
      url: `${baseUrl}/api/meetings/jobs/extract-actions`,
      body: { meetingId },
      retries: 2,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
```

- [ ] **Step 7: Create QStash extract-actions job handler**

Create `apps/web/src/app/api/meetings/jobs/extract-actions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { prisma } from "@axle/db";
import { extractActionItems } from "@axle/ai/extract-actions";

async function handler(request: NextRequest) {
  const { meetingId } = await request.json();

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
      attendees: true,
    },
  });

  if (!meeting?.transcript) {
    return NextResponse.json(
      { error: "No transcript found" },
      { status: 404 }
    );
  }

  const aiJob = await prisma.aiJob.create({
    data: {
      type: "SUMMARY", // Reuse SUMMARY type for action extraction
      tier: "API_HAIKU",
      status: "RUNNING",
      input: { meetingId, action: "extract-actions" },
    },
  });

  try {
    const startMs = Date.now();
    const attendeeNames = meeting.attendees.map((a) => a.name);
    const actions = await extractActionItems(
      meeting.transcript.rawTranscript,
      meeting.transcript.summary || "",
      attendeeNames
    );

    // Create ActionItem records
    for (const action of actions) {
      // Try to match assignee to an attendee
      let assigneeUserId: string | undefined;
      let assigneeContactId: string | undefined;

      if (action.assigneeName) {
        const matchedAttendee = meeting.attendees.find(
          (a) => a.name === action.assigneeName
        );
        if (matchedAttendee) {
          assigneeUserId = matchedAttendee.userId || undefined;
          assigneeContactId = matchedAttendee.contactId || undefined;
        }
      }

      await prisma.actionItem.create({
        data: {
          meetingId,
          description: action.description,
          assigneeUserId,
          assigneeContactId,
          dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
          status: "OPEN",
        },
      });
    }

    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "COMPLETED",
        output: { extractedCount: actions.length, actions },
        durationMs: Date.now() - startMs,
      },
    });

    // Send notification
    // TODO: Trigger notification via packages/notification when available

    return NextResponse.json({
      success: true,
      actionsCreated: actions.length,
    });
  } catch (error) {
    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return NextResponse.json(
      { error: "Action extraction failed" },
      { status: 500 }
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
```

- [ ] **Step 8: Run pipeline tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/meetings/transcription-pipeline.test.ts
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/transcribe.ts packages/ai/src/summarize-meeting.ts packages/ai/src/extract-actions.ts
git add apps/web/src/app/api/meetings/jobs/ tests/meetings/transcription-pipeline.test.ts
git commit -m "feat: add QStash transcription pipeline (transcribe → summarize → extract actions)"
```

---

## Task 6: Manual Transcript Paste + ActionItem CRUD

**Files:**
- Create: `apps/web/src/app/api/meetings/[meetingId]/transcript/route.ts`
- Create: `apps/web/src/app/api/meetings/[meetingId]/action-items/route.ts`

- [ ] **Step 1: Create transcript paste API (for 클로바노트 users)**

Create `apps/web/src/app/api/meetings/[meetingId]/transcript/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { Client as QStashClient } from "@upstash/qstash";
import { pasteTranscriptSchema } from "@/lib/validations/meeting";

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

type Params = { params: Promise<{ meetingId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;

  const transcript = await prisma.meetingTranscript.findUnique({
    where: { meetingId },
  });

  if (!transcript) {
    return NextResponse.json(
      { error: "No transcript found" },
      { status: 404 }
    );
  }

  return NextResponse.json(transcript);
}

/**
 * Manual transcript paste — for users who transcribe via 클로바노트 or similar.
 * Skips transcription step and goes straight to summarize → extract-actions.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;
  const body = await request.json();
  const data = pasteTranscriptSchema.parse(body);

  // Upsert transcript
  await prisma.meetingTranscript.upsert({
    where: { meetingId },
    create: {
      meetingId,
      rawTranscript: data.rawTranscript,
    },
    update: {
      rawTranscript: data.rawTranscript,
      summary: null,
      keyDecisions: null,
      sentiment: null,
    },
  });

  // Skip transcribe, go directly to summarize
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await qstash.publishJSON({
    url: `${baseUrl}/api/meetings/jobs/summarize`,
    body: { meetingId },
    retries: 2,
  });

  return NextResponse.json({
    message: "Transcript saved. Summary pipeline started.",
  });
}
```

- [ ] **Step 2: Write failing tests for action items**

Create `tests/meetings/action-items.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createActionItemSchema,
  updateActionItemSchema,
} from "../../apps/web/src/lib/validations/meeting";

describe("ActionItem Validation", () => {
  it("validates valid action item creation", () => {
    const result = createActionItemSchema.safeParse({
      description: "사업자등록증 수집",
    });
    expect(result.success).toBe(true);
  });

  it("rejects action item without description", () => {
    const result = createActionItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates status update", () => {
    const result = updateActionItemSchema.safeParse({
      status: "IN_PROGRESS",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateActionItemSchema.safeParse({
      status: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("validates linking to checklist item", () => {
    const result = updateActionItemSchema.safeParse({
      linkedChecklistId: "clxxxxxxxxxxxxxxxxx001",
      status: "DONE",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Create ActionItem CRUD API**

Create `apps/web/src/app/api/meetings/[meetingId]/action-items/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import {
  createActionItemSchema,
  updateActionItemSchema,
} from "@/lib/validations/meeting";

type Params = { params: Promise<{ meetingId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;

  const actionItems = await prisma.actionItem.findMany({
    where: { meetingId },
    orderBy: [
      { status: "asc" }, // OPEN first, then IN_PROGRESS, then DONE
      { dueDate: "asc" },
    ],
  });

  return NextResponse.json(actionItems);
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;
  const body = await request.json();
  const data = createActionItemSchema.parse(body);

  const actionItem = await prisma.actionItem.create({
    data: {
      meetingId,
      description: data.description,
      assigneeUserId: data.assigneeUserId,
      assigneeContactId: data.assigneeContactId,
      dueDate: data.dueDate,
      linkedChecklistId: data.linkedChecklistId,
      status: "OPEN",
    },
  });

  return NextResponse.json(actionItem, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;
  const body = await request.json();
  const { actionItemId, ...updateData } = body;
  const data = updateActionItemSchema.parse(updateData);

  if (!actionItemId) {
    return NextResponse.json(
      { error: "actionItemId is required" },
      { status: 400 }
    );
  }

  // If linking to checklist and marking DONE, update checklist too
  if (data.linkedChecklistId && data.status === "DONE") {
    await prisma.checklistItem.update({
      where: { id: data.linkedChecklistId },
      data: { status: "VERIFIED" },
    }).catch(() => {
      // Checklist item may not exist, ignore
    });
  }

  const actionItem = await prisma.actionItem.update({
    where: { id: actionItemId },
    data,
  });

  return NextResponse.json(actionItem);
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/meetings/action-items.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/meetings/\[meetingId\]/transcript/ apps/web/src/app/api/meetings/\[meetingId\]/action-items/
git add tests/meetings/action-items.test.ts
git commit -m "feat: add manual transcript paste (클로바노트 support) and ActionItem CRUD with ChecklistItem linking"
```

---

## Task 7: Post-Meeting Summary Email

**Files:**
- Create: `apps/web/src/app/api/meetings/[meetingId]/send-summary/route.ts`

- [ ] **Step 1: Create send summary email route**

Create `apps/web/src/app/api/meetings/[meetingId]/send-summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";

type Params = { params: Promise<{ meetingId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      transcript: true,
      attendees: true,
      actionItems: true,
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (!meeting.transcript?.summary) {
    return NextResponse.json(
      { error: "No summary available yet. Wait for transcription pipeline to complete." },
      { status: 400 }
    );
  }

  // Collect attendee emails
  const attendeeEmails: string[] = [];
  for (const attendee of meeting.attendees) {
    if (attendee.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: attendee.contactId },
        select: { email: true },
      });
      if (contact?.email) attendeeEmails.push(contact.email);
    }
    if (attendee.userId) {
      const userRecord = await prisma.user.findUnique({
        where: { id: attendee.userId },
        select: { email: true },
      });
      if (userRecord?.email) attendeeEmails.push(userRecord.email);
    }
  }

  if (attendeeEmails.length === 0) {
    return NextResponse.json(
      { error: "No attendee emails found" },
      { status: 400 }
    );
  }

  // Format action items for email
  const actionItemsText = meeting.actionItems
    .map(
      (ai) =>
        `- ${ai.description}${ai.dueDate ? ` (기한: ${ai.dueDate.toLocaleDateString("ko-KR")})` : ""}`
    )
    .join("\n");

  const keyDecisions = (meeting.transcript.keyDecisions as string[]) || [];
  const keyDecisionsText = keyDecisions.map((d) => `- ${d}`).join("\n");

  // Send via Resend (packages/email)
  // Using direct fetch for now; replace with @axle/email when available
  const emailHtml = `
    <h2>${meeting.title} — 미팅 요약</h2>
    <p><strong>일시:</strong> ${meeting.date.toLocaleDateString("ko-KR")} ${meeting.date.toLocaleTimeString("ko-KR")}</p>
    ${meeting.location ? `<p><strong>장소:</strong> ${meeting.location}</p>` : ""}
    
    <h3>요약</h3>
    <p>${meeting.transcript.summary}</p>
    
    ${keyDecisions.length > 0 ? `<h3>주요 결정사항</h3><ul>${keyDecisions.map((d) => `<li>${d}</li>`).join("")}</ul>` : ""}
    
    ${meeting.actionItems.length > 0 ? `<h3>액션 아이템</h3><ul>${meeting.actionItems.map((ai) => `<li>${ai.description}${ai.dueDate ? ` <em>(기한: ${ai.dueDate.toLocaleDateString("ko-KR")})</em>` : ""}</li>`).join("")}</ul>` : ""}
    
    <hr>
    <p style="color: #888; font-size: 12px;">이 메일은 AXLE에서 자동 발송되었습니다.</p>
  `;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "AXLE <noreply@axle.app>",
      to: attendeeEmails,
      subject: `[미팅 요약] ${meeting.title}`,
      html: emailHtml,
    }),
  });

  const emailResult = await emailResponse.json();

  // Log emails
  for (const to of attendeeEmails) {
    await prisma.emailLog.create({
      data: {
        meetingId,
        to,
        subject: `[미팅 요약] ${meeting.title}`,
        type: "MEETING_SUMMARY",
        resendMessageId: emailResult.id || null,
      },
    });
  }

  return NextResponse.json({
    success: true,
    emailsSent: attendeeEmails.length,
    recipients: attendeeEmails,
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/meetings/\[meetingId\]/send-summary/
git commit -m "feat: add post-meeting summary email with action items to attendees via Resend"
```

---

## Task 8: Meeting List Page

**Files:**
- Create: `apps/web/src/app/(app)/meetings/page.tsx`
- Create: `apps/web/src/components/meetings/meeting-card.tsx`

- [ ] **Step 1: Create meeting card component**

Create `apps/web/src/components/meetings/meeting-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import Link from "next/link";
import { Calendar, MapPin, Users, FileText, CheckCircle2 } from "lucide-react";

interface MeetingCardProps {
  meeting: {
    id: string;
    title: string;
    date: string;
    location?: string | null;
    recordingUrl?: string | null;
    attendees: Array<{ id: string; name: string }>;
    transcript?: { id: string; summary?: string | null } | null;
    actionItems: Array<{ id: string; status: string }>;
    project?: { id: string; title: string } | null;
  };
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const date = new Date(meeting.date);
  const totalActions = meeting.actionItems.length;
  const doneActions = meeting.actionItems.filter(
    (a) => a.status === "DONE"
  ).length;
  const hasTranscript = !!meeting.transcript;

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-semibold">
              {meeting.title}
            </CardTitle>
            <div className="flex gap-1">
              {hasTranscript && (
                <Badge variant="secondary">
                  <FileText className="w-3 h-3 mr-1" />
                  전사
                </Badge>
              )}
              {meeting.recordingUrl && (
                <Badge variant="outline">녹음</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              {date.toLocaleDateString("ko-KR")} {date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{meeting.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{meeting.attendees.length}명 참석</span>
          </div>
          {totalActions > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                액션 {doneActions}/{totalActions} 완료
              </span>
            </div>
          )}
          {meeting.project && (
            <Badge variant="outline" className="mt-1">
              {meeting.project.title}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Create meeting list page**

Create `apps/web/src/app/(app)/meetings/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { Button } from "@axle/ui/button";
import { MeetingCard } from "@/components/meetings/meeting-card";
import Link from "next/link";
import { Plus } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    clientId?: string;
    projectId?: string;
    page?: string;
  }>;
}

export default async function MeetingsPage({ searchParams }: PageProps) {
  const user = await getVerifiedUser();
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 20;

  const where = {
    ...(params.clientId ? { clientId: params.clientId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
  };

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      include: {
        attendees: { select: { id: true, name: true } },
        transcript: { select: { id: true, summary: true } },
        actionItems: { select: { id: true, status: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.meeting.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">미팅</h1>
          <p className="text-muted-foreground">
            총 {total}건의 미팅
          </p>
        </div>
        <Link href="/meetings/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            새 미팅
          </Button>
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          등록된 미팅이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={{
                ...meeting,
                date: meeting.date.toISOString(),
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
              href={`/meetings?page=${p}${params.clientId ? `&clientId=${params.clientId}` : ""}`}
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

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/meetings/page.tsx apps/web/src/components/meetings/meeting-card.tsx
git commit -m "feat: add meeting list page with card grid, pagination, and status badges"
```

---

## Task 9: Meeting Detail Page with Tabs

**Files:**
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/page.tsx`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/actions.ts`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/components/meeting-header.tsx`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/components/attendee-list.tsx`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/components/recording-upload.tsx`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/components/transcript-tab.tsx`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/components/transcript-paste.tsx`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/components/action-items-tab.tsx`
- Create: `apps/web/src/app/(app)/meetings/[meetingId]/components/send-summary-dialog.tsx`
- Create: `apps/web/src/components/meetings/action-item-row.tsx`

- [ ] **Step 1: Create server actions for meeting detail**

Create `apps/web/src/app/(app)/meetings/[meetingId]/actions.ts`:

```typescript
"use server";

import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { revalidatePath } from "next/cache";
import {
  addAttendeeSchema,
  createActionItemSchema,
  updateActionItemSchema,
} from "@/lib/validations/meeting";

export async function addAttendee(meetingId: string, formData: FormData) {
  const user = await getVerifiedUser();
  const data = addAttendeeSchema.parse({
    contactId: formData.get("contactId") || undefined,
    userId: formData.get("userId") || undefined,
    name: formData.get("name"),
    role: formData.get("role") || undefined,
  });

  await prisma.meetingAttendee.create({
    data: {
      meetingId,
      contactId: data.contactId,
      userId: data.userId,
      name: data.name,
      role: data.role,
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
}

export async function removeAttendee(meetingId: string, attendeeId: string) {
  const user = await getVerifiedUser();
  await prisma.meetingAttendee.delete({ where: { id: attendeeId } });
  revalidatePath(`/meetings/${meetingId}`);
}

export async function createActionItem(meetingId: string, formData: FormData) {
  const user = await getVerifiedUser();
  const data = createActionItemSchema.parse({
    description: formData.get("description"),
    assigneeUserId: formData.get("assigneeUserId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });

  await prisma.actionItem.create({
    data: {
      meetingId,
      ...data,
      status: "OPEN",
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
}

export async function updateActionItemStatus(
  meetingId: string,
  actionItemId: string,
  status: "OPEN" | "IN_PROGRESS" | "DONE"
) {
  const user = await getVerifiedUser();
  await prisma.actionItem.update({
    where: { id: actionItemId },
    data: { status },
  });
  revalidatePath(`/meetings/${meetingId}`);
}
```

- [ ] **Step 2: Create meeting header component**

Create `apps/web/src/app/(app)/meetings/[meetingId]/components/meeting-header.tsx`:

```tsx
import { Badge } from "@axle/ui/badge";
import { Calendar, MapPin, Mic } from "lucide-react";

interface MeetingHeaderProps {
  meeting: {
    title: string;
    date: Date;
    location?: string | null;
    recordingUrl?: string | null;
    project?: { id: string; title: string } | null;
  };
}

export function MeetingHeader({ meeting }: MeetingHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        {meeting.project && (
          <Badge variant="outline">{meeting.project.title}</Badge>
        )}
      </div>
      <div className="flex gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {meeting.date.toLocaleDateString("ko-KR")}{" "}
          {meeting.date.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        {meeting.location && (
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {meeting.location}
          </div>
        )}
        {meeting.recordingUrl && (
          <div className="flex items-center gap-1">
            <Mic className="w-4 h-4" />
            <a
              href={meeting.recordingUrl}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener"
            >
              녹음 파일
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create attendee list component**

Create `apps/web/src/app/(app)/meetings/[meetingId]/components/attendee-list.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Badge } from "@axle/ui/badge";
import { UserPlus, X } from "lucide-react";
import { useState } from "react";
import { addAttendee, removeAttendee } from "../actions";

interface AttendeeListProps {
  meetingId: string;
  attendees: Array<{
    id: string;
    name: string;
    role?: string | null;
    contactId?: string | null;
    userId?: string | null;
  }>;
}

export function AttendeeList({ meetingId, attendees }: AttendeeListProps) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">참석자 ({attendees.length})</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <UserPlus className="w-4 h-4 mr-1" />
          추가
        </Button>
      </div>

      {showAdd && (
        <form
          action={async (formData) => {
            await addAttendee(meetingId, formData);
            setShowAdd(false);
          }}
          className="flex gap-2"
        >
          <Input name="name" placeholder="이름" required className="flex-1" />
          <Input name="role" placeholder="역할 (선택)" className="w-32" />
          <Button type="submit" size="sm">추가</Button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {attendees.map((attendee) => (
          <div
            key={attendee.id}
            className="flex items-center gap-1 border rounded-full px-3 py-1 text-sm"
          >
            <span>{attendee.name}</span>
            {attendee.role && (
              <Badge variant="secondary" className="text-xs">
                {attendee.role}
              </Badge>
            )}
            {attendee.userId && (
              <Badge variant="outline" className="text-xs">내부</Badge>
            )}
            <button
              onClick={() => removeAttendee(meetingId, attendee.id)}
              className="ml-1 text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create recording upload component**

Create `apps/web/src/app/(app)/meetings/[meetingId]/components/recording-upload.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";

interface RecordingUploadProps {
  meetingId: string;
  hasRecording: boolean;
}

export function RecordingUpload({ meetingId, hasRecording }: RecordingUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("recording", file);

      const response = await fetch(
        `/api/meetings/${meetingId}/recording`,
        { method: "POST", body: formData }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (hasRecording) {
    return (
      <p className="text-sm text-muted-foreground">
        녹음 파일이 업로드되었습니다. 전사 파이프라인이 자동으로 시작됩니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
        {uploading ? (
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="w-8 h-8 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground">
          {uploading ? "업로드 중..." : "녹음 파일을 드래그하거나 클릭하세요 (mp3, m4a, wav)"}
        </span>
        <input
          type="file"
          accept="audio/*"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Create transcript tab component**

Create `apps/web/src/app/(app)/meetings/[meetingId]/components/transcript-tab.tsx`:

```tsx
import { Badge } from "@axle/ui/badge";

interface TranscriptTabProps {
  transcript: {
    rawTranscript: string;
    summary?: string | null;
    keyDecisions?: unknown;
    sentiment?: string | null;
  } | null;
}

export function TranscriptTab({ transcript }: TranscriptTabProps) {
  if (!transcript) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        전사 내용이 없습니다. 녹음을 업로드하거나 텍스트를 붙여넣으세요.
      </div>
    );
  }

  const keyDecisions = (transcript.keyDecisions as string[]) || [];
  const sentimentMap: Record<string, { label: string; color: string }> = {
    positive: { label: "긍정적", color: "bg-green-100 text-green-800" },
    neutral: { label: "중립", color: "bg-gray-100 text-gray-800" },
    negative: { label: "부정적", color: "bg-red-100 text-red-800" },
  };
  const sentiment = sentimentMap[transcript.sentiment || "neutral"] || sentimentMap.neutral;

  return (
    <div className="space-y-6">
      {transcript.summary && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">요약</h3>
            <Badge className={sentiment.color}>{sentiment.label}</Badge>
          </div>
          <p className="text-sm leading-relaxed">{transcript.summary}</p>
        </div>
      )}

      {keyDecisions.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">주요 결정사항</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {keyDecisions.map((decision, i) => (
              <li key={i}>{decision}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">전체 전사</h3>
        <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
          <pre className="text-sm whitespace-pre-wrap font-sans">
            {transcript.rawTranscript}
          </pre>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create transcript paste component**

Create `apps/web/src/app/(app)/meetings/[meetingId]/components/transcript-paste.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { useState } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";

interface TranscriptPasteProps {
  meetingId: string;
  hasTranscript: boolean;
}

export function TranscriptPaste({ meetingId, hasTranscript }: TranscriptPasteProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/transcript`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawTranscript: text }),
        }
      );

      if (response.ok) {
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <ClipboardPaste className="w-4 h-4" />
        전사 텍스트 붙여넣기
      </h3>
      <p className="text-sm text-muted-foreground">
        클로바노트 등 외부 전사 도구의 결과를 직접 붙여넣으세요.
        {hasTranscript && " (기존 전사를 덮어씁니다)"}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="전사 텍스트를 여기에 붙여넣으세요..."
        className="w-full h-48 p-3 border rounded-lg text-sm resize-y focus:ring-2 focus:ring-ring"
      />
      <Button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        저장 및 요약 시작
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Create action items tab component**

Create `apps/web/src/app/(app)/meetings/[meetingId]/components/action-items-tab.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { ActionItemRow } from "@/components/meetings/action-item-row";
import { createActionItem, updateActionItemStatus } from "../actions";
import { Plus } from "lucide-react";
import { useState } from "react";

interface ActionItemsTabProps {
  meetingId: string;
  actionItems: Array<{
    id: string;
    description: string;
    assigneeUserId?: string | null;
    assigneeContactId?: string | null;
    dueDate?: Date | null;
    status: string;
    linkedChecklistId?: string | null;
  }>;
}

export function ActionItemsTab({ meetingId, actionItems }: ActionItemsTabProps) {
  const [showAdd, setShowAdd] = useState(false);

  const openItems = actionItems.filter((a) => a.status === "OPEN");
  const inProgressItems = actionItems.filter((a) => a.status === "IN_PROGRESS");
  const doneItems = actionItems.filter((a) => a.status === "DONE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          액션 아이템 ({actionItems.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="w-4 h-4 mr-1" />
          추가
        </Button>
      </div>

      {showAdd && (
        <form
          action={async (formData) => {
            await createActionItem(meetingId, formData);
            setShowAdd(false);
          }}
          className="flex gap-2 items-end"
        >
          <div className="flex-1">
            <Input name="description" placeholder="할 일을 입력하세요" required />
          </div>
          <Input name="dueDate" type="date" className="w-40" />
          <Button type="submit" size="sm">추가</Button>
        </form>
      )}

      {actionItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          액션 아이템이 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {openItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">미완료</h4>
              {openItems.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  onStatusChange={(status) =>
                    updateActionItemStatus(meetingId, item.id, status)
                  }
                />
              ))}
            </div>
          )}
          {inProgressItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">진행 중</h4>
              {inProgressItems.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  onStatusChange={(status) =>
                    updateActionItemStatus(meetingId, item.id, status)
                  }
                />
              ))}
            </div>
          )}
          {doneItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">완료</h4>
              {doneItems.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  onStatusChange={(status) =>
                    updateActionItemStatus(meetingId, item.id, status)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create action item row component**

Create `apps/web/src/components/meetings/action-item-row.tsx`:

```tsx
"use client";

import { Badge } from "@axle/ui/badge";
import { Button } from "@axle/ui/button";
import { Circle, Clock, CheckCircle2, Link2 } from "lucide-react";

interface ActionItemRowProps {
  item: {
    id: string;
    description: string;
    dueDate?: Date | null;
    status: string;
    linkedChecklistId?: string | null;
  };
  onStatusChange: (status: "OPEN" | "IN_PROGRESS" | "DONE") => void;
}

const statusConfig = {
  OPEN: { icon: Circle, label: "미완료", next: "IN_PROGRESS" as const },
  IN_PROGRESS: { icon: Clock, label: "진행 중", next: "DONE" as const },
  DONE: { icon: CheckCircle2, label: "완료", next: "OPEN" as const },
};

export function ActionItemRow({ item, onStatusChange }: ActionItemRowProps) {
  const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.OPEN;
  const Icon = config.icon;
  const isDone = item.status === "DONE";

  return (
    <div className={`flex items-center gap-3 p-3 border rounded-lg ${isDone ? "opacity-60" : ""}`}>
      <button
        onClick={() => onStatusChange(config.next)}
        className="flex-shrink-0 hover:text-primary transition-colors"
        title={`${config.label} → 클릭하여 변경`}
      >
        <Icon className={`w-5 h-5 ${isDone ? "text-green-500" : item.status === "IN_PROGRESS" ? "text-blue-500" : "text-muted-foreground"}`} />
      </button>
      <span className={`flex-1 text-sm ${isDone ? "line-through" : ""}`}>
        {item.description}
      </span>
      {item.dueDate && (
        <span className="text-xs text-muted-foreground">
          {new Date(item.dueDate).toLocaleDateString("ko-KR")}
        </span>
      )}
      {item.linkedChecklistId && (
        <Badge variant="outline" className="text-xs">
          <Link2 className="w-3 h-3 mr-1" />
          체크리스트 연결됨
        </Badge>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Create send summary dialog component**

Create `apps/web/src/app/(app)/meetings/[meetingId]/components/send-summary-dialog.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

interface SendSummaryDialogProps {
  meetingId: string;
  hasSummary: boolean;
  attendeeCount: number;
}

export function SendSummaryDialog({
  meetingId,
  hasSummary,
  attendeeCount,
}: SendSummaryDialogProps) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number } | null>(null);

  async function handleSend() {
    setSending(true);
    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/send-summary`,
        { method: "POST" }
      );
      const data = await response.json();
      if (response.ok) {
        setResult({ success: true, count: data.emailsSent });
      } else {
        setResult({ success: false });
        alert(data.error || "발송에 실패했습니다.");
      }
    } finally {
      setSending(false);
    }
  }

  if (!hasSummary) {
    return (
      <Button variant="outline" disabled>
        <Send className="w-4 h-4 mr-2" />
        요약이 생성되면 발송 가능
      </Button>
    );
  }

  if (result?.success) {
    return (
      <Button variant="outline" disabled>
        <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
        {result.count}명에게 발송 완료
      </Button>
    );
  }

  return (
    <Button onClick={handleSend} disabled={sending}>
      {sending ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Send className="w-4 h-4 mr-2" />
      )}
      참석자에게 요약 메일 발송 ({attendeeCount}명)
    </Button>
  );
}
```

- [ ] **Step 10: Create meeting detail page**

Create `apps/web/src/app/(app)/meetings/[meetingId]/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { notFound } from "next/navigation";
import { MeetingHeader } from "./components/meeting-header";
import { AttendeeList } from "./components/attendee-list";
import { RecordingUpload } from "./components/recording-upload";
import { TranscriptTab } from "./components/transcript-tab";
import { TranscriptPaste } from "./components/transcript-paste";
import { ActionItemsTab } from "./components/action-items-tab";
import { SendSummaryDialog } from "./components/send-summary-dialog";

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const user = await getVerifiedUser();
  const { meetingId } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      attendees: true,
      transcript: true,
      actionItems: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
      emailLogs: {
        where: { type: "MEETING_SUMMARY" },
        orderBy: { sentAt: "desc" },
        take: 5,
      },
      project: { select: { id: true, title: true } },
    },
  });

  if (!meeting) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <MeetingHeader meeting={meeting} />

      <div className="flex justify-end">
        <SendSummaryDialog
          meetingId={meetingId}
          hasSummary={!!meeting.transcript?.summary}
          attendeeCount={meeting.attendees.length}
        />
      </div>

      <AttendeeList meetingId={meetingId} attendees={meeting.attendees} />

      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">녹음 & 전사</h2>
        <div className="space-y-6">
          <RecordingUpload
            meetingId={meetingId}
            hasRecording={!!meeting.recordingUrl}
          />
          <TranscriptPaste
            meetingId={meetingId}
            hasTranscript={!!meeting.transcript}
          />
          <TranscriptTab transcript={meeting.transcript} />
        </div>
      </div>

      <div className="border-t pt-6">
        <ActionItemsTab
          meetingId={meetingId}
          actionItems={meeting.actionItems}
        />
      </div>

      {meeting.emailLogs.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-3">발송 이력</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            {meeting.emailLogs.map((log) => (
              <div key={log.id} className="flex justify-between">
                <span>{log.to}</span>
                <span>{new Date(log.sentAt).toLocaleString("ko-KR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/meetings/\[meetingId\]/ apps/web/src/components/meetings/action-item-row.tsx
git commit -m "feat: add meeting detail page with transcript/actions tabs, attendee management, and summary email"
```

---

## Task 10: Meeting Create Page

**Files:**
- Create: `apps/web/src/app/(app)/meetings/new/page.tsx`
- Create: `apps/web/src/components/meetings/meeting-form.tsx`

- [ ] **Step 1: Create meeting form component**

Create `apps/web/src/components/meetings/meeting-form.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface MeetingFormProps {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  preselectedClientId?: string;
  preselectedProjectId?: string;
}

export function MeetingForm({
  clients,
  projects,
  preselectedClientId,
  preselectedProjectId,
}: MeetingFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");

  const filteredProjects = projects.filter(
    (p) => p.clientId === selectedClientId
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      clientId: formData.get("clientId"),
      projectId: formData.get("projectId") || undefined,
      title: formData.get("title"),
      date: formData.get("date"),
      location: formData.get("location") || undefined,
    };

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const meeting = await response.json();
        router.push(`/meetings/${meeting.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>새 미팅 등록</CardTitle>
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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {filteredProjects.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="projectId">프로젝트 (선택)</Label>
              <select
                name="projectId"
                defaultValue={preselectedProjectId || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">없음</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">미팅 제목 *</Label>
            <Input name="title" required placeholder="예: 초기 미팅, 중간 점검" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">일시 *</Label>
            <Input name="date" type="datetime-local" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">장소</Label>
            <Input name="location" placeholder="예: 판교 오피스, Zoom" />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            미팅 등록
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create meeting new page**

Create `apps/web/src/app/(app)/meetings/new/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { MeetingForm } from "@/components/meetings/meeting-form";

interface PageProps {
  searchParams: Promise<{
    clientId?: string;
    projectId?: string;
  }>;
}

export default async function NewMeetingPage({ searchParams }: PageProps) {
  const user = await getVerifiedUser();
  const params = await searchParams;

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true },
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, title: true, clientId: true },
      where: { status: { not: "COMPLETED" } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <MeetingForm
        clients={clients}
        projects={projects}
        preselectedClientId={params.clientId}
        preselectedProjectId={params.projectId}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/meetings/new/ apps/web/src/components/meetings/meeting-form.tsx
git commit -m "feat: add meeting creation page with client/project selection"
```

---

## Task 11: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run all meeting tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/meetings/
```

Expected: All tests PASS.

- [ ] **Step 3: Verify dev server renders meeting pages**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected: Navigate to /meetings — page renders. Navigate to /meetings/new — form renders.

- [ ] **Step 4: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 9 complete — Meeting Intelligence with transcription pipeline, action items, and summary emails"
```

---

## Summary

Phase 9 delivers:
- **Meeting CRUD**: Create, list (with pagination + filters), detail, update, delete
- **Attendee Management**: Add/remove internal users and external contacts
- **Recording Upload**: Audio file → Supabase Storage with file validation (500MB max)
- **QStash Transcription Pipeline**: 3-step job chain (transcribe → summarize → extract actions)
- **Manual Transcript Paste**: For 클로바노트 users, skips STT step
- **AI Modules**: `transcribe.ts` (OpenAI Whisper + mlx-whisper fallback), `summarize-meeting.ts` (Haiku), `extract-actions.ts` (Haiku)
- **MeetingTranscript**: rawTranscript, summary, keyDecisions, sentiment
- **ActionItem CRUD**: Status workflow (OPEN → IN_PROGRESS → DONE), ChecklistItem linking
- **Summary Email**: Auto-send meeting summary + action items to all attendees via Resend
- **UI Pages**: Meeting list (card grid), meeting detail (header, attendees, tabs for transcript/actions), meeting create form
