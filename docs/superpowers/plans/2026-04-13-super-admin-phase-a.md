# Super Admin Console Phase A — Schema + Auth + Layout + Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Super Admin Console foundation — schema changes, auth security enforcement, independent admin layout, and analytics dashboard with KPI cards + Recharts charts.

**Architecture:** Independent route group `(admin)/platform-admin/` with its own layout, sidebar, and Server Component data fetching. KPI cards render server-side; charts are Client Components receiving data via props. Auth enforced at middleware (Edge, JWT platformRole), layout (Server, requirePlatformAdmin), and DAL (isActive/isSuspended DB checks).

**Tech Stack:** Next.js 16, Prisma 7, Recharts, shadcn/ui (Card, Badge, Tabs), Auth.js v5, Zod 4

**Spec:** `docs/superpowers/specs/2026-04-13-super-admin-console-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/app/(admin)/platform-admin/layout.tsx` | Admin layout — sidebar + header + PLATFORM_ADMIN gate |
| `apps/web/app/(admin)/platform-admin/page.tsx` | Dashboard — KPI cards + charts |
| `apps/web/app/suspended/page.tsx` | Org suspended info page |
| `apps/web/src/components/admin/admin-sidebar.tsx` | Admin navigation sidebar |
| `apps/web/src/components/admin/stat-card.tsx` | KPI stat card component |
| `apps/web/src/components/admin/trend-chart.tsx` | Recharts line chart (use client) |
| `apps/web/src/components/admin/feature-rank-chart.tsx` | Recharts bar chart (use client) |
| `apps/web/src/components/admin/activity-feed.tsx` | Recent events table |
| `apps/web/src/components/admin/org-leaderboard.tsx` | Top orgs table |
| `apps/web/app/api/admin/stats/route.ts` | Platform stats API (total orgs/users/new signups) |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/prisma/schema.prisma` | +User.isActive, +Organization.plan/quotaAiJobs/quotaMembers/isSuspended |
| `packages/auth/src/auth.ts` | +signIn callback isActive check |
| `packages/auth/src/auth.config.ts` | +/api/admin to PROTECTED_PREFIXES, +platformRole check in authorized |
| `packages/auth/src/dal.ts` | getCurrentUser +isActive DB check, requireOrg +isSuspended check |
| `apps/web/lib/analytics/aggregator.ts` | +getActiveUsers(days) for WAU/MAU |
| `apps/web/package.json` | +recharts |
| `apps/web/src/components/app-sidebar.tsx` | +Admin link for PLATFORM_ADMIN users |

---

## Task 1: Schema — Add isActive + Organization admin fields

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (User model ~line 34, Organization model ~line 118)

- [ ] **Step 1: Add isActive to User model**

In `packages/db/prisma/schema.prisma`, add after `platformRole` field (line 34):

```prisma
  isActive      Boolean      @default(true)
```

- [ ] **Step 2: Add admin fields to Organization model**

In the Organization model (after `updatedAt`), add:

```prisma
  plan         String  @default("free")
  quotaAiJobs  Int     @default(100)
  quotaMembers Int     @default(10)
  isSuspended  Boolean @default(false)
```

- [ ] **Step 3: Push schema**

Run: `cd /Volumes/포터블/AXLE/packages/db && npx prisma db push`

- [ ] **Step 4: Generate client**

Run: `cd /Volumes/포터블/AXLE/packages/db && npx prisma generate`

- [ ] **Step 5: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "WI-chore 스키마 추가 — User.isActive + Organization 플랜/쿼터/정지 필드

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Auth security — isActive + isSuspended enforcement

**Files:**
- Modify: `packages/auth/src/auth.ts` (add signIn callback)
- Modify: `packages/auth/src/auth.config.ts` (PROTECTED_PREFIXES + authorized platformRole check)
- Modify: `packages/auth/src/dal.ts` (getCurrentUser isActive, requireOrg isSuspended)
- Create: `apps/web/app/suspended/page.tsx`

- [ ] **Step 1: Add signIn callback in auth.ts**

In `packages/auth/src/auth.ts`, add a `signIn` callback inside the `callbacks` object (before the `jwt` callback). This runs for both OAuth and Credentials providers:

```typescript
    async signIn({ user }) {
      if (!user?.id) return true;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true },
      });
      if (dbUser && !dbUser.isActive) return false;
      return true;
    },
