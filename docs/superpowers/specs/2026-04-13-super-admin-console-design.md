# Super Admin Console Design

> AXLE Admin 기능 — 서브시스템 #2/3
> 서브시스템 #1 (이벤트 트래킹 인프라) 위에 구축

## Overview

PLATFORM_ADMIN 전용 독립 콘솔. 플랫폼 전체 통계 대시보드, 사용자 관리, 조직 관리를 제공.

---

## 1. 라우트 구조

```
app/(admin)/platform-admin/
  layout.tsx                    ← 독립 사이드바 + 헤더 (PLATFORM_ADMIN 체크)
  page.tsx                      ← 대시보드 (KPI + 차트)
  users/
    page.tsx                    ← 사용자 목록 (검색/필터/역할변경/활성화/일괄작업)
    [userId]/page.tsx           ← 사용자 상세 (프로필, 소속 조직, 활동 로그)
  organizations/
    page.tsx                    ← 조직 목록 (검색/멤버수/생성일)
    [orgId]/page.tsx            ← 조직 상세 (멤버, 통계, 플랜/쿼터, 정지)
```

### 레이아웃

- 기존 `(app)/` 레이아웃과 완전히 분리된 독립 레이아웃
- 좌측 사이드바: 대시보드, 사용자, 조직 3개 네비게이션
- 상단 헤더: "AXLE Admin" 로고 + 현재 사용자 + 앱으로 돌아가기 링크
- Server Component — `requirePlatformAdmin()` 호출하여 권한 없으면 `/login` 리다이렉트
- 반응형: 데스크톱 사이드바, 모바일 시트 메뉴

---

## 2. 대시보드 페이지

### KPI 카드 (상단, 2행 × 3열)

| 카드 | 데이터 소스 | 표시 |
|------|-----------|------|
| DAU / WAU / MAU | `/api/analytics/platform/overview` (today.uniqueUsers) + 신규 `getActiveUsers(7)`, `getActiveUsers(30)` aggregator | DAU=오늘, WAU=7일 DISTINCT, MAU=30일 DISTINCT + 전일 대비 % |
| 페이지뷰 / 세션 | `/api/analytics/platform/overview` | today.pageViews, today.sessions |
| AI 작업 / 비용 | `/api/analytics/platform/ai` | totals.aiJobsTotal, totals.aiJobsCost |
| 총 조직 / 사용자 | `/api/admin/stats` (신규) | DB count 직접 + 이번 주 신규 가입 수 |
| API 에러율 / 응답시간 | `/api/analytics/platform/system` | totals.apiErrors / totals.apiCalls × 100 |
| 비즈니스 활동 | `/api/analytics/platform/overview` | today.projectsCreated 등 (Server Component에서 직접 Prisma) |

**WAU/MAU 계산 (I1 해결):**
- 일별 uniqueUsers 합산 ≠ 실제 WAU/MAU (동일 유저 중복 카운트됨)
- 신규 aggregator 함수 `getActiveUsers(days)` 추가: `COUNT(DISTINCT userId) WHERE createdAt > now()-Nd` on AnalyticsEvent
- DAU는 기존 `getTodayOverview().uniqueUsers` 활용

### 차트 + 위젯 (하단, 2열 그리드)

| 위치 | 위젯 | 구현 |
|------|------|------|
| 좌상 | 7/30일 트렌드 라인 차트 | Recharts LineChart, 기간 토글 버튼 |
| 우상 | 기능 사용 랭킹 바 차트 | Recharts BarChart, 상위 10개 |
| 좌하 | 최근 활동 피드 | 최근 50건 AnalyticsEvent (BUSINESS + FEATURE_USE만 필터) |
| 우하 | 조직별 활동 리더보드 | DailyMetric 기반 최근 7일 합산 상위 10개 조직 |

### 데이터 패턴

- KPI 카드: Server Component에서 직접 Prisma 쿼리 (API 우회, 동일 서버)
- 차트: Client Component (`"use client"`) — Recharts 필수. 데이터는 부모 Server Component에서 props 전달
- 기간 토글: 클라이언트 state로 관리, fetch on change
- 활동 피드: BUSINESS + FEATURE_USE 카테고리만 표시 (PAGE_VIEW/API_CALL 제외)
- 리더보드: DailyMetric 테이블에서 최근 7일 합산 (raw AnalyticsEvent full scan 방지)

---

## 3. 사용자 관리

### 목록 페이지 (`/platform-admin/users`)

