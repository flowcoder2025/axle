# Super Admin Console Phase C — Organization Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build organization management — list (search/pagination), detail page with 4 tabs (개요/멤버/플랜·쿼터/관리), inline plan/quota updates, suspension toggle. PLATFORM_ADMIN only.

**Architecture:** Server Components fetch paginated org data. Tabbed detail page aggregates org stats via analytics aggregator + direct Prisma. Plan/quota updates and suspension toggle via Server Actions + API routes with Zod validation.

**Tech Stack:** Next.js 16, Prisma 7, Zod 4, shadcn/ui (Table, Tabs, AlertDialog, DropdownMenu, Input, Select)

**Spec:** `docs/superpowers/specs/2026-04-13-super-admin-console-design.md` §4

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/app/(admin)/platform-admin/organizations/page.tsx` | Organization list page |
| `apps/web/app/(admin)/platform-admin/organizations/[orgId]/page.tsx` | Organization detail with 4 tabs |
| `apps/web/app/(admin)/platform-admin/organizations/orgs-table.tsx` | Client table with search + pagination |
| `apps/web/app/(admin)/platform-admin/organizations/[orgId]/plan-quota-form.tsx` | Client form for plan/quota |
| `apps/web/app/(admin)/platform-admin/organizations/[orgId]/suspend-toggle.tsx` | Client suspend/unsuspend button |
| `apps/web/app/(admin)/platform-admin/organizations/actions.ts` | Server Actions (updatePlanQuota, toggleSuspend) |
| `apps/web/app/api/admin/organizations/route.ts` | GET org list |
| `apps/web/app/api/admin/organizations/[orgId]/route.ts` | GET detail, PATCH plan/quota/suspend |
| `apps/web/lib/admin/org-aggregator.ts` | Org-level stat helpers |

### Modified Files

| File | Change |
|------|--------|
| `packages/ui/src/index.ts` | +Tabs export (if not present) |
| `packages/ui/src/components/tabs.tsx` | New Radix Tabs component (if not present) |

---

## Task 1: Tabs component in @axle/ui (if missing)

**Files:**
- Modify: `packages/ui/package.json` (+@radix-ui/react-tabs)
- Create: `packages/ui/src/components/tabs.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Check if Tabs already exists**

Run: `grep -l "Tabs" /Volumes/포터블/AXLE/packages/ui/src/components/*.tsx 2>/dev/null`

If found, skip to Task 2. If not:

- [ ] **Step 2: Install Radix Tabs**

Run: `cd /Volumes/포터블/AXLE/packages/ui && npm install @radix-ui/react-tabs`

- [ ] **Step 3: Create tabs.tsx**

```typescript
"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/utils.js";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

- [ ] **Step 4: Add to index.ts**

Append to `packages/ui/src/index.ts`:

```typescript
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs.js";
```

- [ ] **Step 5: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 6: Commit**

```bash
git add packages/ui/
git commit -m "WI-chore UI Tabs 컴포넌트 추가 (Radix)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Org aggregator helpers

**Files:**
- Create: `apps/web/lib/admin/org-aggregator.ts`

- [ ] **Step 1: Create org-aggregator.ts**

