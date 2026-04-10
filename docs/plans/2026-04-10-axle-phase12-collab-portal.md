# AXLE Phase 12: Collaboration & Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team collaboration features (project member assignment, handoff workflow, activity log) and a client-facing external portal for document upload, checklist viewing, research journal writing, and project status summary.

**Architecture:** Two route groups in apps/web: `(collab)` for internal team collaboration and `(portal)` for external client access via token-based authentication. ReBAC integration for permission management on project membership changes.

**Tech Stack:** Next.js 16, Prisma 7, @axle/db (ProjectMember, RelationTuple, Notification), @axle/auth, @axle/email (Resend), @axle/ui (shadcn/ui), Zod, Vitest

**Depends on:** Phase 0 (Foundation), Phase 3 (Projects), Phase 4 (Notifications), Phase 2 (Documents/uploadToken)

---

## File Structure

```
apps/web/src/
├── app/
│   ├── (app)/
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── members/
│   │   │       │   └── page.tsx              # ProjectMember management UI
│   │   │       ├── activity/
│   │   │       │   └── page.tsx              # Activity log + comments
│   │   │       └── handoff/
│   │   │           └── page.tsx              # Handoff workflow UI
│   │   └── ...
│   ├── (portal)/
│   │   └── portal/
│   │       └── [token]/
│   │           ├── layout.tsx                # Portal layout (no sidebar)
│   │           ├── page.tsx                  # Portal landing / status summary
│   │           ├── upload/
│   │           │   └── page.tsx              # Document upload page
│   │           ├── checklist/
│   │           │   └── page.tsx              # Read-only checklist view
│   │           └── journal/
│   │               ├── page.tsx              # Journal list
│   │               └── new/
│   │                   └── page.tsx          # Journal writing form
│   └── api/
│       ├── projects/
│       │   └── [id]/
│       │       ├── members/
│       │       │   └── route.ts              # GET/POST/DELETE members
│       │       ├── handoff/
│       │       │   └── route.ts              # POST handoff
│       │       └── activity/
│       │           └── route.ts              # GET/POST activity
│       └── portal/
│           └── [token]/
│               ├── route.ts                  # GET portal info (validate token)
│               ├── upload/
│               │   └── route.ts              # POST document upload
│               ├── checklist/
│               │   └── route.ts              # GET checklist
│               └── journal/
│                   └── route.ts              # GET/POST journal
├── lib/
│   ├── actions/
│   │   ├── member-actions.ts                 # Server actions for members
│   │   ├── handoff-actions.ts                # Server actions for handoff
│   │   └── portal-actions.ts                 # Server actions for portal
│   └── validators/
│       ├── member-schemas.ts                 # Zod schemas
│       ├── handoff-schemas.ts
│       └── portal-schemas.ts
└── components/
    ├── members/
    │   ├── member-list.tsx                    # Member list with role badges
    │   ├── add-member-dialog.tsx              # Add member dialog
    │   └── member-role-select.tsx             # Role dropdown
    ├── handoff/
    │   ├── handoff-form.tsx                   # Handoff initiation form
    │   └── handoff-summary.tsx               # AI-generated summary display
    ├── activity/
    │   ├── activity-feed.tsx                  # Activity timeline
    │   └── comment-form.tsx                   # Comment input
    └── portal/
        ├── portal-header.tsx                  # Minimal portal header
        ├── portal-status-card.tsx             # Project status summary
        ├── portal-upload-form.tsx             # Upload form
        ├── portal-checklist.tsx               # Read-only checklist
        └── portal-journal-form.tsx            # Journal writing form

packages/db/
├── prisma/
│   └── schema.prisma                          # Add ProjectActivity model
└── src/
    └── activity.ts                            # Activity log helpers
```

---

## Task 1: Schema — Add ProjectActivity Model + PortalToken Model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/activity.ts`

- [ ] **Step 1: Add ProjectActivity and PortalToken models to Prisma schema**

Add to `packages/db/prisma/schema.prisma`:

```prisma
// ==================== Collaboration ====================

model ProjectActivity {
  id        String       @id @default(cuid())
  projectId String
  userId    String?
  type      ActivityType
  content   String
  metadata  Json?
  createdAt DateTime     @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@index([projectId, createdAt])
}

enum ActivityType {
  COMMENT
  MEMBER_ADDED
  MEMBER_REMOVED
  ROLE_CHANGED
  STATUS_CHANGED
  HANDOFF
  DOCUMENT_UPLOADED
  CHECKLIST_UPDATED
}

model PortalToken {
  id        String    @id @default(cuid())
  token     String    @unique
  clientId  String
  projectId String?
  scope     PortalScope[]
  expiresAt DateTime?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())

  client  Client   @relation(fields: [clientId], references: [id])
  project Project? @relation(fields: [projectId], references: [id])
  @@index([token])
}

enum PortalScope {
  UPLOAD
  CHECKLIST
  JOURNAL
  STATUS
}
```

Also add the relation fields to the existing Project and Client models:

```prisma
// In model Project, add:
  activities   ProjectActivity[]
  portalTokens PortalToken[]

// In model Client, add:
  portalTokens PortalToken[]
```

- [ ] **Step 2: Generate Prisma client**

```bash
cd /Volumes/포터블/AX/axle/packages/db
npx prisma generate
```

Expected: "Generated Prisma Client" without errors.

- [ ] **Step 3: Push schema changes**

```bash
cd /Volumes/포터블/AX/axle/packages/db
npx prisma db push
```

Expected: Schema in sync.

- [ ] **Step 4: Create activity log helper**

Create `packages/db/src/activity.ts`:

```typescript
import { prisma } from "./client";
import type { ActivityType } from "@prisma/client";

export async function logActivity(
  projectId: string,
  type: ActivityType,
  content: string,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.projectActivity.create({
    data: {
      projectId,
      userId,
      type,
      content,
      metadata: metadata ?? undefined,
    },
  });
}

export async function getActivities(
  projectId: string,
  options?: { limit?: number; cursor?: string }
) {
  const { limit = 50, cursor } = options ?? {};

  return prisma.projectActivity.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}
```

- [ ] **Step 5: Export new types and helpers from packages/db**

Update `packages/db/src/index.ts` to add:

```typescript
export { logActivity, getActivities } from "./activity";
export type {
  ProjectActivity,
  PortalToken,
} from "@prisma/client";
export {
  ActivityType,
  PortalScope,
} from "@prisma/client";
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/db/
git commit -m "feat: add ProjectActivity and PortalToken models for collab and portal"
```

---

## Task 2: Zod Validation Schemas

**Files:**
- Create: `apps/web/src/lib/validators/member-schemas.ts`
- Create: `apps/web/src/lib/validators/handoff-schemas.ts`
- Create: `apps/web/src/lib/validators/portal-schemas.ts`

- [ ] **Step 1: Create member validation schemas**

Create `apps/web/src/lib/validators/member-schemas.ts`:

```typescript
import { z } from "zod";

export const addMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["LEAD", "MEMBER", "VIEWER"]),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().cuid(),
  role: z.enum(["LEAD", "MEMBER", "VIEWER"]),
});

export const removeMemberSchema = z.object({
  memberId: z.string().cuid(),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
```

- [ ] **Step 2: Create handoff validation schemas**

Create `apps/web/src/lib/validators/handoff-schemas.ts`:

```typescript
import { z } from "zod";

export const initiateHandoffSchema = z.object({
  projectId: z.string().cuid(),
  fromUserId: z.string().cuid(),
  toUserId: z.string().cuid(),
  message: z.string().max(2000).optional(),
});

export type InitiateHandoffInput = z.infer<typeof initiateHandoffSchema>;
```

- [ ] **Step 3: Create portal validation schemas**

Create `apps/web/src/lib/validators/portal-schemas.ts`:

```typescript
import { z } from "zod";

export const createPortalTokenSchema = z.object({
  clientId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  scope: z.array(z.enum(["UPLOAD", "CHECKLIST", "JOURNAL", "STATUS"])).min(1),
  expiresInDays: z.number().int().min(1).max(365).optional().default(30),
});

export const portalJournalSchema = z.object({
  date: z.string().datetime(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  objectives: z.string().optional(),
  results: z.string().optional(),
  nextSteps: z.string().optional(),
  hours: z.number().min(0).max(24).optional(),
});

export type CreatePortalTokenInput = z.infer<typeof createPortalTokenSchema>;
export type PortalJournalInput = z.infer<typeof portalJournalSchema>;
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validators/
git commit -m "feat: add Zod validation schemas for members, handoff, and portal"
```

---

## Task 3: Server Actions — Project Members + ReBAC Integration

**Files:**
- Create: `apps/web/src/lib/actions/member-actions.ts`
- Create: `apps/web/src/lib/actions/member-actions.test.ts`

- [ ] **Step 1: Write failing tests for member actions**

Create `apps/web/src/lib/actions/member-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies
vi.mock("@axle/db", () => ({
  prisma: {
    projectMember: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
  grant: vi.fn(),
  revoke: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@axle/auth/dal", () => ({
  getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-1", name: "Admin" }),
}));

import { prisma, grant, revoke, logActivity } from "@axle/db";
import { addMember, removeMember, updateMemberRole, listMembers } from "./member-actions";

describe("Member Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addMember", () => {
    it("creates a project member and grants ReBAC permission", async () => {
      const mockMember = { id: "pm-1", projectId: "proj-1", userId: "user-2", role: "MEMBER" };
      (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "proj-1", title: "Test" });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-2", name: "User 2" });
      (prisma.projectMember.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);

      const result = await addMember("proj-1", { userId: "user-2", role: "MEMBER" });

      expect(result).toEqual(mockMember);
      expect(grant).toHaveBeenCalledWith("project", "proj-1", "editor", "user", "user-2");
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-2",
            type: "PROJECT_ASSIGNED",
          }),
        })
      );
      expect(logActivity).toHaveBeenCalledWith(
        "proj-1",
        "MEMBER_ADDED",
        expect.stringContaining("User 2"),
        "user-1",
        expect.any(Object)
      );
    });
  });

  describe("removeMember", () => {
    it("removes member and revokes ReBAC permission", async () => {
      const mockMember = { id: "pm-1", projectId: "proj-1", userId: "user-2", role: "MEMBER" };
      (prisma.projectMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);
      (prisma.projectMember.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);

      await removeMember("proj-1", "pm-1");

      expect(revoke).toHaveBeenCalledWith("project", "proj-1", "editor", "user", "user-2");
      expect(logActivity).toHaveBeenCalledWith(
        "proj-1",
        "MEMBER_REMOVED",
        expect.any(String),
        "user-1",
        expect.any(Object)
      );
    });
  });

  describe("updateMemberRole", () => {
    it("updates role and adjusts ReBAC relation", async () => {
      const oldMember = { id: "pm-1", projectId: "proj-1", userId: "user-2", role: "MEMBER" };
      const updatedMember = { ...oldMember, role: "LEAD" };
      (prisma.projectMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(oldMember);
      (prisma.projectMember.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedMember);

      const result = await updateMemberRole("proj-1", { memberId: "pm-1", role: "LEAD" });

      expect(result.role).toBe("LEAD");
      expect(revoke).toHaveBeenCalledWith("project", "proj-1", "editor", "user", "user-2");
      expect(grant).toHaveBeenCalledWith("project", "proj-1", "owner", "user", "user-2");
    });
  });

  describe("listMembers", () => {
    it("returns all members with user info", async () => {
      const members = [
        { id: "pm-1", projectId: "proj-1", userId: "user-1", role: "LEAD", user: { name: "Lead" } },
        { id: "pm-2", projectId: "proj-1", userId: "user-2", role: "MEMBER", user: { name: "Member" } },
      ];
      (prisma.projectMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(members);

      const result = await listMembers("proj-1");

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("LEAD");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/actions/member-actions.test.ts
```

Expected: FAIL — "Cannot find module './member-actions'"

- [ ] **Step 3: Implement member actions**

Create `apps/web/src/lib/actions/member-actions.ts`:

```typescript
"use server";

import { prisma, grant, revoke, logActivity } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { addMemberSchema, updateMemberRoleSchema } from "../validators/member-schemas";
import type { AddMemberInput, UpdateMemberRoleInput } from "../validators/member-schemas";
import type { MemberRole } from "@prisma/client";

const ROLE_TO_REBAC: Record<MemberRole, string> = {
  LEAD: "owner",
  MEMBER: "editor",
  VIEWER: "viewer",
};

export async function addMember(projectId: string, input: AddMemberInput) {
  const currentUser = await getVerifiedUser();
  const validated = addMemberSchema.parse(input);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) throw new Error("Project not found");

  const user = await prisma.user.findUnique({
    where: { id: validated.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new Error("User not found");

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: validated.userId,
      role: validated.role,
    },
  });

  // Grant ReBAC permission
  const rebacRelation = ROLE_TO_REBAC[validated.role];
  await grant("project", projectId, rebacRelation, "user", validated.userId);

  // Create notification
  await prisma.notification.create({
    data: {
      userId: validated.userId,
      type: "PROJECT_ASSIGNED",
      title: `프로젝트에 배정되었습니다: ${project.title}`,
      body: `${currentUser.name}님이 ${validated.role} 역할로 배정했습니다.`,
      link: `/projects/${projectId}`,
    },
  });

  // Log activity
  await logActivity(
    projectId,
    "MEMBER_ADDED",
    `${user.name ?? user.email}님이 ${validated.role} 역할로 추가되었습니다.`,
    currentUser.id,
    { memberId: member.id, userId: validated.userId, role: validated.role }
  );

  return member;
}

export async function removeMember(projectId: string, memberId: string) {
  const currentUser = await getVerifiedUser();

  const member = await prisma.projectMember.findUnique({
    where: { id: memberId },
  });
  if (!member || member.projectId !== projectId) {
    throw new Error("Member not found");
  }

  await prisma.projectMember.delete({ where: { id: memberId } });

  // Revoke ReBAC permission
  const rebacRelation = ROLE_TO_REBAC[member.role];
  await revoke("project", projectId, rebacRelation, "user", member.userId);

  // Log activity
  await logActivity(
    projectId,
    "MEMBER_REMOVED",
    `멤버가 프로젝트에서 제거되었습니다.`,
    currentUser.id,
    { memberId, userId: member.userId, role: member.role }
  );
}

export async function updateMemberRole(
  projectId: string,
  input: UpdateMemberRoleInput
) {
  const currentUser = await getVerifiedUser();
  const validated = updateMemberRoleSchema.parse(input);

  const member = await prisma.projectMember.findUnique({
    where: { id: validated.memberId },
  });
  if (!member || member.projectId !== projectId) {
    throw new Error("Member not found");
  }

  const oldRole = member.role;
  const updatedMember = await prisma.projectMember.update({
    where: { id: validated.memberId },
    data: { role: validated.role },
  });

  // Update ReBAC: revoke old, grant new
  await revoke("project", projectId, ROLE_TO_REBAC[oldRole], "user", member.userId);
  await grant("project", projectId, ROLE_TO_REBAC[validated.role], "user", member.userId);

  // Log activity
  await logActivity(
    projectId,
    "ROLE_CHANGED",
    `역할이 ${oldRole}에서 ${validated.role}(으)로 변경되었습니다.`,
    currentUser.id,
    { memberId: validated.memberId, oldRole, newRole: validated.role }
  );

  return updatedMember;
}

export async function listMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: {
      project: false,
    },
    orderBy: [
      { role: "asc" }, // LEAD first
    ],
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/actions/member-actions.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/actions/member-actions.ts apps/web/src/lib/actions/member-actions.test.ts
git commit -m "feat: add project member CRUD with ReBAC integration and notifications"
```

---

## Task 4: Server Actions — Handoff Workflow

**Files:**
- Create: `apps/web/src/lib/actions/handoff-actions.ts`
- Create: `apps/web/src/lib/actions/handoff-actions.test.ts`

