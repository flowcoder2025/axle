# AXLE Phase 3: Project Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the project workflow system — Project CRUD with 7 project types + BUNDLE, status state machine (INTAKE through COMPLETED), parent/child bundle relationships, team member management, auto-generated checklists from templates, pipeline kanban view, and fee tracking.

**Architecture:** Projects link to Client and optionally to ProgramInfo. BUNDLE projects auto-create children via ProjectTree self-relation. State machine enforces valid transitions. ChecklistItems auto-generated from ChecklistTemplates on project creation. ProjectMembers control team access with LEAD/MEMBER/VIEWER roles.

**Tech Stack:** Next.js 16, React 19, Server Actions, Zod, @axle/db (Prisma 7), @axle/auth (Auth.js v5 DAL), @axle/ui (shadcn/ui), Vitest

**Depends on:** Phase 0 (packages/db, packages/auth, packages/ui) + Phase 1 (Client CRUD) + Phase 2 (Documents, ChecklistTemplate)

---

## File Structure

```
axle/
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── (app)/
│           │   │   └── projects/
│           │   │       ├── page.tsx                   # Project list (table + kanban)
│           │   │       ├── new/
│           │   │       │   └── page.tsx               # Create project form
│           │   │       └── [projectId]/
│           │   │           ├── page.tsx               # Project detail (tabs)
│           │   │           ├── edit/
│           │   │           │   └── page.tsx           # Edit project form
│           │   │           └── members/
│           │   │               └── page.tsx           # Manage members
│           │   └── api/
│           │       ├── projects/
│           │       │   ├── route.ts                   # GET list, POST create
│           │       │   └── [projectId]/
│           │       │       ├── route.ts               # GET detail, PATCH update, DELETE
│           │       │       ├── status/
│           │       │       │   └── route.ts           # PATCH status transition
│           │       │       ├── members/
│           │       │       │   ├── route.ts           # GET list, POST add
│           │       │       │   └── [memberId]/
│           │       │       │       └── route.ts       # PATCH role, DELETE remove
│           │       │       └── checklist/
│           │       │           ├── route.ts           # GET items
│           │       │           └── [itemId]/
│           │       │               └── route.ts       # PATCH status
│           ├── lib/
│           │   ├── validations/
│           │   │   └── project.ts                    # Project Zod schemas
│           │   ├── actions/
│           │   │   └── project-actions.ts            # Server actions for projects
│           │   └── project-state-machine.ts          # Status transition logic
│           └── components/
│               └── projects/
│                   ├── project-table.tsx              # Project data table
│                   ├── project-kanban.tsx             # Pipeline kanban view
│                   ├── project-form.tsx               # Create/edit form
│                   ├── project-detail-tabs.tsx        # Detail tabs container
│                   ├── project-overview-tab.tsx       # Overview tab
│                   ├── project-checklist-tab.tsx      # Checklist tab
│                   ├── project-documents-tab.tsx      # Documents tab
│                   ├── project-meetings-tab.tsx       # Meetings tab (placeholder)
│                   ├── project-ai-tab.tsx             # AI jobs tab (placeholder)
│                   ├── project-status-badge.tsx       # Status badge component
│                   ├── project-type-badge.tsx         # Type badge component
│                   ├── project-members.tsx            # Member management
│                   ├── project-fee-info.tsx           # Fee tracking display
│                   ├── bundle-tree.tsx                # Bundle parent/children view
│                   └── project-list-view.tsx          # Table/kanban toggle wrapper
```

---

## Task 1: Project State Machine

**Files:**
- Create: `apps/web/src/lib/project-state-machine.ts`
- Create: `apps/web/src/lib/project-state-machine.test.ts`

- [ ] **Step 1: Write failing test for state machine**

Create `apps/web/src/lib/__tests__/project-state-machine.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  canTransition,
  getValidTransitions,
  PROJECT_STATUS_FLOW,
} from "../project-state-machine";

describe("Project State Machine", () => {
  describe("canTransition", () => {
    it("allows INTAKE → DOC_COLLECTING", () => {
      expect(canTransition("INTAKE", "DOC_COLLECTING")).toBe(true);
    });

    it("allows INTAKE → IN_PROGRESS (skip doc collecting)", () => {
      expect(canTransition("INTAKE", "IN_PROGRESS")).toBe(true);
    });

    it("disallows INTAKE → COMPLETED", () => {
      expect(canTransition("INTAKE", "COMPLETED")).toBe(false);
    });

    it("allows SUBMITTED → APPROVED", () => {
      expect(canTransition("SUBMITTED", "APPROVED")).toBe(true);
    });

    it("allows SUBMITTED → REJECTED", () => {
      expect(canTransition("SUBMITTED", "REJECTED")).toBe(true);
    });

    it("allows REJECTED → IN_PROGRESS (retry)", () => {
      expect(canTransition("REJECTED", "IN_PROGRESS")).toBe(true);
    });

    it("allows APPROVED → COMPLETED", () => {
      expect(canTransition("APPROVED", "COMPLETED")).toBe(true);
    });

    it("disallows COMPLETED → anything except COMPLETED", () => {
      expect(canTransition("COMPLETED", "INTAKE")).toBe(false);
      expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    });
  });

  describe("getValidTransitions", () => {
    it("returns valid targets for INTAKE", () => {
      const targets = getValidTransitions("INTAKE");
      expect(targets).toContain("DOC_COLLECTING");
      expect(targets).toContain("IN_PROGRESS");
      expect(targets).not.toContain("COMPLETED");
    });

    it("returns valid targets for REVIEW", () => {
      const targets = getValidTransitions("REVIEW");
      expect(targets).toContain("SUBMITTED");
      expect(targets).toContain("IN_PROGRESS");
    });

    it("returns empty array for COMPLETED", () => {
      const targets = getValidTransitions("COMPLETED");
      expect(targets).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/__tests__/project-state-machine.test.ts
```