- DataTable: 이름, 이메일, 플랫폼 역할, 소속 조직, 가입일, 활성 상태
- 검색: 이름/이메일 텍스트 검색
- 필터: 플랫폼 역할 (USER/PLATFORM_ADMIN), 활성 상태
- 정렬: 가입일, 이름
- 페이지네이션: 서버사이드 offset 기반, 20건/페이지
- 행 클릭 → 상세 페이지 이동

### 인라인 액션

- 플랫폼 역할 변경: DropdownMenu (USER ↔ PLATFORM_ADMIN), 확인 AlertDialog
- 활성/비활성 토글: Switch 컴포넌트, 확인 AlertDialog
- **자기 강등 방지 (I8)**: 본인의 역할은 변경 불가 (UI에서 비활성화)
- **마지막 Admin 보호**: PLATFORM_ADMIN이 1명뿐이면 강등 차단 (API에서 체크)

### 일괄 작업

- 체크박스 선택 → 툴바 노출: CSV 내보내기, 역할 일괄 변경, 일괄 비활성화
- CSV: 이름, 이메일, 역할, 조직, 가입일, 상태 (최대 10,000건 제한)

### 상세 페이지 (`/platform-admin/users/[userId]`)

- 프로필 카드: 이름, 이메일, 이미지, 가입일, 플랫폼 역할, 활성 상태
- 소속 조직 목록: Membership 기반, 조직명 + 조직 내 역할(OWNER/ADMIN/MEMBER)
- 최근 활동: AnalyticsEvent에서 해당 userId 최근 50건 (BUSINESS + FEATURE_USE)
- 역할 변경 / 활성화 버튼 (목록과 동일 기능 + 동일 보호 로직)

---

## 4. 조직 관리

### 목록 페이지 (`/platform-admin/organizations`)

- DataTable: 조직명, slug, 멤버 수, 프로젝트 수, 플랜, 상태, 생성일
- 검색: 조직명/slug
- 정렬: 멤버 수, 생성일
- 페이지네이션: 서버사이드 20건/페이지
- **프로젝트 수 (I2)**: `Organization → Membership → User → Project (assignee)` 또는 `Organization._count.memberships` + 별도 프로젝트 count 쿼리. 목록에서는 멤버 수만 표시, 프로젝트 수는 상세 페이지에서.

### 상세 페이지 (`/platform-admin/organizations/[orgId]`)

**탭 구조:**

1. **개요**: 기본 정보 카드 + 활동 통계 (org analytics API) + 프로젝트 수 (nested count)
2. **멤버**: 멤버 목록 테이블 (이름, 역할, 가입일)
3. **플랜/쿼터**: 플랜 변경(free/pro/enterprise), AI 호출 쿼터, 멤버 수 제한
4. **관리**: 조직 정지/해제 토글 + 확인 AlertDialog

### 플랜/쿼터

| 필드 | 기본값 | 설명 |
|------|--------|------|
| plan | "free" | free / pro / enterprise |
| quotaAiJobs | 100 | 월간 AI 작업 제한 |
| quotaMembers | 10 | 최대 멤버 수 |
| isSuspended | false | 정지 시 전원 접근 차단 |

**쿼터 적용은 이 서브시스템 범위 밖 (deferred)**. 현재는 값만 저장/표시. 실제 AI 작업 생성 시 쿼터 체크는 별도 follow-up으로 처리.

---

## 5. 스키마 변경

```prisma
// User 모델 추가
isActive    Boolean @default(true)

// Organization 모델 추가
plan         String  @default("free")
quotaAiJobs  Int     @default(100)
quotaMembers Int     @default(10)
isSuspended  Boolean @default(false)
```

마이그레이션: additive-only. 기존 모든 User는 `isActive=true`, 모든 Organization은 위 기본값 적용.

---

## 6. Auth 보안 — isActive / isSuspended 적용 (C1, C2 해결)

### isActive 적용

**문제**: `authorize()` 콜백은 Credentials provider만 실행됨. OAuth(Google) 사용자는 bypass.

**해결**: auth.ts에 `signIn` 콜백 추가 — 모든 provider(OAuth + Credentials)에서 실행:

```typescript
callbacks: {
  async signIn({ user }) {
    if (!user?.id) return true;
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true },
    });
    // isActive가 false면 로그인 차단
    if (dbUser && !dbUser.isActive) return false;
    return true;
  },
  // ... jwt, session 콜백 유지
}
```