```

- [ ] **Step 2: Update PROTECTED_PREFIXES and authorized in auth.config.ts**

Replace `packages/auth/src/auth.config.ts` line 10:

```typescript
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/org", "/api/protected", "/platform-admin", "/api/admin"];
```

Replace the `authorized` callback (lines 35-42):

```typescript
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
      );
      if (!isProtected) return true;
      if (!auth?.user) return false;

      const isAdminRoute = pathname.startsWith("/platform-admin") || pathname.startsWith("/api/admin");
      if (isAdminRoute) {
        const role = (auth.user as { platformRole?: string }).platformRole;
        if (role !== "PLATFORM_ADMIN") {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
      }

      return true;
    },
```

- [ ] **Step 3: Update getCurrentUser in dal.ts — isActive DB check**

In `packages/auth/src/dal.ts`, update `getCurrentUser` to check isActive from DB. Replace the function body:

```typescript
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Verify user is still active in DB
  const { prisma } = await import("@axle/db");
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!dbUser?.isActive) return null;

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
```

- [ ] **Step 4: Update requireOrg in dal.ts — isSuspended check**

Replace the `requireOrg` function:

```typescript
export async function requireOrg(): Promise<AuthUser & { orgId: string }> {
  const user = await requireUser();
  if (!user.orgId) {
    redirect("/login");
  }

  const { prisma } = await import("@axle/db");
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { isSuspended: true },
  });
  if (org?.isSuspended) {
    redirect("/suspended");
  }

  return user as AuthUser & { orgId: string };
}
```

- [ ] **Step 5: Create suspended page**

Create `apps/web/app/suspended/page.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl">계정 정지</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>소속 조직의 계정이 일시 정지되었습니다.</p>
          <p className="mt-2">관리자에게 문의해 주세요.</p>
          <a href="/login" className="mt-4 inline-block text-sm text-primary underline">
            다시 로그인
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/auth.ts packages/auth/src/auth.config.ts packages/auth/src/dal.ts apps/web/app/suspended/page.tsx
git commit -m "WI-chore Auth 보안 강화 — isActive 로그인 차단 + isSuspended 조직 정지 + middleware 역할 체크

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Install recharts + add getActiveUsers aggregator

**Files:**
- Modify: `apps/web/package.json` (+recharts)
- Modify: `apps/web/lib/analytics/aggregator.ts` (+getActiveUsers)

- [ ] **Step 1: Install recharts**

Run: `cd /Volumes/포터블/AXLE/apps/web && npm install recharts`

- [ ] **Step 2: Add getActiveUsers to aggregator.ts**

In `apps/web/lib/analytics/aggregator.ts`, add this function after the existing `getTopActions` function:

```typescript
/**
 * Accurate WAU/MAU — COUNT(DISTINCT userId) over N-day window.
 * Cannot use DailyMetric.uniqueUsers sum (double-counts across days).
 */
export async function getActiveUsers(days: number): Promise<number> {
  const since = todayStartKST();
  since.setDate(since.getDate() - days);

  const result = await prisma.analyticsEvent.groupBy({
    by: ["userId"],
    where: {
      userId: { not: null },
      createdAt: { gte: since },
    },
  });

  return result.length;
}
```

Also add to the exports of `todayStartKST` if it's not already exported (it's used internally — just make sure `getActiveUsers` can call it).

- [ ] **Step 3: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/lib/analytics/aggregator.ts
git commit -m "WI-chore recharts 설치 + getActiveUsers(WAU/MAU) aggregator 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Admin layout + sidebar

**Files:**
- Create: `apps/web/src/components/admin/admin-sidebar.tsx`
- Create: `apps/web/app/(admin)/platform-admin/layout.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx` (+Admin link)