- [ ] **Step 1: Write failing tests for handoff actions**

Create `apps/web/src/lib/actions/handoff-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@axle/db", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    projectActivity: {
      findMany: vi.fn(),
    },
    checklistItem: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
  grant: vi.fn(),
  revoke: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@axle/auth/dal", () => ({
  getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-1", name: "Consultant A" }),
}));

vi.mock("@axle/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "email-1" }),
}));

import { prisma, logActivity } from "@axle/db";
import { initiateHandoff, generateHandoffSummary } from "./handoff-actions";

describe("Handoff Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateHandoffSummary", () => {
    it("produces a summary with project status, pending items, and recent activity", async () => {
      (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "proj-1",
        title: "벤처인증",
        status: "DOC_COLLECTING",
        priority: "HIGH",
        dueDate: new Date("2026-05-01"),
        client: { name: "테스트기업" },
      });
      (prisma.checklistItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: "사업자등록증", status: "VERIFIED" },
        { name: "재무제표", status: "PENDING" },
        { name: "기술보유현황", status: "REQUESTED" },
      ]);
      (prisma.projectActivity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { type: "COMMENT", content: "재무제표 요청함", createdAt: new Date() },
        { type: "DOCUMENT_UPLOADED", content: "사업자등록증 업로드", createdAt: new Date() },
      ]);

      const summary = await generateHandoffSummary("proj-1");

      expect(summary).toContain("벤처인증");
      expect(summary).toContain("DOC_COLLECTING");
      expect(summary).toContain("재무제표");
    });
  });

  describe("initiateHandoff", () => {
    it("transfers ownership and sends notification + email", async () => {
      (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "proj-1",
        title: "벤처인증",
        status: "DOC_COLLECTING",
        priority: "HIGH",
        dueDate: null,
        client: { name: "테스트기업" },
      });
      (prisma.checklistItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.projectActivity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-2",
        name: "Consultant B",
        email: "b@test.com",
      });
      (prisma.projectMember.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pm-2",
        projectId: "proj-1",
        userId: "user-2",
        role: "LEAD",
      });

      await initiateHandoff({
        projectId: "proj-1",
        fromUserId: "user-1",
        toUserId: "user-2",
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "HANDOFF",
            userId: "user-2",
          }),
        })
      );
      expect(logActivity).toHaveBeenCalledWith(
        "proj-1",
        "HANDOFF",
        expect.any(String),
        "user-1",
        expect.any(Object)
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/actions/handoff-actions.test.ts
```

Expected: FAIL — "Cannot find module './handoff-actions'"

- [ ] **Step 3: Implement handoff actions**

Create `apps/web/src/lib/actions/handoff-actions.ts`:

```typescript
"use server";

import { prisma, grant, revoke, logActivity } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { sendEmail } from "@axle/email";
import { initiateHandoffSchema } from "../validators/handoff-schemas";
import type { InitiateHandoffInput } from "../validators/handoff-schemas";

/**
 * Generate an AI-style summary of current project state for handoff.
 * Includes: status, pending checklist items, recent activity.
 */
export async function generateHandoffSummary(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: { select: { name: true } } },
  });
  if (!project) throw new Error("Project not found");

  const checklist = await prisma.checklistItem.findMany({
    where: { projectId },
    select: { name: true, status: true },
  });

  const recentActivity = await prisma.projectActivity.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { type: true, content: true, createdAt: true },
  });

  const pendingItems = checklist.filter((c) => c.status !== "VERIFIED");
  const completedItems = checklist.filter((c) => c.status === "VERIFIED");

  const lines: string[] = [
    `## 프로젝트 핸드오프 요약`,
    ``,
    `**프로젝트:** ${project.title}`,
    `**고객사:** ${project.client?.name ?? "미지정"}`,
    `**현재 상태:** ${project.status}`,
    `**우선순위:** ${project.priority}`,
    ...(project.dueDate
      ? [`**마감일:** ${project.dueDate.toISOString().split("T")[0]}`]
      : []),
    ``,
    `### 체크리스트 현황`,
    `- 완료: ${completedItems.length}건`,
    `- 미완료: ${pendingItems.length}건`,
    ...pendingItems.map((p) => `  - [ ] ${p.name} (${p.status})`),
    ``,
    `### 최근 활동 (최근 10건)`,
    ...recentActivity.map(
      (a) =>
        `- [${a.createdAt.toISOString().split("T")[0]}] ${a.type}: ${a.content}`
    ),
  ];

  return lines.join("\n");
}

/**
 * Initiate a handoff from one consultant to another.
 * 1. Generate project summary
 * 2. Transfer LEAD role to incoming consultant
 * 3. Send handoff notification
 * 4. Send handoff email
 * 5. Log activity
 */
export async function initiateHandoff(input: InitiateHandoffInput) {
  const currentUser = await getVerifiedUser();
  const validated = initiateHandoffSchema.parse(input);

  const { projectId, fromUserId, toUserId, message } = validated;

  // Generate summary
  const summary = await generateHandoffSummary(projectId);

  // Get incoming user info
  const toUser = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, name: true, email: true },
  });
  if (!toUser) throw new Error("Incoming consultant not found");

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });
  if (!project) throw new Error("Project not found");

  // Demote outgoing consultant from LEAD to MEMBER
  await prisma.projectMember.updateMany({
    where: { projectId, userId: fromUserId, role: "LEAD" },
    data: { role: "MEMBER" },
  });
  await revoke("project", projectId, "owner", "user", fromUserId);
  await grant("project", projectId, "editor", "user", fromUserId);

  // Add or promote incoming consultant to LEAD
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: toUserId } },
    create: { projectId, userId: toUserId, role: "LEAD" },
    update: { role: "LEAD" },
  });
  await revoke("project", projectId, "editor", "user", toUserId);
  await revoke("project", projectId, "viewer", "user", toUserId);
  await grant("project", projectId, "owner", "user", toUserId);

  // Notification
  await prisma.notification.create({
    data: {
      userId: toUserId,
      type: "HANDOFF",
      title: `프로젝트 인수: ${project.title}`,
      body: `${currentUser.name}님이 프로젝트를 인수해 주셨습니다.${message ? ` 메모: ${message}` : ""}`,
      link: `/projects/${projectId}`,
    },
  });

  // Send handoff email
  if (toUser.email) {
    await sendEmail({
      to: toUser.email,
      subject: `[AXLE] 프로젝트 핸드오프: ${project.title}`,
      html: `
        <h2>프로젝트 핸드오프</h2>
        <p>${currentUser.name}님이 다음 프로젝트의 담당을 이관합니다.</p>
        ${message ? `<p><strong>메모:</strong> ${message}</p>` : ""}
        <hr />
        <pre>${summary}</pre>
        <hr />
        <p><a href="${process.env.NEXTAUTH_URL}/projects/${projectId}">프로젝트 바로가기</a></p>
      `,
    });
  }

  // Log activity
  await logActivity(
    projectId,
    "HANDOFF",
    `${currentUser.name}님이 ${toUser.name}님에게 프로젝트를 인수했습니다.`,
    currentUser.id,
    { fromUserId, toUserId, message }
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/actions/handoff-actions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/actions/handoff-actions.ts apps/web/src/lib/actions/handoff-actions.test.ts
git commit -m "feat: add handoff workflow with auto-summary, ReBAC transfer, and email notification"
```

---

## Task 5: Server Actions — Portal Token + Portal Access

**Files:**
- Create: `apps/web/src/lib/actions/portal-actions.ts`
- Create: `apps/web/src/lib/actions/portal-actions.test.ts`

- [ ] **Step 1: Write failing tests for portal actions**

Create `apps/web/src/lib/actions/portal-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomBytes } from "crypto";