Expected: FAIL — "Cannot find module '../project-state-machine'"

- [ ] **Step 3: Implement state machine**

Create `apps/web/src/lib/project-state-machine.ts`:

```typescript
import type { ProjectStatus } from "@axle/db";

/**
 * Valid status transitions for AXLE projects.
 *
 * Flow: INTAKE → DOC_COLLECTING → IN_PROGRESS → REVIEW → SUBMITTED → APPROVED/REJECTED → COMPLETED
 *
 * Special rules:
 * - INTAKE can skip to IN_PROGRESS (when docs already available)
 * - REJECTED can go back to IN_PROGRESS (retry)
 * - REVIEW can go back to IN_PROGRESS (revisions needed)
 * - COMPLETED is terminal
 */
export const PROJECT_STATUS_FLOW: Record<ProjectStatus, ProjectStatus[]> = {
  INTAKE: ["DOC_COLLECTING", "IN_PROGRESS"],
  DOC_COLLECTING: ["IN_PROGRESS", "INTAKE"],
  IN_PROGRESS: ["REVIEW", "DOC_COLLECTING"],
  REVIEW: ["SUBMITTED", "IN_PROGRESS"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
};

/**
 * Check if a status transition is valid.
 */
export function canTransition(
  from: ProjectStatus,
  to: ProjectStatus
): boolean {
  return PROJECT_STATUS_FLOW[from]?.includes(to) ?? false;
}

/**
 * Get all valid target statuses from the current status.
 */
export function getValidTransitions(current: ProjectStatus): ProjectStatus[] {
  return PROJECT_STATUS_FLOW[current] ?? [];
}

/**
 * Status display configuration.
 */
export const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  INTAKE: { label: "접수", color: "bg-gray-100", variant: "outline" },
  DOC_COLLECTING: { label: "서류수집", color: "bg-yellow-100", variant: "secondary" },
  IN_PROGRESS: { label: "진행중", color: "bg-blue-100", variant: "default" },
  REVIEW: { label: "검토", color: "bg-purple-100", variant: "secondary" },
  SUBMITTED: { label: "제출", color: "bg-indigo-100", variant: "default" },
  APPROVED: { label: "승인", color: "bg-green-100", variant: "default" },
  REJECTED: { label: "반려", color: "bg-red-100", variant: "destructive" },
  COMPLETED: { label: "완료", color: "bg-green-200", variant: "default" },
};

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처인증",
  SOBOOJANG_CERT: "소부장인증",
  RESEARCH_INSTITUTE: "기업부설연구소",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무분석",
  RESEARCH_TASK: "연구과제",
  BUNDLE: "번들",
};

/**
 * Bundle sub-project types that are auto-created.
 */
export const BUNDLE_CHILD_TYPES = [
  "VENTURE_CERT",
  "RESEARCH_INSTITUTE",
  "PATENT",
] as const;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/lib/__tests__/project-state-machine.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/project-state-machine.ts apps/web/src/lib/__tests__/
git commit -m "feat: add project status state machine with transition rules and display config"
```

---

## Task 2: Project Validation Schemas

**Files:**
- Create: `apps/web/src/lib/validations/project.ts`

- [ ] **Step 1: Create project validation schema**

Create `apps/web/src/lib/validations/project.ts`:

```typescript
import { z } from "zod";

export const projectCreateSchema = z.object({
  clientId: z.string().min(1, "고객사를 선택해주세요"),
  programId: z.string().optional(),
  parentId: z.string().optional(),
  type: z.enum([
    "BUSINESS_PLAN",
    "VENTURE_CERT",
    "SOBOOJANG_CERT",
    "RESEARCH_INSTITUTE",
    "PATENT",
    "FINANCIAL_ANALYSIS",
    "RESEARCH_TASK",
    "BUNDLE",
  ]),
  title: z.string().min(1, "프로젝트명을 입력해주세요"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedTo: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  memo: z.string().optional(),
  metadata: z.any().optional(),

  // Fee
  feeType: z.enum(["FIXED", "SUCCESS_RATE", "MONTHLY"]).optional(),
  feeAmount: z.coerce.number().positive().optional(),
  successRate: z.coerce.number().min(0).max(100).optional(),
});

export const projectUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  submissionDate: z.coerce.date().optional().nullable(),
  memo: z.string().optional(),
  metadata: z.any().optional(),
  feeType: z.enum(["FIXED", "SUCCESS_RATE", "MONTHLY"]).optional().nullable(),
  feeAmount: z.coerce.number().positive().optional().nullable(),
  successRate: z.coerce.number().min(0).max(100).optional().nullable(),
  isPaid: z.boolean().optional(),
});

export const projectSearchSchema = z.object({
  clientId: z.string().optional(),
  type: z.enum([
    "BUSINESS_PLAN", "VENTURE_CERT", "SOBOOJANG_CERT", "RESEARCH_INSTITUTE",
    "PATENT", "FINANCIAL_ANALYSIS", "RESEARCH_TASK", "BUNDLE",
  ]).optional(),
  status: z.enum([
    "INTAKE", "DOC_COLLECTING", "IN_PROGRESS", "REVIEW",
    "SUBMITTED", "APPROVED", "REJECTED", "COMPLETED",
  ]).optional(),
  assignedTo: z.string().optional(),
  q: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "dueDate", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const statusTransitionSchema = z.object({
  status: z.enum([
    "INTAKE", "DOC_COLLECTING", "IN_PROGRESS", "REVIEW",
    "SUBMITTED", "APPROVED", "REJECTED", "COMPLETED",
  ]),
});

export const projectMemberSchema = z.object({
  userId: z.string().min(1, "사용자를 선택해주세요"),
  role: z.enum(["LEAD", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type ProjectSearchInput = z.infer<typeof projectSearchSchema>;
export type ProjectMemberInput = z.infer<typeof projectMemberSchema>;
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validations/project.ts
git commit -m "feat: add Zod validation schemas for Project, status transition, and member"
```