**JWT 만료 대응**: 비활성화 후 기존 JWT가 유효한 동안 접근 가능한 문제.
- 해결: `dal.ts`의 `requireUser()`에서 `isActive` DB 체크 추가
- `requireUser()`는 모든 보호된 Server Component/API에서 호출되므로, 비활성화 즉시 적용
- 성능: React cache로 요청당 1회만 쿼리 (기존 패턴 유지)

```typescript
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  // DB에서 isActive 체크
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!dbUser?.isActive) return null; // 비활성 사용자 = 미인증 취급

  // ... 기존 로직
});
```

### isSuspended 적용

**문제**: Edge middleware는 DB 접근 불가. JWT에 넣으면 stale.

**해결**: `dal.ts`의 `requireOrg()`에서 체크:

```typescript
export async function requireOrg(): Promise<AuthUser & { orgId: string }> {
  const user = await requireUser();
  if (!user.orgId) redirect("/login");

  // org suspension 체크
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { isSuspended: true },
  });
  if (org?.isSuspended) redirect("/suspended"); // 정지 안내 페이지

  return user as AuthUser & { orgId: string };
}
```

- `requireOrg()`는 모든 org-scoped 페이지/API에서 호출됨 → 정지 즉시 적용
- `/suspended` 정적 페이지 추가 필요 (정지 안내 + 관리자 연락처)
- React cache로 요청당 1회만 쿼리

---

## 7. Middleware 보호 강화 (I3 해결)

### PROTECTED_PREFIXES 추가

```typescript
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/org", "/api/protected", "/platform-admin", "/api/admin"];
```

### authorized 콜백 platformRole 체크

```typescript
authorized({ auth, request }) {
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return true;
  if (!auth?.user) return false;

  // /platform-admin, /api/admin은 PLATFORM_ADMIN만 허용
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

---

## 8. 신규 API 엔드포인트

```
/api/admin/
  stats                   GET    플랫폼 통계 (총 조직/사용자/신규가입)
  users                   GET    사용자 목록 (?search=&role=&status=&page=&sort=)
  users/[userId]          GET    사용자 상세
  users/[userId]          PATCH  역할 변경, 활성화 변경
  users/export            GET    CSV 내보내기 (최대 10,000건)
  users/bulk              POST   일괄 역할 변경/비활성화
  organizations           GET    조직 목록 (?search=&sort=&page=)
  organizations/[orgId]   GET    조직 상세 (멤버 포함)
  organizations/[orgId]   PATCH  플랜/쿼터 변경, 정지/해제