vi.mock("@axle/db", () => ({
  prisma: {
    portalToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    checklistItem: {
      findMany: vi.fn(),
    },
    researchJournal: {
      create: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
  },
  logActivity: vi.fn(),
}));

vi.mock("@axle/auth/dal", () => ({
  getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("crypto", () => ({
  randomBytes: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue("abc123token456"),
  }),
}));

import { prisma } from "@axle/db";
import {
  createPortalToken,
  validatePortalToken,
  getPortalChecklist,
} from "./portal-actions";

describe("Portal Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPortalToken", () => {
    it("creates a token with scope and expiry", async () => {
      const mockToken = {
        id: "pt-1",
        token: "abc123token456",
        clientId: "client-1",
        projectId: "proj-1",
        scope: ["UPLOAD", "CHECKLIST"],
        expiresAt: expect.any(Date),
        isActive: true,
      };
      (prisma.portalToken.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockToken);

      const result = await createPortalToken({
        clientId: "client-1",
        projectId: "proj-1",
        scope: ["UPLOAD", "CHECKLIST"],
        expiresInDays: 30,
      });

      expect(result.token).toBe("abc123token456");
      expect(result.scope).toContain("UPLOAD");
    });
  });

  describe("validatePortalToken", () => {
    it("returns token data for valid, non-expired token", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const mockToken = {
        id: "pt-1",
        token: "valid-token",
        clientId: "client-1",
        projectId: "proj-1",
        scope: ["UPLOAD"],
        expiresAt: futureDate,
        isActive: true,
        client: { id: "client-1", name: "Test Corp" },
        project: { id: "proj-1", title: "Test Project", status: "IN_PROGRESS" },
      };
      (prisma.portalToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockToken);

      const result = await validatePortalToken("valid-token");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("client-1");
    });

    it("returns null for expired token", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      (prisma.portalToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pt-1",
        token: "expired-token",
        expiresAt: pastDate,
        isActive: true,
      });

      const result = await validatePortalToken("expired-token");
      expect(result).toBeNull();
    });

    it("returns null for inactive token", async () => {
      (prisma.portalToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pt-1",
        token: "inactive-token",
        expiresAt: null,
        isActive: false,
      });

      const result = await validatePortalToken("inactive-token");
      expect(result).toBeNull();
    });
  });

  describe("getPortalChecklist", () => {
    it("returns checklist items for valid token with CHECKLIST scope", async () => {
      const items = [
        { id: "ci-1", name: "사업자등록증", status: "VERIFIED" },
        { id: "ci-2", name: "재무제표", status: "PENDING" },
      ];
      (prisma.checklistItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(items);

      const result = await getPortalChecklist("proj-1");

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("VERIFIED");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/actions/portal-actions.test.ts
```

Expected: FAIL — "Cannot find module './portal-actions'"

- [ ] **Step 3: Implement portal actions**

Create `apps/web/src/lib/actions/portal-actions.ts`:

```typescript
"use server";

import { randomBytes } from "crypto";
import { prisma, logActivity } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import {
  createPortalTokenSchema,
  portalJournalSchema,
} from "../validators/portal-schemas";
import type {
  CreatePortalTokenInput,
  PortalJournalInput,
} from "../validators/portal-schemas";

/**
 * Create a portal access token for a client.
 * Requires authenticated user (consultant).
 */
export async function createPortalToken(input: CreatePortalTokenInput) {
  await getVerifiedUser();
  const validated = createPortalTokenSchema.parse(input);

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + validated.expiresInDays);

  return prisma.portalToken.create({
    data: {
      token,
      clientId: validated.clientId,
      projectId: validated.projectId,
      scope: validated.scope,
      expiresAt,
    },
  });
}

/**
 * Validate a portal token.
 * Does NOT require authentication — tokens are the auth mechanism.
 */
export async function validatePortalToken(token: string) {
  const portalToken = await prisma.portalToken.findUnique({
    where: { token },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, title: true, status: true } },
    },
  });

  if (!portalToken) return null;
  if (!portalToken.isActive) return null;
  if (portalToken.expiresAt && portalToken.expiresAt < new Date()) return null;

  return portalToken;
}

/**
 * Check if a portal token has a specific scope.
 */
export function hasScope(
  tokenScopes: string[],
  required: string
): boolean {
  return tokenScopes.includes(required);
}

/**
 * Get checklist items for portal view (read-only).
 */
export async function getPortalChecklist(projectId: string) {
  return prisma.checklistItem.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      description: true,
      isRequired: true,
      status: true,
      uploadedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get project status summary for portal view.
 */
export async function getPortalProjectStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      priority: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!project) return null;

  const checklist = await prisma.checklistItem.findMany({
    where: { projectId },
    select: { status: true },
  });

  const total = checklist.length;
  const completed = checklist.filter((c) => c.status === "VERIFIED").length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    ...project,
    checklistProgress: { total, completed, progress },
  };
}

/**
 * Submit a research journal entry from portal.
 */
export async function submitPortalJournal(
  clientId: string,
  researcherContactId: string,
  input: PortalJournalInput
) {
  const validated = portalJournalSchema.parse(input);

  const journal = await prisma.researchJournal.create({
    data: {
      clientId,
      researcherContactId,
      date: new Date(validated.date),
      title: validated.title,
      content: validated.content,
      objectives: validated.objectives,
      results: validated.results,
      nextSteps: validated.nextSteps,
      hours: validated.hours,
      status: "DRAFT",
    },
  });

  return journal;
}

/**
 * Revoke a portal token.
 */
