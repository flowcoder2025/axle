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
| DAU / WAU / MAU | `/api/analytics/platform/users` | 숫자 + 전일 대비 증감 % |
| 페이지뷰 / 세션 | `/api/analytics/platform/overview` | today.pageViews, today.sessions |
| AI 작업 / 비용 | `/api/analytics/platform/ai` | totals.aiJobsTotal, totals.aiJobsCost |
| 총 조직 / 사용자 | `/api/admin/stats` (신규) | DB count 직접 |
| API 에러율 / 응답시간 | `/api/analytics/platform/system` | totals.apiErrors / totals.apiCalls |
| 비즈니스 활동 | `/api/analytics/platform/overview` | today 기준 집계 |

### 차트 + 위젯 (하단, 2열 그리드)

| 위치 | 위젯 | 구현 |
|------|------|------|
| 좌상 | 7/30일 트렌드 라인 차트 | Recharts LineChart, 기간 토글 버튼 |
| 우상 | 기능 사용 랭킹 바 차트 | Recharts BarChart, 상위 10개 |
| 좌하 | 최근 활동 피드 | 최근 50건 AnalyticsEvent 테이블 |
| 우하 | 조직별 활동 리더보드 | 조직별 이벤트 수 상위 10개 |

### 데이터 패턴

- KPI 카드: Server Component에서 직접 fetch (API internal call 또는 Prisma 직접)
- 차트: Client Component (`"use client"`) — Recharts 필수. 데이터는 부모 Server Component에서 props 전달
- 기간 토글: 클라이언트 state로 관리, fetch on change

---

## 3. 사용자 관리

### 목록 페이지 (`/platform-admin/users`)

- DataTable: 이름, 이메일, 플랫폼 역할, 소속 조직, 가입일, 활성 상태
- 검색: 이름/이메일 텍스트 검색
- 필터: 플랫폼 역할 (USER/PLATFORM_ADMIN), 활성 상태
- 정렬: 가입일, 이름
- 페이지네이션: 서버사이드 (cursor 또는 offset, 20건/페이지)
- 행 클릭 → 상세 페이지 이동

### 인라인 액션

- 플랫폼 역할 변경: DropdownMenu (USER ↔ PLATFORM_ADMIN), 확인 Dialog
- 활성/비활성 토글: Switch 컴포넌트, 확인 Dialog

### 일괄 작업

- 체크박스 선택 → 툴바 노출: CSV 내보내기, 역할 일괄 변경, 일괄 비활성화
- CSV: 이름, 이메일, 역할, 조직, 가입일, 상태

### 상세 페이지 (`/platform-admin/users/[userId]`)

- 프로필 카드: 이름, 이메일, 이미지, 가입일, 플랫폼 역할, 활성 상태
- 소속 조직 목록: Membership 기반, 조직명 + 조직 내 역할(OWNER/ADMIN/MEMBER)
- 최근 활동: AnalyticsEvent에서 해당 userId 최근 50건 테이블
- 역할 변경 / 활성화 버튼 (목록과 동일 기능)

---

## 4. 조직 관리

### 목록 페이지 (`/platform-admin/organizations`)

- DataTable: 조직명, slug, 멤버 수, 프로젝트 수, 플랜, 상태, 생성일
- 검색: 조직명/slug
- 정렬: 멤버 수, 생성일
- 페이지네이션: 서버사이드 20건/페이지

### 상세 페이지 (`/platform-admin/organizations/[orgId]`)

**탭 구조:**

1. **개요**: 기본 정보 카드 + 활동 통계 (org analytics API)
2. **멤버**: 멤버 목록 테이블 (이름, 역할, 가입일)
3. **플랜/쿼터**: 플랜 변경(free/pro/enterprise), AI 호출 쿼터, 멤버 수 제한
4. **관리**: 조직 정지/해제 토글

### 플랜/쿼터

| 필드 | 기본값 | 설명 |
|------|--------|------|
| plan | "free" | free / pro / enterprise |
| quotaAiJobs | 100 | 월간 AI 작업 제한 |
| quotaMembers | 10 | 최대 멤버 수 |
| isSuspended | false | 정지 시 전원 접근 차단 |

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

### Auth 연동

- `isActive === false` → 로그인 차단 (auth.ts authorize 콜백에서 체크)
- `isSuspended === true` → 해당 org 멤버 전원 접근 차단 (middleware 또는 dal.ts에서 체크)

---

## 6. 신규 API 엔드포인트

```
/api/admin/
  stats                   GET    플랫폼 통계 (총 조직/사용자/신규가입)
  users                   GET    사용자 목록 (?search=&role=&status=&page=&sort=)
  users/[userId]          GET    사용자 상세
  users/[userId]          PATCH  역할 변경, 활성화 변경
  users/export            GET    CSV 내보내기
  users/bulk              POST   일괄 역할 변경/비활성화
  organizations           GET    조직 목록 (?search=&sort=&page=)
  organizations/[orgId]   GET    조직 상세 (멤버 포함)
  organizations/[orgId]   PATCH  플랜/쿼터 변경, 정지/해제
```

모든 엔드포인트: `requirePlatformAdmin()` 필수.

---

## 7. 컴포넌트 구조

### 신규 공통 컴포넌트

| 컴포넌트 | 위치 | 용도 |
|---------|------|------|
| `AdminSidebar` | `src/components/admin/admin-sidebar.tsx` | Admin 전용 사이드바 |
| `StatCard` | `src/components/admin/stat-card.tsx` | KPI 카드 (숫자 + 증감) |
| `TrendChart` | `src/components/admin/trend-chart.tsx` | Recharts 라인 차트 |
| `FeatureRankChart` | `src/components/admin/feature-rank-chart.tsx` | Recharts 바 차트 |
| `ActivityFeed` | `src/components/admin/activity-feed.tsx` | 최근 이벤트 테이블 |
| `OrgLeaderboard` | `src/components/admin/org-leaderboard.tsx` | 조직 활동 순위 |
| `AdminDataTable` | `src/components/admin/admin-data-table.tsx` | 검색/필터/페이지네이션 테이블 |
| `ConfirmDialog` | `src/components/admin/confirm-dialog.tsx` | 위험 작업 확인 다이얼로그 |

### 패턴

- Server Component가 데이터 fetch → Client Component(차트/인터랙션)에 props 전달
- DataTable은 서버사이드 페이지네이션 (URL searchParams 기반)
- 뮤테이션(역할 변경 등)은 Server Actions 또는 fetch + revalidatePath

---

## 8. 기술 스택 추가

| 패키지 | 용도 |
|--------|------|
| `recharts` | 차트 (LineChart, BarChart) |

기존 패키지 활용:
- shadcn/ui — Card, Table, Dialog, DropdownMenu, Badge, Button, Input, Sheet
- lucide-react — 아이콘
- zod — API 입출력 검증

---

## 9. 제외 사항

- 가입 승인 워크플로우 → 서브시스템 #3 (Org Admin)
- 과금/결제 연동 → 별도 프로젝트
- 실시간 WebSocket 대시보드 → 현재 폴링 기반, 필요시 추후 확장
- 감사 로그(audit log) 별도 모델 → 현재 AnalyticsEvent로 대체

---

## 10. 테스트 전략

- **Unit**: StatCard 렌더링, 숫자 포맷팅, 증감 계산
- **Integration**: Admin API 권한 체크, 목록 쿼리 파라미터 검증
- **수동**: 대시보드 차트 렌더링, DataTable 검색/필터/페이지네이션, 역할 변경 플로우