```typescript
import { prisma } from "@axle/db";

/**
 * Count of projects for an organization, via the Client relation.
 * Organization has no direct Project relation; path is Org -> Client -> Project.
 */
export async function getOrgProjectCount(orgId: string): Promise<number> {
  const result = await prisma.project.count({
    where: { client: { organizationId: orgId } },
  });
  return result;
}

/**
 * Aggregate stats for an organization detail page.
 */
export type OrgStats = {
  memberCount: number;
  projectCount: number;
  clientCount: number;
  last7dEvents: number;
};

export async function getOrgStats(orgId: string): Promise<OrgStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [memberCount, projectCount, clientCount, last7dEvents] = await Promise.all([
    prisma.membership.count({ where: { organizationId: orgId } }),
    prisma.project.count({ where: { client: { organizationId: orgId } } }),
    prisma.client.count({ where: { organizationId: orgId } }),
    prisma.analyticsEvent.count({
      where: { orgId, createdAt: { gte: since } },
    }),
  ]);

  return { memberCount, projectCount, clientCount, last7dEvents };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/admin/org-aggregator.ts
git commit -m "WI-chore Admin 조직 집계 유틸리티

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: GET /api/admin/organizations — list API

**Files:**
- Create: `apps/web/app/api/admin/organizations/route.ts`

- [ ] **Step 1: Create route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, handleZodError, forbiddenResponse } from "@/lib/api-helpers";

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name", "memberCount"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request: NextRequest) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const parsed = QuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) return handleZodError(parsed.error);

    const { search, page, pageSize, sort, order } = parsed.data;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // memberCount sort needs different strategy — use raw query or fetch+sort
    // For simplicity, sort by createdAt/name directly; memberCount sort fetches all then sorts
    const [total, orgs] = await Promise.all([
      prisma.organization.count({ where }),
      sort === "memberCount"
        ? prisma.organization
            .findMany({
              where,
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                plan: true,
                isSuspended: true,
                createdAt: true,
                _count: { select: { memberships: true } },
              },
            })
            .then((rows) =>
              rows
                .sort((a, b) =>
                  order === "asc"
                    ? a._count.memberships - b._count.memberships
                    : b._count.memberships - a._count.memberships,
                )
                .slice((page - 1) * pageSize, page * pageSize),
            )
        : prisma.organization.findMany({
            where,
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              plan: true,
              isSuspended: true,
              createdAt: true,
              _count: { select: { memberships: true } },
            },
            orderBy: { [sort]: order },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
    ]);

    return NextResponse.json({
      data: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        logoUrl: o.logoUrl,
        plan: o.plan,
        isSuspended: o.isSuspended,
        createdAt: o.createdAt.toISOString(),
        memberCount: o._count.memberships,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/organizations/route.ts
git commit -m "WI-chore GET /api/admin/organizations — 조직 목록 API

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: GET/PATCH /api/admin/organizations/[orgId]

**Files:**
- Create: `apps/web/app/api/admin/organizations/[orgId]/route.ts`

- [ ] **Step 1: Create route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  handleZodError,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

const PatchSchema = z
  .object({
    plan: z.enum(["free", "pro", "enterprise"]).optional(),
    quotaAiJobs: z.number().int().min(0).optional(),
    quotaMembers: z.number().int().min(1).optional(),
    isSuspended: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { orgId } = await params;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        plan: true,
        quotaAiJobs: true,
        quotaMembers: true,
        isSuspended: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!org) return notFoundResponse("Organization");

    return NextResponse.json({
      data: {
        ...org,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
        memberships: org.memberships.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { orgId } = await params;
    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!existing) return notFoundResponse("Organization");

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: parsed.data,
      select: {
        id: true,
        plan: true,
        quotaAiJobs: true,
        quotaMembers: true,
        isSuspended: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/api/admin/organizations/[orgId]/"
git commit -m "WI-chore GET/PATCH /api/admin/organizations/[orgId] — 상세 + 플랜/쿼터/정지 변경

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Server Actions

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/organizations/actions.ts`

- [ ] **Step 1: Create actions.ts**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePlanQuota(
  orgId: string,
  data: {
    plan?: "free" | "pro" | "enterprise";
    quotaAiJobs?: number;
    quotaMembers?: number;
  },
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  if (data.quotaAiJobs !== undefined && data.quotaAiJobs < 0) {
    return { ok: false, error: "AI 작업 쿼터는 0 이상이어야 합니다" };
  }
  if (data.quotaMembers !== undefined && data.quotaMembers < 1) {
    return { ok: false, error: "멤버 쿼터는 1 이상이어야 합니다" };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data,
  });

  revalidatePath("/platform-admin/organizations");
  revalidatePath(`/platform-admin/organizations/${orgId}`);
  return { ok: true };
}

export async function toggleOrgSuspend(
  orgId: string,
  isSuspended: boolean,
): Promise<ActionResult> {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { isSuspended },
  });

  revalidatePath("/platform-admin/organizations");
  revalidatePath(`/platform-admin/organizations/${orgId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/organizations/actions.ts"
git commit -m "WI-chore 조직 Server Actions — 플랜/쿼터 변경 + 정지/해제

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Plan/Quota form component

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/organizations/[orgId]/plan-quota-form.tsx`

- [ ] **Step 1: Create plan-quota-form.tsx**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label, toast } from "@axle/ui";
import { updatePlanQuota } from "../actions";

type PlanQuotaFormProps = {
  orgId: string;
  plan: string;
  quotaAiJobs: number;
  quotaMembers: number;
};