---

## Task 3: Project API Routes

**Files:**
- Create: `apps/web/src/app/api/projects/route.ts`
- Create: `apps/web/src/app/api/projects/[projectId]/route.ts`
- Create: `apps/web/src/app/api/projects/[projectId]/status/route.ts`

- [ ] **Step 1: Write failing test for project create with checklist auto-generation**

Create `apps/web/src/app/api/projects/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockProjectCreate = vi.fn();
const mockProjectFindMany = vi.fn();
const mockProjectCount = vi.fn();
const mockTemplatesFindMany = vi.fn();
const mockChecklistCreateMany = vi.fn();
const mockClientFindFirst = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    project: {
      create: mockProjectCreate,
      findMany: mockProjectFindMany,
      count: mockProjectCount,
    },
    checklistTemplate: { findMany: mockTemplatesFindMany },
    checklistItem: { createMany: mockChecklistCreateMany },
    client: { findFirst: mockClientFindFirst },
  },
}));

vi.mock("@axle/auth/dal", () => ({
  getVerifiedOrgMember: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    member: { orgId: "org-1", role: "MEMBER" },
    org: { id: "org-1" },
  }),
}));

import { POST } from "../route";

describe("POST /api/projects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a project and auto-generates checklist items from templates", async () => {
    mockClientFindFirst.mockResolvedValue({ id: "c1", orgId: "org-1" });
    mockProjectCreate.mockResolvedValue({
      id: "p-new",
      title: "사업계획서 - 테스트",
      type: "BUSINESS_PLAN",
      status: "INTAKE",
    });
    mockTemplatesFindMany.mockResolvedValue([
      { id: "t1", name: "사업자등록증", isRequired: true },
      { id: "t2", name: "재무제표", isRequired: true },
      { id: "t3", name: "연구원 명부", isRequired: false },
    ]);
    mockChecklistCreateMany.mockResolvedValue({ count: 3 });

    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "c1",
        type: "BUSINESS_PLAN",
        title: "사업계획서 - 테스트",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("p-new");
    expect(mockChecklistCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: "사업자등록증", isRequired: true }),
        expect.objectContaining({ name: "재무제표", isRequired: true }),
      ]),
    });
  });

  it("returns 400 for missing title", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "c1", type: "BUSINESS_PLAN" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/projects/__tests__/route.test.ts
```

Expected: FAIL — "Cannot find module '../route'"

- [ ] **Step 3: Implement project list and create API**