```

모든 엔드포인트: `requirePlatformAdmin()` 필수.

### 페이지네이션 응답 형식 (I6 해결)

```typescript
{
  data: T[],
  pagination: {
    total: number,
    page: number,
    pageSize: number,
    totalPages: number
  }
}
```

### Zod 스키마 (I7 해결)

```typescript
// PATCH /api/admin/users/[userId]
const PatchUserSchema = z.object({
  platformRole: z.enum(["USER", "PLATFORM_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, "At least one field required");

// POST /api/admin/users/bulk
const BulkUserSchema = z.object({
  action: z.enum(["changeRole", "deactivate", "activate"]),
  userIds: z.array(z.string()).min(1).max(100),
  platformRole: z.enum(["USER", "PLATFORM_ADMIN"]).optional(), // changeRole 시 필수
});

// PATCH /api/admin/organizations/[orgId]
const PatchOrgSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  quotaAiJobs: z.number().int().min(0).optional(),
  quotaMembers: z.number().int().min(1).optional(),
  isSuspended: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, "At least one field required");
```

### Admin 역할 보호 로직 (I8 해결)

`PATCH /api/admin/users/[userId]` 에서:
- 본인 역할 변경 시도 → 400 "Cannot change own role"
- 마지막 PLATFORM_ADMIN 강등 시도 → 400 "Cannot demote the last platform admin"
  - 체크: `prisma.user.count({ where: { platformRole: "PLATFORM_ADMIN" } })` > 1

---

## 9. 신규 Aggregator 함수 (I1 해결)

```typescript
// apps/web/lib/analytics/aggregator.ts에 추가

/**
 * 정확한 WAU/MAU 계산 — COUNT(DISTINCT userId) over N-day window
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

---

## 10. 컴포넌트 구조

### 신규 컴포넌트

| 컴포넌트 | 위치 | 용도 |
|---------|------|------|
| `AdminSidebar` | `src/components/admin/admin-sidebar.tsx` | Admin 전용 사이드바 |
| `StatCard` | `src/components/admin/stat-card.tsx` | KPI 카드 (숫자 + 증감) |
| `TrendChart` | `src/components/admin/trend-chart.tsx` | Recharts 라인 차트 (use client) |
| `FeatureRankChart` | `src/components/admin/feature-rank-chart.tsx` | Recharts 바 차트 (use client) |
| `ActivityFeed` | `src/components/admin/activity-feed.tsx` | 최근 이벤트 테이블 (BUSINESS+FEATURE_USE) |
| `OrgLeaderboard` | `src/components/admin/org-leaderboard.tsx` | 조직 활동 순위 (DailyMetric 기반) |
| `AdminDataTable` | `src/components/admin/admin-data-table.tsx` | 검색/필터/페이지네이션 테이블 |

**ConfirmDialog**: 신규 생성 대신 shadcn/ui `AlertDialog` 활용.

### 패턴

- Server Component가 데이터 fetch → Client Component(차트/인터랙션)에 props 전달
- DataTable은 서버사이드 페이지네이션 (URL searchParams 기반)
- 뮤테이션(역할 변경 등)은 Server Actions 또는 fetch + revalidatePath

---

## 11. 기술 스택 추가

| 패키지 | 용도 | 설치 |
|--------|------|------|
| `recharts` | 차트 (LineChart, BarChart) | `npm install recharts` |

기존 패키지 활용:
- shadcn/ui — Card, Table, AlertDialog, DropdownMenu, Badge, Button, Input, Sheet, Tabs
- lucide-react — 아이콘
- zod — API 입출력 검증

---

## 12. 구현 페이즈 (S1 반영)

| 페이즈 | 범위 | 의존성 |
|--------|------|--------|
| A | 스키마 + Auth 보안 + Layout + 대시보드 (KPI + 차트) | 없음 |
| B | 사용자 관리 (목록 + 상세 + 역할/활성화 + 일괄 + CSV) | A |
| C | 조직 관리 (목록 + 상세 + 플랜/쿼터 + 정지) | A |

B와 C는 A 완료 후 병렬 진행 가능.

---

## 13. 제외 사항

- 가입 승인 워크플로우 → 서브시스템 #3 (Org Admin)
- 과금/결제 연동 → 별도 프로젝트
- 쿼터 적용(AI 작업 제한 등) → 별도 follow-up (현재는 값 저장/표시만)
- 실시간 WebSocket 대시보드 → 현재 폴링 기반, 필요시 추후 확장
- 감사 로그(audit log) 별도 모델 → 현재 AnalyticsEvent로 대체

---

## 14. 테스트 전략

- **Unit**: StatCard 렌더링, 숫자 포맷팅, 증감 계산, getActiveUsers 쿼리
- **Integration**: Admin API 권한 체크, 자기 강등 방지, 마지막 admin 보호, 페이지네이션, 비활성화 로그인 차단
- **수동**: 대시보드 차트 렌더링, DataTable 검색/필터/페이지네이션, 역할 변경 플로우, org 정지 플로우

---

## Appendix: 리뷰 반영 이력

| 리뷰 ID | 수정 내용 |
|---------|----------|
| C1 | signIn 콜백 isActive 체크 + getCurrentUser()에서 DB isActive 체크 |
| C2 | requireOrg()에서 isSuspended DB 체크 + /suspended 안내 페이지 |
| C3 | 마이그레이션 additive-only 확인, 기본값 명시 |
| I1 | getActiveUsers(days) 신규 aggregator — COUNT(DISTINCT userId) |
| I2 | 조직 목록에서 프로젝트 수 제외, 상세에서만 nested count |
| I3 | PROTECTED_PREFIXES에 /api/admin 추가, authorized에서 platformRole 체크 |
| I4 | KPI 데이터 소스 매핑 정확히 수정 |
| I5 | recharts 설치 명령 명시 |
| I6 | 페이지네이션 응답 형식 { data, pagination } 정의 |
| I7 | PatchUserSchema, BulkUserSchema, PatchOrgSchema Zod 스키마 정의 |
| I8 | 자기 강등 방지 + 마지막 admin 보호 로직 명세 |
| S1 | 구현 3페이즈(A/B/C) 분리 |
| S2 | 활동 피드를 BUSINESS+FEATURE_USE만 필터 |
| S3 | 리더보드를 DailyMetric 기반 7일 합산으로 변경 |
| S4 | CSV 내보내기 10,000건 제한 |
| S5 | ConfirmDialog → shadcn AlertDialog 활용 |
| S6 | 쿼터 적용은 deferred, 현재 값 저장만 |