export async function revokePortalToken(tokenId: string) {
  await getVerifiedUser();
  return prisma.portalToken.update({
    where: { id: tokenId },
    data: { isActive: false },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/actions/portal-actions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/actions/portal-actions.ts apps/web/src/lib/actions/portal-actions.test.ts
git commit -m "feat: add portal token CRUD and portal access actions (checklist, status, journal)"
```

---

## Task 6: API Routes — Project Members

**Files:**
- Create: `apps/web/src/app/api/projects/[id]/members/route.ts`

- [ ] **Step 1: Create members API route**

Create `apps/web/src/app/api/projects/[id]/members/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@axle/auth/dal";
import { check } from "@axle/db";
import {
  addMember,
  removeMember,
  updateMemberRole,
  listMembers,
} from "@/lib/actions/member-actions";
import { addMemberSchema, removeMemberSchema, updateMemberRoleSchema } from "@/lib/validators/member-schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "viewer");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await listMembers(projectId);
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "owner");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = addMemberSchema.parse(body);
    const member = await addMember(projectId, validated);

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "owner");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateMemberRoleSchema.parse(body);
    const member = await updateMemberRole(projectId, validated);

    return NextResponse.json(member);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "owner");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { memberId } = removeMemberSchema.parse(body);
    await removeMember(projectId, memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/projects/
git commit -m "feat: add project members API routes (GET/POST/PATCH/DELETE)"
```

---

## Task 7: API Routes — Handoff + Activity

**Files:**
- Create: `apps/web/src/app/api/projects/[id]/handoff/route.ts`
- Create: `apps/web/src/app/api/projects/[id]/activity/route.ts`

- [ ] **Step 1: Create handoff API route**

Create `apps/web/src/app/api/projects/[id]/handoff/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@axle/auth/dal";
import { check } from "@axle/db";
import { initiateHandoff, generateHandoffSummary } from "@/lib/actions/handoff-actions";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "owner");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const summary = await generateHandoffSummary(projectId);
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "owner");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    await initiateHandoff({
      projectId,
      fromUserId: user.id,
      toUserId: body.toUserId,
      message: body.message,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 2: Create activity API route**

Create `apps/web/src/app/api/projects/[id]/activity/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@axle/auth/dal";
import { check, logActivity, getActivities } from "@axle/db";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "viewer");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const activities = await getActivities(projectId, { limit, cursor });
    return NextResponse.json(activities);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getVerifiedUser();
    const { id: projectId } = await params;

    const hasAccess = await check(user.id, "project", projectId, "editor");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { content } = commentSchema.parse(body);

    await logActivity(projectId, "COMMENT", content, user.id);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/projects/
git commit -m "feat: add handoff and activity API routes with ReBAC access control"
```

---

## Task 8: API Routes — Portal

**Files:**
- Create: `apps/web/src/app/api/portal/[token]/route.ts`
- Create: `apps/web/src/app/api/portal/[token]/upload/route.ts`
- Create: `apps/web/src/app/api/portal/[token]/checklist/route.ts`
- Create: `apps/web/src/app/api/portal/[token]/journal/route.ts`

- [ ] **Step 1: Create portal info/validation route**

Create `apps/web/src/app/api/portal/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validatePortalToken, getPortalProjectStatus } from "@/lib/actions/portal-actions";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { token } = await params;
    const portalToken = await validatePortalToken(token);

    if (!portalToken) {
      return NextResponse.json(
        { error: "Invalid or expired portal link" },
        { status: 401 }
      );
    }

    let projectStatus = null;
    if (portalToken.projectId && portalToken.scope.includes("STATUS")) {
      projectStatus = await getPortalProjectStatus(portalToken.projectId);
    }

    return NextResponse.json({
      client: portalToken.client,
      project: portalToken.project,
      scope: portalToken.scope,
      projectStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create portal upload route**

Create `apps/web/src/app/api/portal/[token]/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validatePortalToken, hasScope } from "@/lib/actions/portal-actions";
import { prisma, logActivity } from "@axle/db";

type RouteParams = { params: Promise<{ token: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { token } = await params;
    const portalToken = await validatePortalToken(token);

    if (!portalToken) {
      return NextResponse.json(
        { error: "Invalid or expired portal link" },
        { status: 401 }
      );
    }

    if (!hasScope(portalToken.scope, "UPLOAD")) {
      return NextResponse.json(
        { error: "Upload not allowed with this token" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const checklistItemId = formData.get("checklistItemId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Upload to storage (delegate to @axle/storage in production)
    // For now, create a Document record with a placeholder URL
    const document = await prisma.document.create({
      data: {
        clientId: portalToken.clientId,
        projectId: portalToken.projectId,
        name: name ?? file.name,
        fileUrl: `/uploads/portal/${portalToken.clientId}/${file.name}`,
        fileType: file.type,
        category: "INPUT",
      },
    });

    // Update checklist item if linked
    if (checklistItemId && portalToken.projectId) {
      await prisma.checklistItem.updateMany({
        where: {
          id: checklistItemId,
          projectId: portalToken.projectId,
        },
        data: {
          status: "UPLOADED",
          uploadedAt: new Date(),
          documentId: document.id,
        },
      });
    }

    // Log activity
    if (portalToken.projectId) {
      await logActivity(
        portalToken.projectId,
        "DOCUMENT_UPLOADED",
        `고객이 포털에서 문서를 업로드했습니다: ${document.name}`,
        undefined,
        { documentId: document.id, via: "portal" }
      );
    }

    return NextResponse.json({ documentId: document.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create portal checklist route**

Create `apps/web/src/app/api/portal/[token]/checklist/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validatePortalToken, hasScope, getPortalChecklist } from "@/lib/actions/portal-actions";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { token } = await params;
    const portalToken = await validatePortalToken(token);

    if (!portalToken) {
      return NextResponse.json(
        { error: "Invalid or expired portal link" },
        { status: 401 }
      );
    }

    if (!hasScope(portalToken.scope, "CHECKLIST")) {
      return NextResponse.json(
        { error: "Checklist access not allowed with this token" },
        { status: 403 }
      );
    }

    if (!portalToken.projectId) {
      return NextResponse.json(
        { error: "No project associated with this token" },
        { status: 400 }
      );
    }

    const checklist = await getPortalChecklist(portalToken.projectId);
    return NextResponse.json(checklist);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create portal journal route**

Create `apps/web/src/app/api/portal/[token]/journal/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  validatePortalToken,
  hasScope,
  submitPortalJournal,
} from "@/lib/actions/portal-actions";
import { prisma } from "@axle/db";
import { portalJournalSchema } from "@/lib/validators/portal-schemas";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { token } = await params;
    const portalToken = await validatePortalToken(token);

    if (!portalToken) {
      return NextResponse.json(
        { error: "Invalid or expired portal link" },
        { status: 401 }
      );
    }

    if (!hasScope(portalToken.scope, "JOURNAL")) {
      return NextResponse.json(
        { error: "Journal access not allowed" },
        { status: 403 }
      );
    }

    const journals = await prisma.researchJournal.findMany({
      where: { clientId: portalToken.clientId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        hours: true,
        createdAt: true,
      },
    });

    return NextResponse.json(journals);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { token } = await params;
    const portalToken = await validatePortalToken(token);

    if (!portalToken) {
      return NextResponse.json(
        { error: "Invalid or expired portal link" },
        { status: 401 }
      );
    }

    if (!hasScope(portalToken.scope, "JOURNAL")) {
      return NextResponse.json(
        { error: "Journal access not allowed" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Get the first researcher contact for this client
    const researcher = await prisma.contact.findFirst({
      where: { clientId: portalToken.clientId, isResearcher: true },
      select: { id: true },
    });

    if (!researcher) {
      return NextResponse.json(
        { error: "No researcher registered for this client" },
        { status: 400 }
      );
    }

    const journal = await submitPortalJournal(
      portalToken.clientId,
      researcher.id,
      body
    );

    return NextResponse.json(journal, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/portal/
git commit -m "feat: add portal API routes (validation, upload, checklist, journal)"
```

---

## Task 9: UI Components — Member Management

**Files:**
- Create: `apps/web/src/components/members/member-list.tsx`
- Create: `apps/web/src/components/members/add-member-dialog.tsx`
- Create: `apps/web/src/components/members/member-role-select.tsx`

- [ ] **Step 1: Create member role select component**

Create `apps/web/src/components/members/member-role-select.tsx`:

```tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@axle/ui/select";
import type { MemberRole } from "@prisma/client";

const ROLE_LABELS: Record<MemberRole, string> = {
  LEAD: "리드",
  MEMBER: "멤버",
  VIEWER: "뷰어",
};

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  LEAD: "모든 권한 (편집, 멤버 관리, 핸드오프)",
  MEMBER: "편집 권한 (문서, 코멘트)",
  VIEWER: "읽기 전용",
};

interface MemberRoleSelectProps {
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  disabled?: boolean;
}

export function MemberRoleSelect({
  value,
  onChange,
  disabled,
}: MemberRoleSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as MemberRole)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROLE_LABELS) as MemberRole[]).map((role) => (
          <SelectItem key={role} value={role}>
            <div>
              <span className="font-medium">{ROLE_LABELS[role]}</span>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Create member list component**

Create `apps/web/src/components/members/member-list.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@axle/ui/button";
import { Badge } from "@axle/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { MemberRoleSelect } from "./member-role-select";
import { Trash2, UserPlus } from "lucide-react";
import type { MemberRole } from "@prisma/client";

interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  user?: { name: string | null; email: string; image: string | null };
}

interface MemberListProps {
  projectId: string;
  members: Member[];
  currentUserId: string;
  canManage: boolean;
  onAddClick: () => void;
  onRoleChange: (memberId: string, role: MemberRole) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
}

const ROLE_COLORS: Record<MemberRole, string> = {
  LEAD: "bg-blue-100 text-blue-800",
  MEMBER: "bg-green-100 text-green-800",
  VIEWER: "bg-gray-100 text-gray-800",
};

export function MemberList({
  projectId,
  members,
  currentUserId,
  canManage,
  onAddClick,
  onRoleChange,
  onRemove,
}: MemberListProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">프로젝트 멤버</CardTitle>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onAddClick}>
            <UserPlus className="mr-2 h-4 w-4" />
            멤버 추가
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {(member.user?.name ?? member.user?.email ?? "?")[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {member.user?.name ?? member.user?.email}
                  </p>
                  {member.user?.email && member.user?.name && (
                    <p className="text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canManage && member.userId !== currentUserId ? (
                  <>
                    <MemberRoleSelect
                      value={member.role}
                      onChange={(role) =>
                        startTransition(() => onRoleChange(member.id, role))
                      }
                      disabled={isPending}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        startTransition(() => onRemove(member.id))
                      }
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <Badge className={ROLE_COLORS[member.role]}>
                    {member.role}
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              아직 배정된 멤버가 없습니다.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create add member dialog**

Create `apps/web/src/components/members/add-member-dialog.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@axle/ui/dialog";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { MemberRoleSelect } from "./member-role-select";
import type { MemberRole } from "@prisma/client";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableUsers: User[];
  onAdd: (userId: string, role: MemberRole) => Promise<void>;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  availableUsers,
  onAdd,
}: AddMemberDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [role, setRole] = useState<MemberRole>("MEMBER");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!selectedUserId) return;
    startTransition(async () => {
      await onAdd(selectedUserId, role);
      setSelectedUserId("");
      setRole("MEMBER");
      setSearch("");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>멤버 추가</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>팀원 검색</Label>
            <Input
              placeholder="이름 또는 이메일로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                  selectedUserId === user.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => setSelectedUserId(user.id)}
              >
                <span className="font-medium">{user.name ?? user.email}</span>
                {user.name && (
                  <span className="ml-2 text-xs opacity-70">{user.email}</span>
                )}
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                검색 결과가 없습니다.
              </p>
            )}
          </div>

          <div>
            <Label>역할</Label>
            <MemberRoleSelect value={role} onChange={setRole} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleAdd} disabled={!selectedUserId || isPending}>
            {isPending ? "추가 중..." : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/members/
git commit -m "feat: add member management UI components (list, add dialog, role select)"
```

---

## Task 10: UI Components — Handoff + Activity

**Files:**
- Create: `apps/web/src/components/handoff/handoff-form.tsx`
- Create: `apps/web/src/components/handoff/handoff-summary.tsx`
- Create: `apps/web/src/components/activity/activity-feed.tsx`
- Create: `apps/web/src/components/activity/comment-form.tsx`

- [ ] **Step 1: Create handoff form**

Create `apps/web/src/components/handoff/handoff-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@axle/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Label } from "@axle/ui/label";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import type { MemberRole } from "@prisma/client";

interface TeamMember {
  id: string;
  userId: string;
  role: MemberRole;
  user?: { name: string | null; email: string };
}

interface HandoffFormProps {
  projectId: string;
  currentUserId: string;
  members: TeamMember[];
  onSubmit: (toUserId: string, message?: string) => Promise<void>;
  onPreview: () => Promise<string>;
}

export function HandoffForm({
  projectId,
  currentUserId,
  members,
  onSubmit,
  onPreview,
}: HandoffFormProps) {
  const [toUserId, setToUserId] = useState("");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const availableRecipients = members.filter(
    (m) => m.userId !== currentUserId
  );

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const result = await onPreview();
      setSummary(result);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!toUserId) return;
    startTransition(async () => {
      await onSubmit(toUserId, message || undefined);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          프로젝트 핸드오프
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>인수자 선택</Label>
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
          >
            <option value="">선택하세요...</option>
            {availableRecipients.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.name ?? m.user?.email} ({m.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>인수 메모 (선택)</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="인수자에게 전달할 메모..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isPreviewLoading}
          >
            {isPreviewLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            요약 미리보기
          </Button>
          <Button onClick={handleSubmit} disabled={!toUserId || isPending}>
            {isPending ? "처리 중..." : "핸드오프 실행"}
          </Button>
        </div>

        {summary && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm">{summary}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create activity feed**

Create `apps/web/src/components/activity/activity-feed.tsx`:

```tsx
"use client";

import { Badge } from "@axle/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import {
  MessageSquare,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Upload,
  CheckSquare,
  Shield,
  Activity,
} from "lucide-react";
import type { ActivityType } from "@prisma/client";

interface ActivityItem {
  id: string;
  type: ActivityType;
  content: string;
  userId: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  COMMENT: <MessageSquare className="h-4 w-4 text-blue-500" />,
  MEMBER_ADDED: <UserPlus className="h-4 w-4 text-green-500" />,
  MEMBER_REMOVED: <UserMinus className="h-4 w-4 text-red-500" />,
  ROLE_CHANGED: <Shield className="h-4 w-4 text-purple-500" />,
  STATUS_CHANGED: <Activity className="h-4 w-4 text-orange-500" />,
  HANDOFF: <ArrowRightLeft className="h-4 w-4 text-indigo-500" />,
  DOCUMENT_UPLOADED: <Upload className="h-4 w-4 text-teal-500" />,
  CHECKLIST_UPDATED: <CheckSquare className="h-4 w-4 text-cyan-500" />,
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR");
}

export function ActivityFeed({
  activities,
  onLoadMore,
  hasMore,
}: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">활동 로그</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {ACTIVITY_ICONS[activity.type]}
              </div>
              <div className="flex-1">
                <p className="text-sm">{activity.content}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRelativeTime(activity.createdAt)}
                </p>
              </div>
            </div>
          ))}

          {activities.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              아직 활동 기록이 없습니다.
            </p>
          )}

          {hasMore && onLoadMore && (
            <button
              type="button"
              className="w-full py-2 text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={onLoadMore}
            >
              더 보기
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create comment form**

Create `apps/web/src/components/activity/comment-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@axle/ui/button";
import { Send } from "lucide-react";

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
}

export function CommentForm({ onSubmit }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      await onSubmit(content.trim());
      setContent("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        rows={2}
        placeholder="코멘트를 입력하세요..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isPending}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!content.trim() || isPending}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/handoff/ apps/web/src/components/activity/
git commit -m "feat: add handoff form, activity feed, and comment UI components"
```

---

## Task 11: UI Components — Portal

**Files:**
- Create: `apps/web/src/components/portal/portal-header.tsx`
- Create: `apps/web/src/components/portal/portal-status-card.tsx`
- Create: `apps/web/src/components/portal/portal-upload-form.tsx`
- Create: `apps/web/src/components/portal/portal-checklist.tsx`
- Create: `apps/web/src/components/portal/portal-journal-form.tsx`

- [ ] **Step 1: Create portal header**

Create `apps/web/src/components/portal/portal-header.tsx`:

```tsx
interface PortalHeaderProps {
  clientName: string;
  projectTitle?: string;
}

export function PortalHeader({ clientName, projectTitle }: PortalHeaderProps) {
  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            AX
          </div>
          <div>
            <h1 className="text-lg font-semibold">{clientName}</h1>
            {projectTitle && (
              <p className="text-sm text-muted-foreground">{projectTitle}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create portal status card**

Create `apps/web/src/components/portal/portal-status-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";

interface ProjectStatus {
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  checklistProgress: {
    total: number;
    completed: number;
    progress: number;
  };
}

interface PortalStatusCardProps {
  project: ProjectStatus;
}

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "접수",
  DOC_COLLECTING: "서류 수집 중",
  IN_PROGRESS: "진행 중",
  REVIEW: "검토 중",
  SUBMITTED: "제출 완료",
  APPROVED: "승인",
  REJECTED: "반려",
  COMPLETED: "완료",
};

export function PortalStatusCard({ project }: PortalStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">프로젝트 현황</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">상태</span>
          <Badge variant="outline">
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
        </div>

        {project.dueDate && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">마감일</span>
            <span className="text-sm">
              {new Date(project.dueDate).toLocaleDateString("ko-KR")}
            </span>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">체크리스트</span>
            <span className="text-sm">
              {project.checklistProgress.completed}/
              {project.checklistProgress.total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${project.checklistProgress.progress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create portal upload form**

Create `apps/web/src/components/portal/portal-upload-form.tsx`:

```tsx
"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@axle/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Upload, FileCheck, X } from "lucide-react";

interface ChecklistItem {
  id: string;
  name: string;
  status: string;
}

interface PortalUploadFormProps {
  token: string;
  checklistItems?: ChecklistItem[];
  onUploadComplete?: () => void;
}

export function PortalUploadForm({
  token,
  checklistItems,
  onUploadComplete,
}: PortalUploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedChecklistItem, setSelectedChecklistItem] = useState("");
  const [isPending, startTransition] = useTransition();
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingItems = checklistItems?.filter((i) => i.status !== "VERIFIED");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (files.length === 0) return;

    startTransition(async () => {
      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("name", file.name);
          if (selectedChecklistItem) {
            formData.append("checklistItemId", selectedChecklistItem);
          }

          const res = await fetch(`/api/portal/${token}/upload`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error("Upload failed");
        }

        setUploadStatus("success");
        setFiles([]);
        onUploadComplete?.();
      } catch {
        setUploadStatus("error");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5" />
          서류 업로드
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingItems && pendingItems.length > 0 && (
          <div>
            <label className="text-sm font-medium">체크리스트 항목 선택 (선택)</label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedChecklistItem}
              onChange={(e) => setSelectedChecklistItem(e.target.value)}
            >
              <option value="">일반 업로드</option>
              {pendingItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center transition-colors hover:border-primary/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            클릭하여 파일을 선택하세요
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX, XLSX, JPG, PNG (최대 50MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.hwp,.hwpx"
            onChange={handleFileSelect}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <span className="text-sm">{file.name}</span>
                <button type="button" onClick={() => removeFile(i)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || isPending}
          className="w-full"
        >
          {isPending ? "업로드 중..." : `${files.length}개 파일 업로드`}
        </Button>

        {uploadStatus === "success" && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700">
            <FileCheck className="h-4 w-4" />
            <span className="text-sm">업로드가 완료되었습니다.</span>
          </div>
        )}

        {uploadStatus === "error" && (
          <div className="rounded-lg bg-red-50 p-3 text-red-700">
            <span className="text-sm">업로드에 실패했습니다. 다시 시도해 주세요.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create portal checklist (read-only)**

Create `apps/web/src/components/portal/portal-checklist.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import { CheckCircle2, Circle, Clock, FileCheck } from "lucide-react";

interface ChecklistItem {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  status: string;
  uploadedAt: string | null;
}

interface PortalChecklistProps {
  items: ChecklistItem[];
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  PENDING: { icon: <Circle className="h-4 w-4" />, label: "미제출", color: "text-gray-400" },
  REQUESTED: { icon: <Clock className="h-4 w-4" />, label: "요청됨", color: "text-yellow-500" },
  UPLOADED: { icon: <FileCheck className="h-4 w-4" />, label: "업로드됨", color: "text-blue-500" },
  VERIFIED: { icon: <CheckCircle2 className="h-4 w-4" />, label: "확인완료", color: "text-green-500" },
};

export function PortalChecklist({ items }: PortalChecklistProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">제출 서류 현황</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => {
            const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className={config.color}>{config.icon}</span>
                  <div>
                    <p className="text-sm font-medium">
                      {item.name}
                      {item.isRequired && (
                        <span className="ml-1 text-xs text-destructive">*</span>
                      )}
                    </p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create portal journal form**

Create `apps/web/src/components/portal/portal-journal-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@axle/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { BookOpen } from "lucide-react";

interface PortalJournalFormProps {
  token: string;
  onSubmitComplete?: () => void;
}

export function PortalJournalForm({
  token,
  onSubmitComplete,
}: PortalJournalFormProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    title: "",
    content: "",
    objectives: "",
    results: "",
    nextSteps: "",
    hours: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/portal/${token}/journal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: new Date(form.date).toISOString(),
            title: form.title,
            content: form.content,
            objectives: form.objectives || undefined,
            results: form.results || undefined,
            nextSteps: form.nextSteps || undefined,
            hours: form.hours ? parseFloat(form.hours) : undefined,
          }),
        });

        if (!res.ok) throw new Error("Submit failed");

        setStatus("success");
        setForm({
          date: new Date().toISOString().split("T")[0],
          title: "",
          content: "",
          objectives: "",
          results: "",
          nextSteps: "",
          hours: "",
        });
        onSubmitComplete?.();
      } catch {
        setStatus("error");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          연구일지 작성
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>날짜</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
            </div>
            <div>
              <Label>연구 시간 (h)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={form.hours}
                onChange={(e) => updateField("hours", e.target.value)}
                placeholder="예: 4.5"
              />
            </div>
          </div>

          <div>
            <Label>제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="연구 제목"
              required
            />
          </div>

          <div>
            <Label>연구 목표</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
              value={form.objectives}
              onChange={(e) => updateField("objectives", e.target.value)}
              placeholder="오늘의 연구 목표"
            />
          </div>

          <div>
            <Label>연구 내용 *</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={6}
              value={form.content}
              onChange={(e) => updateField("content", e.target.value)}
              placeholder="수행한 연구 내용을 상세히 작성하세요"
              required
            />
          </div>

          <div>
            <Label>연구 결과</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={form.results}
              onChange={(e) => updateField("results", e.target.value)}
              placeholder="도출된 결과"
            />
          </div>

          <div>
            <Label>향후 계획</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
              value={form.nextSteps}
              onChange={(e) => updateField("nextSteps", e.target.value)}
              placeholder="다음 연구 계획"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "제출 중..." : "연구일지 제출"}
          </Button>

          {status === "success" && (
            <p className="text-center text-sm text-green-600">
              연구일지가 제출되었습니다.
            </p>
          )}
          {status === "error" && (
            <p className="text-center text-sm text-red-600">
              제출에 실패했습니다. 다시 시도해 주세요.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/portal/
git commit -m "feat: add portal UI components (header, status, upload, checklist, journal)"
```

---

## Task 12: Pages — Portal Layout + Routes

**Files:**
- Create: `apps/web/src/app/(portal)/portal/[token]/layout.tsx`
- Create: `apps/web/src/app/(portal)/portal/[token]/page.tsx`
- Create: `apps/web/src/app/(portal)/portal/[token]/upload/page.tsx`
- Create: `apps/web/src/app/(portal)/portal/[token]/checklist/page.tsx`
- Create: `apps/web/src/app/(portal)/portal/[token]/journal/page.tsx`
- Create: `apps/web/src/app/(portal)/portal/[token]/journal/new/page.tsx`

- [ ] **Step 1: Create portal layout (no sidebar, minimal chrome)**

Create `apps/web/src/app/(portal)/portal/[token]/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { validatePortalToken } from "@/lib/actions/portal-actions";
import { PortalHeader } from "@/components/portal/portal-header";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portalToken = await validatePortalToken(token);

  if (!portalToken) {
    redirect("/portal-expired");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        clientName={portalToken.client?.name ?? ""}
        projectTitle={portalToken.project?.title}
      />
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by AXLE
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Create portal landing page**

Create `apps/web/src/app/(portal)/portal/[token]/page.tsx`:

```tsx
import { validatePortalToken, getPortalProjectStatus } from "@/lib/actions/portal-actions";
import { PortalStatusCard } from "@/components/portal/portal-status-card";
import { Button } from "@axle/ui/button";
import Link from "next/link";
import { Upload, ClipboardList, BookOpen } from "lucide-react";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portalToken = await validatePortalToken(token);

  if (!portalToken) return null;

  const projectStatus = portalToken.projectId
    ? await getPortalProjectStatus(portalToken.projectId)
    : null;

  const scope = portalToken.scope as string[];

  return (
    <div className="space-y-6">
      {projectStatus && <PortalStatusCard project={projectStatus as any} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {scope.includes("UPLOAD") && (
          <Link href={`/portal/${token}/upload`}>
            <div className="flex items-center gap-3 rounded-lg border bg-white p-4 transition-shadow hover:shadow-md">
              <Upload className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">서류 업로드</p>
                <p className="text-sm text-muted-foreground">
                  요청받은 서류를 업로드합니다
                </p>
              </div>
            </div>
          </Link>
        )}

        {scope.includes("CHECKLIST") && (
          <Link href={`/portal/${token}/checklist`}>
            <div className="flex items-center gap-3 rounded-lg border bg-white p-4 transition-shadow hover:shadow-md">
              <ClipboardList className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">체크리스트 현황</p>
                <p className="text-sm text-muted-foreground">
                  제출 서류 현황을 확인합니다
                </p>
              </div>
            </div>
          </Link>
        )}

        {scope.includes("JOURNAL") && (
          <Link href={`/portal/${token}/journal`}>
            <div className="flex items-center gap-3 rounded-lg border bg-white p-4 transition-shadow hover:shadow-md">
              <BookOpen className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">연구일지</p>
                <p className="text-sm text-muted-foreground">
                  연구일지를 작성합니다
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create portal upload page**

Create `apps/web/src/app/(portal)/portal/[token]/upload/page.tsx`:

```tsx
import { validatePortalToken, getPortalChecklist } from "@/lib/actions/portal-actions";
import { PortalUploadForm } from "@/components/portal/portal-upload-form";

export default async function PortalUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portalToken = await validatePortalToken(token);

  if (!portalToken) return null;

  const checklistItems = portalToken.projectId
    ? await getPortalChecklist(portalToken.projectId)
    : [];

  return (
    <PortalUploadForm
      token={token}
      checklistItems={checklistItems.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
      }))}
    />
  );
}
```

- [ ] **Step 4: Create portal checklist page**

Create `apps/web/src/app/(portal)/portal/[token]/checklist/page.tsx`:

```tsx
import { validatePortalToken, getPortalChecklist } from "@/lib/actions/portal-actions";
import { PortalChecklist } from "@/components/portal/portal-checklist";

export default async function PortalChecklistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portalToken = await validatePortalToken(token);

  if (!portalToken || !portalToken.projectId) return null;

  const items = await getPortalChecklist(portalToken.projectId);

  return (
    <PortalChecklist
      items={items.map((item) => ({
        ...item,
        uploadedAt: item.uploadedAt?.toISOString() ?? null,
      }))}
    />
  );
}
```

- [ ] **Step 5: Create portal journal list page**

Create `apps/web/src/app/(portal)/portal/[token]/journal/page.tsx`:

```tsx
import { validatePortalToken } from "@/lib/actions/portal-actions";
import { prisma } from "@axle/db";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import { Button } from "@axle/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function PortalJournalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portalToken = await validatePortalToken(token);

  if (!portalToken) return null;

  const journals = await prisma.researchJournal.findMany({
    where: { clientId: portalToken.clientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      title: true,
      status: true,
      hours: true,
    },
  });

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "임시저장",
    SUBMITTED: "제출됨",
    APPROVED: "승인됨",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">연구일지 목록</h2>
        <Link href={`/portal/${token}/journal/new`}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            새 일지 작성
          </Button>
        </Link>
      </div>

      {journals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            작성된 연구일지가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {journals.map((journal) => (
            <Card key={journal.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{journal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(journal.date).toLocaleDateString("ko-KR")}
                    {journal.hours && ` / ${Number(journal.hours)}시간`}
                  </p>
                </div>
                <Badge variant="outline">
                  {STATUS_LABELS[journal.status] ?? journal.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create portal journal new page**

Create `apps/web/src/app/(portal)/portal/[token]/journal/new/page.tsx`:

```tsx
import { PortalJournalForm } from "@/components/portal/portal-journal-form";

export default async function PortalJournalNewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <PortalJournalForm token={token} />;
}
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(portal\)/
git commit -m "feat: add portal pages (layout, landing, upload, checklist, journal)"
```

---

## Task 13: Pages — Project Members + Activity + Handoff

**Files:**
- Create: `apps/web/src/app/(app)/projects/[id]/members/page.tsx`
- Create: `apps/web/src/app/(app)/projects/[id]/activity/page.tsx`
- Create: `apps/web/src/app/(app)/projects/[id]/handoff/page.tsx`

- [ ] **Step 1: Create project members page**

Create `apps/web/src/app/(app)/projects/[id]/members/page.tsx`:

```tsx
import { getVerifiedUser } from "@axle/auth/dal";
import { prisma, check } from "@axle/db";
import { redirect } from "next/navigation";
import { MemberList } from "@/components/members/member-list";
import { updateMemberRole, removeMember, addMember } from "@/lib/actions/member-actions";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const user = await getVerifiedUser();

  const hasAccess = await check(user.id, "project", projectId, "viewer");
  if (!hasAccess) redirect("/dashboard");

  const canManage = await check(user.id, "project", projectId, "owner");

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      project: false,
    },
    orderBy: { role: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">프로젝트 멤버</h1>
      <MemberList
        projectId={projectId}
        members={members}
        currentUserId={user.id}
        canManage={canManage}
        onAddClick={() => {}} // Client-side handler
        onRoleChange={async (memberId, role) => {
          "use server";
          await updateMemberRole(projectId, { memberId, role });
        }}
        onRemove={async (memberId) => {
          "use server";
          await removeMember(projectId, memberId);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create project activity page**

Create `apps/web/src/app/(app)/projects/[id]/activity/page.tsx`:

```tsx
import { getVerifiedUser } from "@axle/auth/dal";
import { check, getActivities } from "@axle/db";
import { redirect } from "next/navigation";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { CommentForm } from "@/components/activity/comment-form";
import { logActivity } from "@axle/db";

export default async function ProjectActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const user = await getVerifiedUser();

  const hasAccess = await check(user.id, "project", projectId, "viewer");
  if (!hasAccess) redirect("/dashboard");

  const canComment = await check(user.id, "project", projectId, "editor");
  const activities = await getActivities(projectId, { limit: 50 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">활동 로그</h1>

      {canComment && (
        <CommentForm
          onSubmit={async (content) => {
            "use server";
            await logActivity(projectId, "COMMENT", content, user.id);
          }}
        />
      )}

      <ActivityFeed
        activities={activities.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create project handoff page**

Create `apps/web/src/app/(app)/projects/[id]/handoff/page.tsx`:

```tsx
import { getVerifiedUser } from "@axle/auth/dal";
import { prisma, check } from "@axle/db";
import { redirect } from "next/navigation";
import { HandoffForm } from "@/components/handoff/handoff-form";
import { initiateHandoff, generateHandoffSummary } from "@/lib/actions/handoff-actions";

export default async function ProjectHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const user = await getVerifiedUser();

  const canHandoff = await check(user.id, "project", projectId, "owner");
  if (!canHandoff) redirect(`/projects/${projectId}`);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      project: false,
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">프로젝트 핸드오프</h1>
      <HandoffForm
        projectId={projectId}
        currentUserId={user.id}
        members={members}
        onSubmit={async (toUserId, message) => {
          "use server";
          await initiateHandoff({
            projectId,
            fromUserId: user.id,
            toUserId,
            message,
          });
        }}
        onPreview={async () => {
          "use server";
          return generateHandoffSummary(projectId);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/projects/
git commit -m "feat: add project member, activity, and handoff pages"
```

---

## Task 14: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run all unit tests**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test
```

Expected: All member, handoff, and portal tests pass.

- [ ] **Step 3: Verify Turborepo build**

```bash
cd /Volumes/포터블/AX/axle
npx turbo build
```

Expected: All packages and apps build without errors.

- [ ] **Step 4: Verify Prisma schema sync**

```bash
cd /Volumes/포터블/AX/axle/packages/db
npx prisma generate
npx prisma db push
```

Expected: Schema in sync with database.

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 12 complete — collaboration + portal verified"
```

---

## Summary

Phase 12 delivers:
- **ProjectActivity model**: Activity log with typed events (COMMENT, MEMBER_ADDED, HANDOFF, etc.)
- **PortalToken model**: Scoped, time-limited tokens for client external access
- **Member management**: Add/remove/update roles with ReBAC permission sync + PROJECT_ASSIGNED notification
- **Handoff workflow**: Auto-summary generation, LEAD transfer, email notification, HANDOFF notification
- **Activity log**: Comment-based project activity feed with cursor pagination
- **Portal**: Token-validated external access for document upload, checklist viewing, journal writing, and project status
- **ReBAC integration**: Permission tuples automatically created/revoked on membership changes

**Next:** Phase 13 (Estimates & Contracts) adds estimate/contract CRUD with DOCX generation and digital signatures.