Create `apps/web/src/app/api/projects/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { projectCreateSchema, projectSearchSchema } from "@/lib/validations/project";
import { BUNDLE_CHILD_TYPES } from "@/lib/project-state-machine";

export async function GET(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");
    const { searchParams } = new URL(req.url);
    const parsed = projectSearchSchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientId, type, status, assignedTo, q, sortBy, sortOrder, page, limit } = parsed.data;

    const where = {
      client: { orgId: member.orgId },
      parentId: null, // Only top-level projects (exclude bundle children in list)
      ...(clientId ? { clientId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(assignedTo ? { assignedTo } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { client: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: { select: { id: true, name: true } },
          _count: {
            select: { checklist: true, documents: true, members: true, children: true },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { member } = await getVerifiedOrgMember("");

    const body = await req.json();
    const parsed = projectCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify client
    const client = await prisma.client.findFirst({
      where: { id: parsed.data.clientId, orgId: member.orgId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { feeAmount, successRate, ...rest } = parsed.data;

    // Create project
    const project = await prisma.project.create({
      data: {
        ...rest,
        ...(feeAmount !== undefined ? { feeAmount } : {}),
        ...(successRate !== undefined ? { successRate } : {}),
      },
    });

    // Auto-generate checklist items from templates
    const templates = await prisma.checklistTemplate.findMany({
      where: { orgId: member.orgId, projectType: parsed.data.type },
      orderBy: { sortOrder: "asc" },
    });

    if (templates.length > 0) {
      await prisma.checklistItem.createMany({
        data: templates.map((t) => ({
          projectId: project.id,
          name: t.name,
          description: t.description,
          isRequired: t.isRequired,
        })),
      });
    }

    // If BUNDLE type, auto-create child projects
    if (parsed.data.type === "BUNDLE") {
      for (const childType of BUNDLE_CHILD_TYPES) {
        const childProject = await prisma.project.create({
          data: {
            clientId: parsed.data.clientId,
            parentId: project.id,
            type: childType,
            title: `${parsed.data.title} — ${childType}`,
            priority: parsed.data.priority,
            assignedTo: parsed.data.assignedTo,
          },
        });

        // Auto-generate checklist for child too
        const childTemplates = await prisma.checklistTemplate.findMany({
          where: { orgId: member.orgId, projectType: childType },
          orderBy: { sortOrder: "asc" },
        });

        if (childTemplates.length > 0) {
          await prisma.checklistItem.createMany({
            data: childTemplates.map((t) => ({
              projectId: childProject.id,
              name: t.name,
              description: t.description,
              isRequired: t.isRequired,
            })),
          });
        }
      }
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement project detail, update, delete**

Create `apps/web/src/app/api/projects/[projectId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { projectUpdateSchema } from "@/lib/validations/project";

type Params = { projectId: string };

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
      include: {
        client: { select: { id: true, name: true, businessNumber: true } },
        program: { select: { id: true, name: true, agency: true } },
        parent: { select: { id: true, title: true, type: true } },
        children: {
          select: { id: true, title: true, type: true, status: true },
          orderBy: { createdAt: "asc" },
        },
        members: {
          include: {
            project: false,
          },
        },
        checklist: {
          orderBy: [{ isRequired: "desc" }, { createdAt: "asc" }],
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { client: { select: { name: true } } },
        },
        meetings: {
          orderBy: { date: "desc" },
          take: 10,
          select: { id: true, title: true, date: true, location: true },
        },
        aiJobs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, type: true, tier: true, status: true, createdAt: true },
        },
        _count: {
          select: {
            checklist: true,
            documents: true,
            meetings: true,
            aiJobs: true,
            children: true,
            members: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("GET project error:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const existing = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = projectUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: parsed.data,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("PATCH project error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const existing = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
      include: { _count: { select: { children: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete children first (for BUNDLE projects)
    if (existing._count.children > 0) {
      await prisma.project.deleteMany({ where: { parentId: projectId } });
    }

    await prisma.project.delete({ where: { id: projectId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE project error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Implement status transition API**

Create `apps/web/src/app/api/projects/[projectId]/status/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { statusTransitionSchema } from "@/lib/validations/project";
import { canTransition, getValidTransitions } from "@/lib/project-state-machine";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = statusTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const newStatus = parsed.data.status;

    if (!canTransition(project.status, newStatus)) {
      const valid = getValidTransitions(project.status);
      return NextResponse.json(
        {
          error: `'${project.status}'에서 '${newStatus}'로 전환할 수 없습니다`,
          validTransitions: valid,
        },
        { status: 422 }
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: newStatus,
        ...(newStatus === "SUBMITTED" ? { submissionDate: new Date() } : {}),
      },
    });

    // If BUNDLE parent and status is COMPLETED, check if all children are completed
    if (project.parentId) {
      const parent = await prisma.project.findUnique({
        where: { id: project.parentId },
        include: { children: { select: { status: true } } },
      });

      if (parent && parent.type === "BUNDLE") {
        const allChildrenCompleted = parent.children.every(
          (c) => c.status === "COMPLETED"
        );
        if (allChildrenCompleted) {
          await prisma.project.update({
            where: { id: parent.id },
            data: { status: "COMPLETED" },
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH project status error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx vitest run src/app/api/projects/__tests__/route.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/projects/
git commit -m "feat: add Project API routes (CRUD, status state machine, bundle auto-create, checklist auto-gen)"
```

---

## Task 4: Project Member and Checklist API Routes

**Files:**
- Create: `apps/web/src/app/api/projects/[projectId]/members/route.ts`
- Create: `apps/web/src/app/api/projects/[projectId]/members/[memberId]/route.ts`
- Create: `apps/web/src/app/api/projects/[projectId]/checklist/route.ts`
- Create: `apps/web/src/app/api/projects/[projectId]/checklist/[itemId]/route.ts`

- [ ] **Step 1: Implement project member API**

Create `apps/web/src/app/api/projects/[projectId]/members/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { projectMemberSchema } from "@/lib/validations/project";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { role: "asc" },
    });

    // Fetch user details for each member
    const userIds = members.map((m) => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = members.map((m) => ({
      ...m,
      user: userMap.get(m.userId) ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET project members error:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = projectMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check if already a member
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: parsed.data.userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "이미 멤버로 등록되어 있습니다" }, { status: 409 });
    }

    const projectMember = await prisma.projectMember.create({
      data: {
        projectId,
        userId: parsed.data.userId,
        role: parsed.data.role,
      },
    });

    return NextResponse.json(projectMember, { status: 201 });
  } catch (error) {
    console.error("POST project members error:", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
```

Create `apps/web/src/app/api/projects/[projectId]/members/[memberId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";

type Params = { projectId: string; memberId: string };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectId, memberId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const role = body.role;
    if (!["LEAD", "MEMBER", "VIEWER"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH project member error:", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectId, memberId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.projectMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE project member error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement checklist item API**

Create `apps/web/src/app/api/projects/[projectId]/checklist/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const items = await prisma.checklistItem.findMany({
      where: { projectId },
      orderBy: [{ isRequired: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET checklist error:", error);
    return NextResponse.json({ error: "Failed to fetch checklist" }, { status: 500 });
  }
}
```

Create `apps/web/src/app/api/projects/[projectId]/checklist/[itemId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { checklistItemUpdateSchema } from "@/lib/validations/checklist";

type Params = { projectId: string; itemId: string };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectId, itemId } = await params;
    const { member } = await getVerifiedOrgMember("");

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: member.orgId } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = checklistItemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: parsed.data,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PATCH checklist item error:", error);
    return NextResponse.json({ error: "Failed to update checklist item" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/projects/
git commit -m "feat: add ProjectMember and ChecklistItem API routes"
```

---

## Task 5: Server Actions for Projects

**Files:**
- Create: `apps/web/src/lib/actions/project-actions.ts`

- [ ] **Step 1: Create project server actions**

Create `apps/web/src/lib/actions/project-actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/validations/project";
import { canTransition } from "@/lib/project-state-machine";

export async function createProject(formData: FormData) {
  const { member } = await getVerifiedOrgMember("");

  const raw = Object.fromEntries(formData.entries());
  const parsed = projectCreateSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, orgId: member.orgId },
  });
  if (!client) {
    return { error: { _form: ["고객사를 찾을 수 없습니다"] } };
  }

  const project = await prisma.project.create({
    data: parsed.data,
  });

  // Auto-generate checklist
  const templates = await prisma.checklistTemplate.findMany({
    where: { orgId: member.orgId, projectType: parsed.data.type },
    orderBy: { sortOrder: "asc" },
  });

  if (templates.length > 0) {
    await prisma.checklistItem.createMany({
      data: templates.map((t) => ({
        projectId: project.id,
        name: t.name,
        description: t.description,
        isRequired: t.isRequired,
      })),
    });
  }

  revalidatePath("/projects");
  return { data: project };
}

export async function updateProject(projectId: string, formData: FormData) {
  const { member } = await getVerifiedOrgMember("");

  const existing = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId: member.orgId } },
  });
  if (!existing) {
    return { error: { _form: ["프로젝트를 찾을 수 없습니다"] } };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = projectUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: parsed.data,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { data: project };
}

export async function transitionProjectStatus(
  projectId: string,
  newStatus: string
) {
  const { member } = await getVerifiedOrgMember("");

  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId: member.orgId } },
  });
  if (!project) {
    return { error: "프로젝트를 찾을 수 없습니다" };
  }

  if (!canTransition(project.status, newStatus as any)) {
    return { error: `'${project.status}'에서 '${newStatus}'로 전환할 수 없습니다` };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: newStatus as any,
      ...(newStatus === "SUBMITTED" ? { submissionDate: new Date() } : {}),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true };
}

export async function deleteProject(projectId: string) {
  const { member } = await getVerifiedOrgMember("");

  const existing = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId: member.orgId } },
    include: { _count: { select: { children: true } } },
  });
  if (!existing) {
    return { error: "프로젝트를 찾을 수 없습니다" };
  }

  if (existing._count.children > 0) {
    await prisma.project.deleteMany({ where: { parentId: projectId } });
  }

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/actions/project-actions.ts
git commit -m "feat: add server actions for Project CRUD and status transitions"
```

---

## Task 6: Project UI Components

**Files:**
- Create: `apps/web/src/components/projects/project-status-badge.tsx`
- Create: `apps/web/src/components/projects/project-type-badge.tsx`
- Create: `apps/web/src/components/projects/project-fee-info.tsx`
- Create: `apps/web/src/components/projects/bundle-tree.tsx`
- Create: `apps/web/src/components/projects/project-table.tsx`
- Create: `apps/web/src/components/projects/project-kanban.tsx`
- Create: `apps/web/src/components/projects/project-list-view.tsx`

- [ ] **Step 1: Create project status and type badges**

Create `apps/web/src/components/projects/project-status-badge.tsx`:

```tsx
import { Badge } from "@axle/ui/badge";
import type { ProjectStatus } from "@axle/db";
import { STATUS_CONFIG } from "@/lib/project-state-machine";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

