# Super Admin Console Phase B — User Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build user management — list (search/filter/pagination), detail page, inline role change + active toggle, bulk operations, and CSV export. PLATFORM_ADMIN only.

**Architecture:** Server Components fetch paginated user data via Prisma. Inline actions (role change, activate) use Server Actions with `revalidatePath`. Bulk operations + CSV export use API routes. Self-demotion and last-admin protection enforced at API layer.

**Tech Stack:** Next.js 16 (Server Actions + Route Handlers), Prisma 7, Zod 4, shadcn/ui (Table, DropdownMenu, Switch, AlertDialog, Checkbox)

**Spec:** `docs/superpowers/specs/2026-04-13-super-admin-console-design.md` §3

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/app/(admin)/platform-admin/users/page.tsx` | User list page (server component) |
| `apps/web/app/(admin)/platform-admin/users/[userId]/page.tsx` | User detail page |
| `apps/web/app/(admin)/platform-admin/users/users-table.tsx` | Client component with checkboxes + bulk toolbar |
| `apps/web/app/(admin)/platform-admin/users/user-row-actions.tsx` | DropdownMenu for row actions |
| `apps/web/app/(admin)/platform-admin/users/actions.ts` | Server Actions (role change, toggle active) |
| `apps/web/app/api/admin/users/route.ts` | GET user list |
| `apps/web/app/api/admin/users/[userId]/route.ts` | GET user detail, PATCH role/active |
| `apps/web/app/api/admin/users/export/route.ts` | GET CSV export |
| `apps/web/app/api/admin/users/bulk/route.ts` | POST bulk action |
| `apps/web/lib/admin/user-guards.ts` | Shared validation: self-demotion, last-admin |
| `apps/web/lib/admin/csv.ts` | CSV formatting utility |

### Modified Files

| File | Change |
|------|--------|
| `packages/ui/src/index.ts` | Export `Checkbox`, `AlertDialog`, `DropdownMenu`, `Switch` if missing |

---

## Task 1: Admin user guards (shared validation)

**Files:**
- Create: `apps/web/lib/admin/user-guards.ts`

- [ ] **Step 1: Create user-guards.ts**

```typescript
import { prisma } from "@axle/db";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Prevent admins from demoting themselves.
 * Throws ForbiddenError if currentUserId === targetUserId.
 */
export function guardSelfDemotion(currentUserId: string, targetUserId: string): void {
  if (currentUserId === targetUserId) {
    throw new ForbiddenError("자기 자신의 역할은 변경할 수 없습니다");
  }
}

/**
 * Prevent demoting the last PLATFORM_ADMIN.
 * Only checks when the change is from PLATFORM_ADMIN to USER.
 * Throws ForbiddenError if this would leave 0 admins.
 */
export async function guardLastAdminDemotion(
  targetUserId: string,
  newRole: "USER" | "PLATFORM_ADMIN",
): Promise<void> {
  if (newRole === "PLATFORM_ADMIN") return;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { platformRole: true },
  });
  if (target?.platformRole !== "PLATFORM_ADMIN") return;

  const adminCount = await prisma.user.count({
    where: { platformRole: "PLATFORM_ADMIN" },
  });
  if (adminCount <= 1) {
    throw new ForbiddenError("마지막 플랫폼 관리자는 강등할 수 없습니다");
  }
}

/**
 * Prevent deactivating yourself (similar logic).
 */