- [ ] **Step 1: Create AdminSidebar**

Create `apps/web/src/components/admin/admin-sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Building2, ArrowLeft } from "lucide-react";
import { cn } from "@axle/ui/lib/utils";

const NAV_ITEMS = [
  { href: "/platform-admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/platform-admin/users", label: "사용자", icon: Users },
  { href: "/platform-admin/organizations", label: "조직", icon: Building2 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-semibold tracking-tight">AXLE Admin</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/platform-admin"
              ? pathname === "/platform-admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50"
        >
          <ArrowLeft className="h-4 w-4" />
          앱으로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create admin layout**

Create `apps/web/app/(admin)/platform-admin/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@axle/auth";
import { AdminSidebar } from "@/src/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <AdminSidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <div className="md:hidden text-sm font-semibold">AXLE Admin</div>
          <div className="hidden md:block" />
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add Admin link to app sidebar**

In `apps/web/src/components/app-sidebar.tsx`, import `Shield` from lucide-react (add to the import line). Then add a conditional admin link. After the existing `NAV_ITEMS` array, before the return statement, add logic to render an admin link in the sidebar footer if the user has PLATFORM_ADMIN role.

This requires the component to receive the user's platformRole as a prop. Update the component to accept `platformRole?: string` prop and render the link conditionally in the footer section.

- [ ] **Step 4: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 5: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/admin/ apps/web/app/\(admin\)/ apps/web/src/components/app-sidebar.tsx
git commit -m "WI-chore Admin 레이아웃 + 사이드바 + PLATFORM_ADMIN 게이트 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Admin stats API + StatCard component

**Files:**
- Create: `apps/web/app/api/admin/stats/route.ts`
- Create: `apps/web/src/components/admin/stat-card.tsx`

- [ ] **Step 1: Create stats API route**

Create `apps/web/app/api/admin/stats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import { handleInternalError, forbiddenResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requirePlatformAdmin().catch(() => null);
    if (!user) return forbiddenResponse();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalOrgs, totalUsers, newUsersThisWeek, activeOrgs] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.organization.count({ where: { isSuspended: false } }),
    ]);

    return NextResponse.json({
      data: {
        totalOrgs,
        totalUsers,
        newUsersThisWeek,
        activeOrgs,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 2: Create StatCard component**

Create `apps/web/src/components/admin/stat-card.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@axle/ui";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  change?: number; // percentage change, e.g., 12.5 or -3.2
};