Create `apps/web/src/components/projects/project-type-badge.tsx`:

```tsx
import { Badge } from "@axle/ui/badge";
import { PROJECT_TYPE_LABELS } from "@/lib/project-state-machine";

export function ProjectTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline">
      {PROJECT_TYPE_LABELS[type] || type}
    </Badge>
  );
}
```

- [ ] **Step 2: Create fee info and bundle tree components**

Create `apps/web/src/components/projects/project-fee-info.tsx`:

```tsx
import { Card, CardContent } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";

interface ProjectFeeInfoProps {
  feeType: string | null;
  feeAmount: any;
  successRate: any;
  isPaid: boolean;
}

const feeTypeLabels: Record<string, string> = {
  FIXED: "정액",
  SUCCESS_RATE: "성공보수",
  MONTHLY: "월정액",
};

export function ProjectFeeInfo({ feeType, feeAmount, successRate, isPaid }: ProjectFeeInfoProps) {
  if (!feeType) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h4 className="font-semibold text-sm">수수료 정보</h4>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">유형:</span>
          <span>{feeTypeLabels[feeType] || feeType}</span>
        </div>
        {feeAmount && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">금액:</span>
            <span className="font-medium">
              {Number(feeAmount).toLocaleString("ko-KR")}원
            </span>
          </div>
        )}
        {feeType === "SUCCESS_RATE" && successRate && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">성공보수율:</span>
            <span>{Number(successRate)}%</span>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">정산:</span>
          <Badge variant={isPaid ? "default" : "outline"}>
            {isPaid ? "정산 완료" : "미정산"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
```

Create `apps/web/src/components/projects/bundle-tree.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent } from "@axle/ui/card";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectTypeBadge } from "./project-type-badge";
import type { ProjectStatus } from "@axle/db";

interface BundleChild {
  id: string;
  title: string;
  type: string;
  status: ProjectStatus;
}

interface BundleTreeProps {
  parentTitle: string;
  children: BundleChild[];
}

export function BundleTree({ parentTitle, children }: BundleTreeProps) {
  if (children.length === 0) return null;

  const allCompleted = children.every((c) => c.status === "COMPLETED");

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">번들 하위 프로젝트</h4>
          <span className="text-xs text-muted-foreground">
            {children.filter((c) => c.status === "COMPLETED").length}/{children.length} 완료
            {allCompleted && " — 전체 완료"}
          </span>
        </div>
        <div className="space-y-2">
          {children.map((child) => (
            <Link key={child.id} href={`/projects/${child.id}`}>
              <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <ProjectTypeBadge type={child.type} />
                  <span className="text-sm font-medium">{child.title}</span>
                </div>
                <ProjectStatusBadge status={child.status} />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create project table component**

Create `apps/web/src/components/projects/project-table.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Project } from "@axle/db";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectTypeBadge } from "./project-type-badge";
import { Badge } from "@axle/ui/badge";

type ProjectWithRelations = Project & {
  client: { id: string; name: string };
  _count: { checklist: number; documents: number; members: number; children: number };
};

interface ProjectTableProps {
  projects: ProjectWithRelations[];
}