export function PlanQuotaForm({
  orgId,
  plan,
  quotaAiJobs,
  quotaMembers,
}: PlanQuotaFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formPlan, setFormPlan] = useState(plan);
  const [formAiJobs, setFormAiJobs] = useState(String(quotaAiJobs));
  const [formMembers, setFormMembers] = useState(String(quotaMembers));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const aiJobs = parseInt(formAiJobs, 10);
      const members = parseInt(formMembers, 10);
      if (Number.isNaN(aiJobs) || Number.isNaN(members)) {
        toast.error("숫자를 올바르게 입력해 주세요");
        return;
      }
      const result = await updatePlanQuota(orgId, {
        plan: formPlan as "free" | "pro" | "enterprise",
        quotaAiJobs: aiJobs,
        quotaMembers: members,
      });
      if (result.ok) toast.success("저장되었습니다");
      else toast.error(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="plan">플랜</Label>
        <select
          id="plan"
          value={formPlan}
          onChange={(e) => setFormPlan(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
      <div>
        <Label htmlFor="quotaAiJobs">AI 작업 쿼터 (월간)</Label>
        <Input
          id="quotaAiJobs"
          type="number"
          min={0}
          value={formAiJobs}
          onChange={(e) => setFormAiJobs(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="quotaMembers">멤버 쿼터</Label>
        <Input
          id="quotaMembers"
          type="number"
          min={1}
          value={formMembers}
          onChange={(e) => setFormMembers(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/organizations/[orgId]/plan-quota-form.tsx"
git commit -m "WI-chore 플랜/쿼터 수정 폼 컴포넌트

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Suspend toggle component

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/organizations/[orgId]/suspend-toggle.tsx`

- [ ] **Step 1: Create suspend-toggle.tsx**

```typescript
"use client";

import { useState, useTransition } from "react";
import {
  Button,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  toast,
} from "@axle/ui";
import { toggleOrgSuspend } from "../actions";

type SuspendToggleProps = {
  orgId: string;
  isSuspended: boolean;
};

export function SuspendToggle({ orgId, isSuspended }: SuspendToggleProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await toggleOrgSuspend(orgId, !isSuspended);
      if (result.ok) {
        toast.success(isSuspended ? "해제되었습니다" : "정지되었습니다");
      } else {
        toast.error(result.error);
      }
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        variant={isSuspended ? "outline" : "destructive"}
        onClick={() => setOpen(true)}
      >
        {isSuspended ? "정지 해제" : "조직 정지"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSuspended ? "조직 정지 해제" : "조직 정지"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuspended
                ? "이 조직의 정지를 해제합니다. 모든 멤버가 다시 로그인할 수 있습니다."
                : "이 조직을 정지합니다. 정지 중에는 모든 멤버가 접근할 수 없습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending ? "처리 중..." : "확인"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/organizations/[orgId]/suspend-toggle.tsx"
git commit -m "WI-chore 조직 정지/해제 토글 컴포넌트

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Orgs list table (client)

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/organizations/orgs-table.tsx`

- [ ] **Step 1: Create orgs-table.tsx**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@axle/ui";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isSuspended: boolean;
  memberCount: number;
  createdAt: string;
};

type OrgsTableProps = {
  orgs: OrgRow[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function OrgsTable({ orgs, pagination }: OrgsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const updateSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <form
        className="max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          updateSearchParam("search", searchInput || null);
        }}
      >
        <Input
          placeholder="조직명 또는 slug 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>조직명</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>멤버 수</TableHead>
              <TableHead>플랜</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>생성일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  조직이 없습니다
                </TableCell>
              </TableRow>
            )}
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  <Link
                    href={`/platform-admin/organizations/${org.id}`}
                    className="font-medium hover:underline"
                  >
                    {org.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{org.slug}</TableCell>
                <TableCell>{org.memberCount}</TableCell>
                <TableCell>
                  <Badge variant="outline">{PLAN_LABEL[org.plan] ?? org.plan}</Badge>
                </TableCell>
                <TableCell>
                  {org.isSuspended ? (
                    <Badge variant="outline" className="border-red-500/30 text-red-600">
                      정지
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                      정상
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(org.createdAt).toLocaleDateString("ko-KR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 {pagination.total}개 · {pagination.page} / {pagination.totalPages} 페이지
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => updateSearchParam("page", String(pagination.page - 1))}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateSearchParam("page", String(pagination.page + 1))}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck --force`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/organizations/orgs-table.tsx"
git commit -m "WI-chore 조직 테이블 클라이언트 (검색 + 페이지네이션)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Orgs list page (Server Component)

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/organizations/page.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { OrgsTable } from "./orgs-table";

type Props = {
  searchParams: Promise<{
    search?: string;
    page?: string;
    sort?: "createdAt" | "name" | "memberCount";
    order?: "asc" | "desc";
  }>;
};

export default async function OrganizationsPage({ searchParams }: Props) {
  await requirePlatformAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 20;
  const sort = sp.sort ?? "createdAt";
  const order = sp.order ?? "desc";

  const where = sp.search
    ? {
        OR: [
          { name: { contains: sp.search, mode: "insensitive" as const } },
          { slug: { contains: sp.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, orgs] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isSuspended: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
      orderBy: sort === "memberCount" ? { memberships: { _count: order } } : { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    isSuspended: o.isSuspended,
    memberCount: o._count.memberships,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">조직 관리</h1>
        <p className="text-sm text-muted-foreground">플랫폼 전체 조직을 관리합니다</p>
      </div>
      <OrgsTable
        orgs={rows}
        pagination={{
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

```bash
cd /Volumes/포터블/AXLE && npx turbo typecheck --force
cd /Volumes/포터블/AXLE && npx turbo build --filter=web
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/organizations/page.tsx"
git commit -m "WI-chore Super Admin 조직 목록 페이지

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Org detail page (4 tabs)

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/organizations/[orgId]/page.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@axle/ui";
import { getOrgStats } from "@/lib/admin/org-aggregator";
import { PlanQuotaForm } from "./plan-quota-form";
import { SuspendToggle } from "./suspend-toggle";

type Props = {
  params: Promise<{ orgId: string }>;
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default async function OrgDetailPage({ params }: Props) {
  await requirePlatformAdmin();
  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      plan: true,
      quotaAiJobs: true,
      quotaMembers: true,
      isSuspended: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!org) notFound();

  const stats = await getOrgStats(orgId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">{org.slug}</p>
        </div>
        {org.isSuspended && (
          <Badge variant="outline" className="border-red-500/30 text-red-600">
            정지됨
          </Badge>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="members">멤버 ({stats.memberCount})</TabsTrigger>
          <TabsTrigger value="plan">플랜/쿼터</TabsTrigger>
          <TabsTrigger value="manage">관리</TabsTrigger>
        </TabsList>

        {/* 개요 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  멤버
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.memberCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  프로젝트
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.projectCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  고객
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.clientCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  최근 7일 이벤트
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.last7dEvents.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Slug</dt>
                <dd className="mt-1">{org.slug}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">생성일</dt>
                <dd className="mt-1">{new Date(org.createdAt).toLocaleString("ko-KR")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">플랜</dt>
                <dd className="mt-1">
                  <Badge variant="outline">{PLAN_LABEL[org.plan] ?? org.plan}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">상태</dt>
                <dd className="mt-1">
                  {org.isSuspended ? (
                    <Badge variant="outline" className="border-red-500/30 text-red-600">
                      정지
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600"
                    >
                      정상
                    </Badge>
                  )}
                </dd>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 멤버 */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">멤버 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {org.memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">멤버가 없습니다</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {org.memberships.map((m) => (
                      <TableRow key={m.user.id}>
                        <TableCell className="font-medium">
                          {m.user.name ?? "(이름 없음)"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 플랜/쿼터 */}
        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">플랜 / 쿼터 설정</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanQuotaForm
                orgId={org.id}
                plan={org.plan}
                quotaAiJobs={org.quotaAiJobs}
                quotaMembers={org.quotaMembers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 관리 */}
        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">조직 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-red-500/20 p-4">
                <h3 className="font-medium text-red-700">조직 정지</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  정지된 조직의 멤버는 로그인 및 플랫폼 접근이 차단됩니다.
                </p>
                <div className="mt-3">
                  <SuspendToggle orgId={org.id} isSuspended={org.isSuspended} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

```bash
cd /Volumes/포터블/AXLE && npx turbo typecheck --force
cd /Volumes/포터블/AXLE && npx turbo build --filter=web
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/organizations/[orgId]/"
git commit -m "WI-chore Super Admin 조직 상세 페이지 (4탭 — 개요/멤버/플랜/관리)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Build verification

**Files:** None (verification)

- [ ] **Step 1: Full typecheck + build**

```bash
cd /Volumes/포터블/AXLE && npx turbo typecheck
cd /Volumes/포터블/AXLE && npx turbo build --filter=web
```

Expected: 25/25 typecheck, 12/12 build.

- [ ] **Step 2: Smoke check**

As PLATFORM_ADMIN, verify:
- `/platform-admin/organizations` renders list
- Search box filters organizations
- Pagination works
- Click org → 4-tab detail page loads
- 개요 tab shows stats (members/projects/clients/7d events)
- 멤버 tab shows members
- 플랜/쿼터 tab — change plan, save → toast success
- 관리 tab — click "조직 정지" → AlertDialog → 확인 → badge changes to "정지"