export function StatCard({ title, value, description, change }: StatCardProps) {
  return (
    <Card className="border bg-card">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wider">
          {title}
        </CardDescription>
        <CardTitle className="text-3xl font-bold">
          {typeof value === "number" ? value.toLocaleString() : value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {change !== undefined && (
            <span
              className={`text-xs font-medium ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/admin/stats/route.ts apps/web/src/components/admin/stat-card.tsx
git commit -m "WI-chore Admin 통계 API + StatCard KPI 컴포넌트 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Chart components (TrendChart + FeatureRankChart)

**Files:**
- Create: `apps/web/src/components/admin/trend-chart.tsx`
- Create: `apps/web/src/components/admin/feature-rank-chart.tsx`

- [ ] **Step 1: Create TrendChart**

Create `apps/web/src/components/admin/trend-chart.tsx`:

```typescript
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

type TrendData = {
  date: string;
  pageViews: number;
  uniqueUsers: number;
  sessions: number;
};

type TrendChartProps = {
  data: TrendData[];
  title?: string;
};

export function TrendChart({ data, title = "트렌드" }: TrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="uniqueUsers"
                name="활성 사용자"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="pageViews"
                name="페이지뷰"
                stroke="hsl(var(--chart-2, 200 80% 60%))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                name="세션"
                stroke="hsl(var(--chart-3, 150 60% 50%))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create FeatureRankChart**

Create `apps/web/src/components/admin/feature-rank-chart.tsx`:

```typescript
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

type ActionData = {
  action: string;
  count: number;
};

type FeatureRankChartProps = {
  data: ActionData[];
  title?: string;
};

const ACTION_LABELS: Record<string, string> = {
  "project.create": "프로젝트 생성",
  "doc.upload": "서류 업로드",
  "doc.request": "서류 요청",
  "ai.job.complete": "AI 작업",
  "matching.run": "매칭 실행",
  "meeting.create": "미팅 생성",
  "estimate.create": "견적 생성",
  "contract.create": "계약 생성",
  "client.create": "고객 등록",
  "project.assign": "프로젝트 배정",
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function FeatureRankChart({ data, title = "기능 사용 랭킹" }: FeatureRankChartProps) {
  const formatted = data.map((d) => ({ ...d, label: formatAction(d.action) }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="label" type="category" className="text-xs" width={75} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" name="사용 횟수" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/admin/trend-chart.tsx apps/web/src/components/admin/feature-rank-chart.tsx
git commit -m "WI-chore Recharts 차트 컴포넌트 추가 — TrendChart + FeatureRankChart

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ActivityFeed + OrgLeaderboard components

**Files:**
- Create: `apps/web/src/components/admin/activity-feed.tsx`
- Create: `apps/web/src/components/admin/org-leaderboard.tsx`

- [ ] **Step 1: Create ActivityFeed**

Create `apps/web/src/components/admin/activity-feed.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

type ActivityEvent = {
  id: string;
  action: string;
  userId: string | null;
  userName: string | null;
  category: string;
  createdAt: string;
};

type ActivityFeedProps = {
  events: ActivityEvent[];
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">최근 활동</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">액션</th>
                <th className="pb-2 font-medium">사용자</th>
                <th className="pb-2 font-medium">시간</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-2">
                    <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                      {event.action}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-muted-foreground">
                    {event.userName ?? "익명"}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(event.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">
                    최근 활동이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create OrgLeaderboard**

Create `apps/web/src/components/admin/org-leaderboard.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui";

type OrgRank = {
  orgId: string;
  orgName: string;
  eventCount: number;
};

type OrgLeaderboardProps = {
  data: OrgRank[];
};

export function OrgLeaderboard({ data }: OrgLeaderboardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">조직별 활동 순위</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium w-8">#</th>
                <th className="pb-2 font-medium">조직</th>
                <th className="pb-2 font-medium text-right">이벤트</th>
              </tr>
            </thead>
            <tbody>
              {data.map((org, i) => (
                <tr key={org.orgId} className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-medium">{org.orgName}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {org.eventCount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">
                    데이터가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/admin/activity-feed.tsx apps/web/src/components/admin/org-leaderboard.tsx
git commit -m "WI-chore ActivityFeed + OrgLeaderboard 위젯 컴포넌트 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Dashboard page — assemble everything

**Files:**
- Create: `apps/web/app/(admin)/platform-admin/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `apps/web/app/(admin)/platform-admin/page.tsx`:

```typescript
import { prisma } from "@axle/db";
import { getTodayOverview, getDailyTrends, getTopActions, getActiveUsers } from "@/lib/analytics/aggregator";
import { StatCard } from "@/src/components/admin/stat-card";
import { TrendChart } from "@/src/components/admin/trend-chart";
import { FeatureRankChart } from "@/src/components/admin/feature-rank-chart";
import { ActivityFeed } from "@/src/components/admin/activity-feed";
import { OrgLeaderboard } from "@/src/components/admin/org-leaderboard";

export default async function AdminDashboardPage() {
  const [today, trends, topActions, wau, mau, platformStats, recentEvents, orgLeaderboard] =
    await Promise.all([
      getTodayOverview(),
      getDailyTrends(30),
      getTopActions(30, 10),
      getActiveUsers(7),
      getActiveUsers(30),
      prisma.$queryRawUnsafe<{ totalOrgs: bigint; totalUsers: bigint; newThisWeek: bigint }[]>(
        `SELECT
          (SELECT COUNT(*) FROM "Organization") as "totalOrgs",
          (SELECT COUNT(*) FROM "User") as "totalUsers",
          (SELECT COUNT(*) FROM "User" WHERE "createdAt" > NOW() - INTERVAL '7 days') as "newThisWeek"`
      ).then((r) => ({
        totalOrgs: Number(r[0]?.totalOrgs ?? 0),
        totalUsers: Number(r[0]?.totalUsers ?? 0),
        newThisWeek: Number(r[0]?.newThisWeek ?? 0),
      })),
      // Recent events: BUSINESS + FEATURE_USE only, last 50
      prisma.analyticsEvent.findMany({
        where: { category: { in: ["BUSINESS", "FEATURE_USE"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          userId: true,
          category: true,
          createdAt: true,
        },
      }),
      // Org leaderboard: DailyMetric last 7 days, sum pageViews per org
      prisma.dailyMetric.groupBy({
        by: ["orgId"],
        where: {
          orgId: { not: null },
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: { pageViews: true },
        orderBy: { _sum: { pageViews: "desc" } },
        take: 10,
      }),
    ]);

  // Enrich recent events with user names
  const userIds = [...new Set(recentEvents.map((e) => e.userId).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const activityEvents = recentEvents.map((e) => ({
    id: e.id,
    action: e.action,
    userId: e.userId,
    userName: e.userId ? (userMap.get(e.userId) ?? null) : null,
    category: e.category,
    createdAt: e.createdAt.toISOString(),
  }));

  // Enrich org leaderboard with names
  const orgIds = orgLeaderboard.map((o) => o.orgId).filter(Boolean) as string[];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

  const orgRanks = orgLeaderboard.map((o) => ({
    orgId: o.orgId ?? "",
    orgName: orgMap.get(o.orgId ?? "") ?? "Unknown",
    eventCount: o._sum.pageViews ?? 0,
  }));

  // Calculate DAU change (yesterday vs today)
  const yesterdayUsers = trends.length >= 2 ? trends[trends.length - 1]!.uniqueUsers : 0;
  const dauChange = yesterdayUsers > 0
    ? ((today.uniqueUsers - yesterdayUsers) / yesterdayUsers) * 100
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">플랫폼 대시보드</h1>
        <p className="text-sm text-muted-foreground">AXLE 플랫폼 전체 통계</p>
      </div>

      {/* KPI Cards — 2 rows × 3 cols */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="DAU / WAU / MAU"
          value={`${today.uniqueUsers} / ${wau} / ${mau}`}
          change={dauChange}
          description="활성 사용자"
        />
        <StatCard
          title="페이지뷰 / 세션"
          value={`${today.pageViews.toLocaleString()} / ${today.sessions.toLocaleString()}`}
          description="오늘"
        />
        <StatCard
          title="AI 작업 / 비용"
          value={`${today.aiJobsTotal} / $${today.aiJobsCost.toFixed(2)}`}
          description="오늘"
        />
        <StatCard
          title="조직 / 사용자"
          value={`${platformStats.totalOrgs} / ${platformStats.totalUsers}`}
          description={`이번 주 신규 ${platformStats.newThisWeek}명`}
        />
        <StatCard
          title="API 에러율"
          value={
            today.apiCalls > 0
              ? `${((today.apiErrors / today.apiCalls) * 100).toFixed(1)}%`
              : "0%"
          }
          description={`${today.apiErrors} / ${today.apiCalls} 호출`}
        />
        <StatCard
          title="비즈니스 활동"
          value={String(today.aiJobsTotal + today.apiCalls)}
          description="프로젝트·문서·매칭 합산"
        />
      </div>

      {/* Charts — 2 cols */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart data={trends} title="30일 트렌드" />
        <FeatureRankChart data={topActions} title="기능 사용 랭킹 (30일)" />
        <ActivityFeed events={activityEvents} />
        <OrgLeaderboard data={orgRanks} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 3: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(admin\)/platform-admin/page.tsx
git commit -m "WI-chore Super Admin 대시보드 페이지 — KPI 6개 + 차트 4개 위젯

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`

- [ ] **Step 2: Full build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "WI-chore Phase A 빌드 검증 완료

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