export function ProjectTable({ projects }: ProjectTableProps) {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">프로젝트명</th>
            <th className="px-4 py-3 text-left font-medium">고객사</th>
            <th className="px-4 py-3 text-left font-medium">유형</th>
            <th className="px-4 py-3 text-left font-medium">상태</th>
            <th className="px-4 py-3 text-left font-medium">마감일</th>
            <th className="px-4 py-3 text-right font-medium">체크리스트</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {project.title}
                </Link>
                {project._count.children > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {project._count.children}개 하위
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{project.client.name}</td>
              <td className="px-4 py-3">
                <ProjectTypeBadge type={project.type} />
              </td>
              <td className="px-4 py-3">
                <ProjectStatusBadge status={project.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {project.dueDate
                  ? new Date(project.dueDate).toLocaleDateString("ko-KR")
                  : "-"}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {project._count.checklist > 0
                  ? `${project._count.checklist}항목`
                  : "-"}
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                등록된 프로젝트가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create project kanban component**

Create `apps/web/src/components/projects/project-kanban.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import { ProjectTypeBadge } from "./project-type-badge";
import type { Project, ProjectStatus } from "@axle/db";
import { STATUS_CONFIG } from "@/lib/project-state-machine";

type ProjectWithRelations = Project & {
  client: { id: string; name: string };
  _count: { checklist: number; documents: number; members: number; children: number };
};

interface ProjectKanbanProps {
  projects: ProjectWithRelations[];
}

const KANBAN_COLUMNS: ProjectStatus[] = [
  "INTAKE",
  "DOC_COLLECTING",
  "IN_PROGRESS",
  "REVIEW",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
];

export function ProjectKanban({ projects }: ProjectKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const config = STATUS_CONFIG[status];
        const filtered = projects.filter((p) => p.status === status);

        return (
          <div key={status} className="min-w-[280px] space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{config.label}</h3>
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
            <div className="space-y-2">
              {filtered.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm leading-tight">
                        {project.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {project.client.name}
                        </span>
                        <ProjectTypeBadge type={project.type} />
                      </div>
                      {project.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          마감: {new Date(project.dueDate).toLocaleDateString("ko-KR")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create project list view wrapper**

Create `apps/web/src/components/projects/project-list-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@axle/ui/button";
import { ProjectTable } from "./project-table";
import { ProjectKanban } from "./project-kanban";

interface ProjectListViewProps {
  projects: any[];
  total: number;
  page: number;
  limit: number;
  defaultView: "table" | "kanban";
}

export function ProjectListView({ projects, total, page, limit, defaultView }: ProjectListViewProps) {
  const [view, setView] = useState<"table" | "kanban">(defaultView);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex rounded-md border">
          <Button
            variant={view === "table" ? "default" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setView("table")}
          >
            테이블
          </Button>
          <Button
            variant={view === "kanban" ? "default" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setView("kanban")}
          >
            파이프라인
          </Button>
        </div>
      </div>
      {view === "table" ? (
        <ProjectTable projects={projects} />
      ) : (
        <ProjectKanban projects={projects} />
      )}
      {view === "table" && total > limit && (
        <div className="flex justify-center text-sm text-muted-foreground">
          {total}건 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/projects/
git commit -m "feat: add project UI components (table, kanban, status/type badges, bundle tree, fee info)"
```

---

## Task 7: Project Pages

**Files:**
- Create: `apps/web/src/app/(app)/projects/page.tsx`
- Create: `apps/web/src/app/(app)/projects/new/page.tsx`
- Create: `apps/web/src/components/projects/project-form.tsx`
- Create: `apps/web/src/app/(app)/projects/[projectId]/page.tsx`
- Create: `apps/web/src/components/projects/project-overview-tab.tsx`
- Create: `apps/web/src/components/projects/project-checklist-tab.tsx`

- [ ] **Step 1: Create project list page**

Create `apps/web/src/app/(app)/projects/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { ProjectListView } from "@/components/projects/project-list-view";

interface ProjectsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    view?: string;
    page?: string;
  }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const { member } = await getVerifiedOrgMember("");

  const page = Number(params.page) || 1;
  const limit = 20;

  const where = {
    client: { orgId: member.orgId },
    parentId: null,
    ...(params.status ? { status: params.status as any } : {}),
    ...(params.type ? { type: params.type as any } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            { client: { name: { contains: params.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { id: true, name: true } },
        _count: {
          select: { checklist: true, documents: true, members: true, children: true },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">프로젝트 관리</h1>
        <Link href="/projects/new">
          <Button>프로젝트 추가</Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <form className="flex-1">
          <Input name="q" placeholder="프로젝트명, 고객사 검색..." defaultValue={params.q} />
        </form>
      </div>

      <ProjectListView
        projects={projects}
        total={total}
        page={page}
        limit={limit}
        defaultView={(params.view as "table" | "kanban") || "table"}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create project form**

Create `apps/web/src/components/projects/project-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import type { Client, Project } from "@axle/db";
import { PROJECT_TYPE_LABELS } from "@/lib/project-state-machine";

interface ProjectFormProps {
  clients: Pick<Client, "id" | "name">[];
  project?: Project;
  action: (formData: FormData) => Promise<{ data?: any; error?: any }>;
  defaultClientId?: string;
}

export function ProjectForm({ clients, project, action, defaultClientId }: ProjectFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(formData: FormData) {
    setErrors({});
    const result = await action(formData);
    if (result.error) {
      setErrors(result.error);
    } else {
      router.push(`/projects/${result.data.id}`);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">프로젝트 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">고객사 *</Label>
              <select
                id="clientId"
                name="clientId"
                defaultValue={project?.clientId ?? defaultClientId ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">선택...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.clientId && <p className="text-sm text-destructive">{errors.clientId[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">프로젝트 유형 *</Label>
              <select
                id="type"
                name="type"
                defaultValue={project?.type ?? "BUSINESS_PLAN"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">프로젝트명 *</Label>
              <Input id="title" name="title" defaultValue={project?.title ?? ""} required />
              {errors.title && <p className="text-sm text-destructive">{errors.title[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">우선순위</Label>
              <select
                id="priority"
                name="priority"
                defaultValue={project?.priority ?? "MEDIUM"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="LOW">낮음</option>
                <option value="MEDIUM">보통</option>
                <option value="HIGH">높음</option>
                <option value="URGENT">긴급</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">마감일</Label>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={project?.dueDate?.toISOString().split("T")[0] ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo">메모</Label>
              <textarea
                id="memo"
                name="memo"
                rows={3}
                defaultValue={project?.memo ?? ""}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">수수료 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feeType">수수료 유형</Label>
              <select
                id="feeType"
                name="feeType"
                defaultValue={project?.feeType ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">선택안함</option>
                <option value="FIXED">정액</option>
                <option value="SUCCESS_RATE">성공보수</option>
                <option value="MONTHLY">월정액</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feeAmount">수수료 금액 (원)</Label>
              <Input
                id="feeAmount"
                name="feeAmount"
                type="number"
                defaultValue={project?.feeAmount?.toString() ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="successRate">성공보수율 (%)</Label>
              <Input
                id="successRate"
                name="successRate"
                type="number"
                min="0"
                max="100"
                defaultValue={project?.successRate?.toString() ?? ""}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit">
          {project ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create project create page**

Create `apps/web/src/app/(app)/projects/new/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { ProjectForm } from "@/components/projects/project-form";
import { createProject } from "@/lib/actions/project-actions";

interface NewProjectPageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const params = await searchParams;
  const { member } = await getVerifiedOrgMember("");

  const clients = await prisma.client.findMany({
    where: { orgId: member.orgId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">새 프로젝트</h1>
      <ProjectForm
        clients={clients}
        action={createProject}
        defaultClientId={params.clientId}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create project overview and checklist tabs**

Create `apps/web/src/components/projects/project-overview-tab.tsx`:

```tsx
import { Card, CardContent } from "@axle/ui/card";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectTypeBadge } from "./project-type-badge";
import { ProjectFeeInfo } from "./project-fee-info";
import { BundleTree } from "./bundle-tree";
import type { Project } from "@axle/db";

interface ProjectOverviewTabProps {
  project: Project & {
    client: { id: string; name: string; businessNumber: string | null };
    program: { id: string; name: string; agency: string | null } | null;
    parent: { id: string; title: string; type: string } | null;
    children: Array<{ id: string; title: string; type: string; status: any }>;
  };
}

export function ProjectOverviewTab({ project }: ProjectOverviewTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">프로젝트 정보</h3>
          <InfoRow label="유형" value={<ProjectTypeBadge type={project.type} />} />
          <InfoRow label="상태" value={<ProjectStatusBadge status={project.status} />} />
          <InfoRow label="우선순위" value={project.priority} />
          <InfoRow
            label="마감일"
            value={project.dueDate?.toLocaleDateString("ko-KR")}
          />
          <InfoRow
            label="제출일"
            value={project.submissionDate?.toLocaleDateString("ko-KR")}
          />
          {project.parent && (
            <InfoRow label="상위 프로젝트" value={project.parent.title} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">고객사 / 사업</h3>
          <InfoRow label="고객사" value={project.client.name} />
          <InfoRow label="사업자번호" value={project.client.businessNumber} />
          {project.program && (
            <>
              <InfoRow label="지원사업" value={project.program.name} />
              <InfoRow label="주관기관" value={project.program.agency} />
            </>
          )}
        </CardContent>
      </Card>

      <ProjectFeeInfo
        feeType={project.feeType}
        feeAmount={project.feeAmount}
        successRate={project.successRate}
        isPaid={project.isPaid}
      />

      {project.children.length > 0 && (
        <BundleTree parentTitle={project.title} children={project.children} />
      )}

      {project.memo && (
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">메모</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.memo}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | React.ReactNode | null }) {
  return (
    <div className="flex">
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  );
}
```

Create `apps/web/src/components/projects/project-checklist-tab.tsx`:

```tsx
"use client";

import { Badge } from "@axle/ui/badge";
import { Button } from "@axle/ui/button";
import type { ChecklistItem, DocStatus } from "@axle/db";

const statusConfig: Record<DocStatus, { label: string; color: string }> = {
  PENDING: { label: "대기", color: "text-muted-foreground" },
  REQUESTED: { label: "요청됨", color: "text-yellow-600" },
  UPLOADED: { label: "업로드됨", color: "text-blue-600" },
  VERIFIED: { label: "확인완료", color: "text-green-600" },
};

interface ProjectChecklistTabProps {
  items: ChecklistItem[];
  projectId: string;
}

export function ProjectChecklistTab({ items, projectId }: ProjectChecklistTabProps) {
  const completed = items.filter((i) => i.status === "VERIFIED" || i.status === "UPLOADED").length;
  const required = items.filter((i) => i.isRequired).length;

  async function updateStatus(itemId: string, status: DocStatus) {
    await fetch(`/api/projects/${projectId}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...(status === "REQUESTED" ? { requestedAt: new Date().toISOString() } : {}),
        ...(status === "UPLOADED" ? { uploadedAt: new Date().toISOString() } : {}),
      }),
    });
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            진행: {completed}/{items.length} ({required}개 필수)
          </span>
        </div>
        <div className="h-2 flex-1 max-w-xs rounded-full bg-muted mx-4">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: items.length > 0 ? `${(completed / items.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${
                item.status === "VERIFIED" ? "bg-green-500" :
                item.status === "UPLOADED" ? "bg-blue-500" :
                item.status === "REQUESTED" ? "bg-yellow-500" :
                "bg-gray-300"
              }`} />
              <div>
                <span className="text-sm font-medium">{item.name}</span>
                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
              </div>
              {item.isRequired && <Badge variant="destructive">필수</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${statusConfig[item.status].color}`}>
                {statusConfig[item.status].label}
              </span>
              {item.status === "PENDING" && (
                <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "REQUESTED")}>
                  요청
                </Button>
              )}
              {item.status === "UPLOADED" && (
                <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "VERIFIED")}>
                  확인
                </Button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            체크리스트 항목이 없습니다
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create project detail page**

Create `apps/web/src/app/(app)/projects/[projectId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { Button } from "@axle/ui/button";
import { ClientDetailTabs } from "@/components/clients/client-detail-tabs";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectTypeBadge } from "@/components/projects/project-type-badge";
import { ProjectOverviewTab } from "@/components/projects/project-overview-tab";
import { ProjectChecklistTab } from "@/components/projects/project-checklist-tab";
import { getValidTransitions, STATUS_CONFIG } from "@/lib/project-state-machine";
import { transitionProjectStatus } from "@/lib/actions/project-actions";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const { member } = await getVerifiedOrgMember("");

  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId: member.orgId } },
    include: {
      client: { select: { id: true, name: true, businessNumber: true } },
      program: { select: { id: true, name: true, agency: true } },
      parent: { select: { id: true, title: true, type: true } },
      children: {
        select: { id: true, title: true, type: true, status: true },
        orderBy: { createdAt: "asc" },
      },
      members: true,
      checklist: { orderBy: [{ isRequired: "desc" }, { createdAt: "asc" }] },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, fileType: true, category: true, createdAt: true },
      },
      meetings: {
        orderBy: { date: "desc" },
        take: 10,
        select: { id: true, title: true, date: true },
      },
      aiJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, type: true, status: true, createdAt: true },
      },
      _count: {
        select: {
          checklist: true, documents: true, meetings: true,
          aiJobs: true, children: true, members: true,
        },
      },
    },
  });

  if (!project) notFound();

  const validTransitions = getValidTransitions(project.status);

  const tabs = [
    { id: "overview", label: "개요" },
    { id: "checklist", label: "체크리스트", count: project._count.checklist },
    { id: "documents", label: "서류", count: project._count.documents },
    { id: "meetings", label: "미팅", count: project._count.meetings },
    { id: "ai", label: "AI 작업", count: project._count.aiJobs },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <ProjectTypeBadge type={project.type} />
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="flex gap-2">
          {validTransitions.map((status) => (
            <form
              key={status}
              action={async () => {
                "use server";
                await transitionProjectStatus(projectId, status);
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                {STATUS_CONFIG[status].label}로 전환
              </Button>
            </form>
          ))}
          <Link href={`/projects/${projectId}/edit`}>
            <Button variant="outline">수정</Button>
          </Link>
        </div>
      </div>

      <ClientDetailTabs tabs={tabs}>
        {{
          overview: <ProjectOverviewTab project={project} />,
          checklist: <ProjectChecklistTab items={project.checklist} projectId={projectId} />,
          documents: (
            <div>
              {project.documents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">등록된 서류가 없습니다</p>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">파일명</th>
                        <th className="px-4 py-3 text-left font-medium">유형</th>
                        <th className="px-4 py-3 text-left font-medium">분류</th>
                        <th className="px-4 py-3 text-left font-medium">등록일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.documents.map((d) => (
                        <tr key={d.id} className="border-b">
                          <td className="px-4 py-3 font-medium">{d.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{d.fileType}</td>
                          <td className="px-4 py-3">{d.category}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(d.createdAt).toLocaleDateString("ko-KR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ),
          meetings: (
            <p className="text-center text-muted-foreground py-8">
              미팅 기능은 추후 구현됩니다
            </p>
          ),
          ai: (
            <p className="text-center text-muted-foreground py-8">
              AI 작업 기능은 추후 구현됩니다
            </p>
          ),
        }}
      </ClientDetailTabs>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/projects/ apps/web/src/components/projects/
git commit -m "feat: add project list, create, detail pages with checklist, kanban, and status transitions"
```

---

## Task 8: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test
```

Expected: All tests pass — packages/db (6), packages/ocr (5), packages/storage (4), apps/web (state machine 9 + API tests).

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Verify dev server**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected: Dev server starts. Navigate to `/projects` — list page renders with table/kanban toggle. `/projects/new` — form renders with client selector and project type. Project detail page shows tabs with status transition buttons.

- [ ] **Step 4: Verify state machine transitions**

Manually test in browser:
1. Create a project (status = INTAKE)
2. Transition to DOC_COLLECTING (valid)
3. Transition to IN_PROGRESS (valid)
4. Try to skip to COMPLETED (should be blocked)
5. Transition REVIEW → SUBMITTED → APPROVED → COMPLETED (full flow)

- [ ] **Step 5: Verify BUNDLE auto-creation**

Create a BUNDLE project — verify 3 child projects (VENTURE_CERT, RESEARCH_INSTITUTE, PATENT) are auto-created with their own checklist items.

- [ ] **Step 6: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 3 complete — Project workflow with state machine, bundles, members, checklists, kanban"
```

---

## Summary

Phase 3 delivers:
- **Project CRUD**: Create, read, update, delete with 8 project types and Zod validation
- **Status state machine**: INTAKE through COMPLETED with enforced valid transitions
- **BUNDLE projects**: Auto-create child projects (VENTURE_CERT, RESEARCH_INSTITUTE, PATENT) with auto-completion when all children complete
- **ProjectMember management**: LEAD/MEMBER/VIEWER roles with add/update/remove
- **ChecklistItem auto-generation**: Templates applied on project creation, status tracking (PENDING/REQUESTED/UPLOADED/VERIFIED)
- **Project detail page**: Tabbed view (overview, checklist, documents, meetings, AI jobs) with status transition buttons
- **Project list**: Table and kanban pipeline views with search/filter by status, type, client
- **Fee tracking**: feeType (FIXED/SUCCESS_RATE/MONTHLY), feeAmount, successRate, isPaid
- **Server actions**: createProject, updateProject, transitionProjectStatus, deleteProject

**Next:** Phase 4 would cover Meeting/Transcription, AI Jobs pipeline, and Notification system.