export function guardSelfDeactivation(
  currentUserId: string,
  targetUserId: string,
  newIsActive: boolean,
): void {
  if (!newIsActive && currentUserId === targetUserId) {
    throw new ForbiddenError("자기 자신을 비활성화할 수 없습니다");
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/admin/user-guards.ts
git commit -m "WI-chore Admin 사용자 가드 — 자기 강등/마지막 관리자 보호

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: CSV utility

**Files:**
- Create: `apps/web/lib/admin/csv.ts`

- [ ] **Step 1: Create csv.ts**

```typescript
/**
 * Simple CSV formatter — escapes quotes, wraps fields with commas/newlines.
 * For admin exports only (no streaming, limit 10,000 rows).
 */

type CsvValue = string | number | boolean | null | undefined | Date;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCell).join(","));
  // UTF-8 BOM for Excel compatibility
  return "\uFEFF" + [headerLine, ...dataLines].join("\n");
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/admin/csv.ts
git commit -m "WI-chore Admin CSV 유틸리티 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: List API — GET /api/admin/users

**Files:**
- Create: `apps/web/app/api/admin/users/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, handleZodError, forbiddenResponse } from "@/lib/api-helpers";

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  role: z.enum(["USER", "PLATFORM_ADMIN"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name"]).default("createdAt"),
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

    const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return handleZodError(parsed.error);

    const { search, role, status, page, pageSize, sort, order } = parsed.data;

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(role ? { platformRole: role } : {}),
      ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          platformRole: true,
          isActive: true,
          createdAt: true,
          memberships: {
            select: {
              role: true,
              organization: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        platformRole: u.platformRole,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        orgs: u.memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
        })),
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

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/users/route.ts
git commit -m "WI-chore GET /api/admin/users — 사용자 목록 API (검색/필터/페이지네이션)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Detail + Patch API — /api/admin/users/[userId]

**Files:**
- Create: `apps/web/app/api/admin/users/[userId]/route.ts`

- [ ] **Step 1: Create the route**

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
import {
  guardSelfDemotion,
  guardLastAdminDemotion,
  guardSelfDeactivation,
  ForbiddenError,
} from "@/lib/admin/user-guards";

const PatchSchema = z
  .object({
    platformRole: z.enum(["USER", "PLATFORM_ADMIN"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field required",
  });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        platformRole: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) return notFoundResponse("User");

    const recentEvents = await prisma.analyticsEvent.findMany({
      where: {
        userId,
        category: { in: ["BUSINESS", "FEATURE_USE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        category: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: {
        user: { ...user, createdAt: user.createdAt.toISOString() },
        recentEvents: recentEvents.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    let currentUser;
    try {
      currentUser = await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { userId } = await params;
    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { platformRole, isActive } = parsed.data;

    try {
      if (platformRole !== undefined) {
        guardSelfDemotion(currentUser.id, userId);
        await guardLastAdminDemotion(userId, platformRole);
      }
      if (isActive !== undefined) {
        guardSelfDeactivation(currentUser.id, userId, isActive);
      }
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return forbiddenResponse(err.message);
      }
      throw err;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(platformRole !== undefined ? { platformRole } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        platformRole: true,
        isActive: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/users/
git commit -m "WI-chore GET/PATCH /api/admin/users/[userId] — 상세 + 역할/활성 변경

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Bulk action API — POST /api/admin/users/bulk

**Files:**
- Create: `apps/web/app/api/admin/users/bulk/route.ts`

- [ ] **Step 1: Create the route**

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
} from "@/lib/api-helpers";

const BulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("changeRole"),
    userIds: z.array(z.string()).min(1).max(100),
    platformRole: z.enum(["USER", "PLATFORM_ADMIN"]),
  }),
  z.object({
    action: z.literal("deactivate"),
    userIds: z.array(z.string()).min(1).max(100),
  }),
  z.object({
    action: z.literal("activate"),
    userIds: z.array(z.string()).min(1).max(100),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    let currentUser;
    try {
      currentUser = await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = BulkSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const payload = parsed.data;

    // Prevent self from being in the list for role/deactivate
    if (payload.action === "changeRole" || payload.action === "deactivate") {
      if (payload.userIds.includes(currentUser.id)) {
        return forbiddenResponse("자기 자신은 일괄 작업 대상에서 제외되어야 합니다");
      }
    }

    // Last-admin check: if changing role to USER, make sure we don't demote all admins
    if (payload.action === "changeRole" && payload.platformRole === "USER") {
      const adminsBeingDemoted = await prisma.user.count({
        where: { id: { in: payload.userIds }, platformRole: "PLATFORM_ADMIN" },
      });
      const totalAdmins = await prisma.user.count({
        where: { platformRole: "PLATFORM_ADMIN" },
      });
      if (totalAdmins - adminsBeingDemoted < 1) {
        return forbiddenResponse(
          "이 작업을 수행하면 플랫폼 관리자가 없어집니다",
        );
      }
    }

    let count = 0;
    if (payload.action === "changeRole") {
      const result = await prisma.user.updateMany({
        where: { id: { in: payload.userIds } },
        data: { platformRole: payload.platformRole },
      });
      count = result.count;
    } else if (payload.action === "deactivate" || payload.action === "activate") {
      const result = await prisma.user.updateMany({
        where: { id: { in: payload.userIds } },
        data: { isActive: payload.action === "activate" },
      });
      count = result.count;
    }

    return NextResponse.json({ data: { updated: count } });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/users/bulk/
git commit -m "WI-chore POST /api/admin/users/bulk — 일괄 역할/활성 변경

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: CSV export API — GET /api/admin/users/export

**Files:**
- Create: `apps/web/app/api/admin/users/export/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";
import { toCsv } from "@/lib/admin/csv";

const MAX_EXPORT = 10_000;

export async function GET(_request: NextRequest) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const users = await prisma.user.findMany({
      take: MAX_EXPORT,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: {
            organization: { select: { name: true } },
            role: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["ID", "이름", "이메일", "플랫폼 역할", "소속 조직", "조직 내 역할", "활성", "가입일"];
    const rows = users.map((u) => [
      u.id,
      u.name ?? "",
      u.email,
      u.platformRole,
      u.memberships[0]?.organization.name ?? "",
      u.memberships[0]?.role ?? "",
      u.isActive ? "Y" : "N",
      u.createdAt.toISOString(),
    ]);

    const csv = toCsv(headers, rows);
    const filename = `axle-users-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/users/export/
git commit -m "WI-chore GET /api/admin/users/export — CSV 내보내기 (최대 10,000건)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Server Actions (role change + toggle active)

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/users/actions.ts`

- [ ] **Step 1: Create actions.ts**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  guardSelfDemotion,
  guardLastAdminDemotion,
  guardSelfDeactivation,
  ForbiddenError,
} from "@/lib/admin/user-guards";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function changeUserRole(
  userId: string,
  newRole: "USER" | "PLATFORM_ADMIN",
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  try {
    guardSelfDemotion(currentUser.id, userId);
    await guardLastAdminDemotion(userId, newRole);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { platformRole: newRole },
  });

  revalidatePath("/platform-admin/users");
  revalidatePath(`/platform-admin/users/${userId}`);
  return { ok: true };
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requirePlatformAdmin();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: "권한이 없습니다" };
  }

  try {
    guardSelfDeactivation(currentUser.id, userId, isActive);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath("/platform-admin/users");
  revalidatePath(`/platform-admin/users/${userId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/users/actions.ts"
git commit -m "WI-chore Admin 사용자 Server Actions — 역할 변경 + 활성 토글

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Row actions dropdown component

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/users/user-row-actions.tsx`

- [ ] **Step 1: Check if AlertDialog/DropdownMenu/Switch exist in @axle/ui**

Check `/Volumes/포터블/AXLE/packages/ui/src/index.ts` — ensure these are exported:
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`
- `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`
- `Switch`
- `Button`

If missing, add shadcn components using the existing pattern (look at `packages/ui/src/components/` for existing examples). Use `npx shadcn@latest add <component>` in the `packages/ui/` directory if shadcn is configured there.

- [ ] **Step 2: Create user-row-actions.tsx**

```typescript
"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@axle/ui";
import { toast } from "sonner";
import { changeUserRole, setUserActive } from "./actions";

type UserRowActionsProps = {
  userId: string;
  currentUserId: string;
  platformRole: "USER" | "PLATFORM_ADMIN";
  isActive: boolean;
};

type PendingAction =
  | { type: "promote" }
  | { type: "demote" }
  | { type: "activate" }
  | { type: "deactivate" }
  | null;

export function UserRowActions({
  userId,
  currentUserId,
  platformRole,
  isActive,
}: UserRowActionsProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();

  const isSelf = userId === currentUserId;

  const handleConfirm = () => {
    if (!pending) return;
    startTransition(async () => {
      let result;
      if (pending.type === "promote") {
        result = await changeUserRole(userId, "PLATFORM_ADMIN");
      } else if (pending.type === "demote") {
        result = await changeUserRole(userId, "USER");
      } else if (pending.type === "activate") {
        result = await setUserActive(userId, true);
      } else {
        result = await setUserActive(userId, false);
      }

      if (result.ok) {
        toast.success("변경되었습니다");
      } else {
        toast.error(result.error);
      }
      setPending(null);
    });
  };

  const confirmText: Record<NonNullable<PendingAction>["type"], string> = {
    promote: "이 사용자를 플랫폼 관리자로 승격하시겠습니까? 관리자는 전체 플랫폼에 접근할 수 있습니다.",
    demote: "이 사용자의 플랫폼 관리자 권한을 해제하시겠습니까?",
    activate: "이 사용자를 활성화하시겠습니까?",
    deactivate: "이 사용자를 비활성화하시겠습니까? 로그인이 차단됩니다.",
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {platformRole === "USER" ? (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "promote" })}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              관리자로 승격
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "demote" })}
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              관리자 권한 해제
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isActive ? (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "deactivate" })}
            >
              <UserX className="mr-2 h-4 w-4" />
              비활성화
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "activate" })}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              활성화
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작업 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? confirmText[pending.type] : ""}
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

- [ ] **Step 3: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/users/user-row-actions.tsx"
git commit -m "WI-chore 사용자 행 액션 드롭다운 + 확인 다이얼로그 컴포넌트

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Users table with bulk toolbar

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/users/users-table.tsx`

- [ ] **Step 1: Create users-table.tsx**

```typescript
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Users as UsersIcon } from "lucide-react";
import {
  Button,
  Input,
  Checkbox,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@axle/ui";
import { toast } from "sonner";
import { UserRowActions } from "./user-row-actions";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  platformRole: "USER" | "PLATFORM_ADMIN";
  isActive: boolean;
  createdAt: string;
  orgs: { id: string; name: string; role: string }[];
};

type UsersTableProps = {
  users: UserRow[];
  currentUserId: string;
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
};

export function UsersTable({ users, currentUserId, pagination }: UsersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const selectableIds = users.filter((u) => u.id !== currentUserId).map((u) => u.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const handleBulkAction = async (action: "changeRole" | "deactivate" | "activate", role?: "USER" | "PLATFORM_ADMIN") => {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userIds: Array.from(selected),
          ...(role ? { platformRole: role } : {}),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`${json.data.updated}명 업데이트됨`);
        setSelected(new Set());
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({ error: { message: "실패" } }));
        toast.error(err.error?.message ?? "실패");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex-1 min-w-[200px]"
          onSubmit={(e) => {
            e.preventDefault();
            updateSearchParam("search", searchInput || null);
          }}
        >
          <Input
            placeholder="이름 또는 이메일 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={searchParams.get("role") ?? ""}
          onChange={(e) => updateSearchParam("role", e.target.value || null)}
        >
          <option value="">모든 역할</option>
          <option value="USER">일반</option>
          <option value="PLATFORM_ADMIN">관리자</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateSearchParam("status", e.target.value || null)}
        >
          <option value="">모든 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/admin/users/export" download>
            <Download className="mr-2 h-4 w-4" />
            CSV 내보내기
          </a>
        </Button>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
          <span className="text-sm font-medium">{selected.size}명 선택됨</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleBulkAction("changeRole", "PLATFORM_ADMIN")}>
            관리자로
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleBulkAction("changeRole", "USER")}>
            일반으로
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleBulkAction("activate")}>
            활성화
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleBulkAction("deactivate")}>
            비활성화
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>소속</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <UsersIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  사용자가 없습니다
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(user.id)}
                      onCheckedChange={() => toggleOne(user.id)}
                      disabled={isSelf}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/platform-admin/users/${user.id}`}
                      className="font-medium hover:underline"
                    >
                      {user.name ?? "(이름 없음)"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.platformRole === "PLATFORM_ADMIN" ? (
                      <Badge>관리자</Badge>
                    ) : (
                      <Badge variant="secondary">일반</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.orgs[0]?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                        활성
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-500/30 text-red-600">
                        비활성
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      userId={user.id}
                      currentUserId={currentUserId}
                      platformRole={user.platformRole}
                      isActive={user.isActive}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 {pagination.total}명 · {pagination.page} / {pagination.totalPages} 페이지
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

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/users/users-table.tsx"
git commit -m "WI-chore 사용자 테이블 + 검색/필터/일괄/페이지네이션 클라이언트

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: User list page (server component)

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/users/page.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { UsersTable } from "./users-table";

type Props = {
  searchParams: Promise<{
    search?: string;
    role?: "USER" | "PLATFORM_ADMIN";
    status?: "active" | "inactive";
    page?: string;
    sort?: "createdAt" | "name";
    order?: "asc" | "desc";
  }>;
};

export default async function UsersPage({ searchParams }: Props) {
  const currentUser = await requirePlatformAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 20;
  const sort = sp.sort ?? "createdAt";
  const order = sp.order ?? "desc";

  const where = {
    ...(sp.search
      ? {
          OR: [
            { name: { contains: sp.search, mode: "insensitive" as const } },
            { email: { contains: sp.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(sp.role ? { platformRole: sp.role } : {}),
    ...(sp.status === "active"
      ? { isActive: true }
      : sp.status === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        platformRole: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    platformRole: u.platformRole,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    orgs: u.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <p className="text-sm text-muted-foreground">플랫폼 전체 사용자를 관리합니다</p>
      </div>
      <UsersTable
        users={rows}
        currentUserId={currentUser.id}
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
cd /Volumes/포터블/AXLE && npx turbo typecheck
cd /Volumes/포터블/AXLE && npx turbo build --filter=web
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/users/page.tsx"
git commit -m "WI-chore Super Admin 사용자 목록 페이지

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: User detail page

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/users/[userId]/page.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
import { notFound } from "next/navigation";
import Image from "next/image";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@axle/ui";
import { UserRowActions } from "../user-row-actions";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function UserDetailPage({ params }: Props) {
  const currentUser = await requirePlatformAdmin();
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      platformRole: true,
      isActive: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!user) notFound();

  const recentEvents = await prisma.analyticsEvent.findMany({
    where: {
      userId,
      category: { in: ["BUSINESS", "FEATURE_USE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.name ?? user.email}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">프로필</CardTitle>
              <UserRowActions
                userId={user.id}
                currentUserId={currentUser.id}
                platformRole={user.platformRole}
                isActive={user.isActive}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full"
              />
            )}
            <div>
              <dt className="text-xs text-muted-foreground">역할</dt>
              <dd className="mt-1">
                {user.platformRole === "PLATFORM_ADMIN" ? (
                  <Badge>플랫폼 관리자</Badge>
                ) : (
                  <Badge variant="secondary">일반</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">상태</dt>
              <dd className="mt-1">
                {user.isActive ? (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                    활성
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-500/30 text-red-600">
                    비활성
                  </Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">가입일</dt>
              <dd className="mt-1">
                {new Date(user.createdAt).toLocaleString("ko-KR")}
              </dd>
            </div>
          </CardContent>
        </Card>

        {/* Orgs card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">소속 조직</CardTitle>
          </CardHeader>
          <CardContent>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">소속 조직이 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {user.memberships.map((m) => (
                  <li
                    key={m.organization.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{m.organization.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.organization.slug}
                      </p>
                    </div>
                    <Badge variant="outline">{m.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">최근 활동 (최근 50건)</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 활동이 없습니다</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">액션</th>
                      <th className="pb-2 font-medium">시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2">
                          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                            {e.action}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

```bash
cd /Volumes/포터블/AXLE && npx turbo typecheck
cd /Volumes/포터블/AXLE && npx turbo build --filter=web
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(admin)/platform-admin/users/[userId]/"
git commit -m "WI-chore Super Admin 사용자 상세 페이지 — 프로필 + 조직 + 최근 활동

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final verification

**Files:** None (verification)

- [ ] **Step 1: Full typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: 25/25 pass.

- [ ] **Step 2: Full build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build`

Expected: All packages build.

- [ ] **Step 3: Smoke check (manual)**

Visit `/platform-admin/users` as PLATFORM_ADMIN in browser. Verify:
- Table renders with users
- Search box filters
- Role/status filter dropdowns work
- Row action dropdown appears
- Checkboxes select rows, bulk toolbar appears
- Click user → detail page loads
