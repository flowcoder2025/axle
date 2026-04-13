# Event Tracking Infrastructure Design

> AXLE Admin 기능의 기반 — 서브시스템 #1/3
> 서브시스템 #2 (Super Admin 콘솔), #3 (Org Admin 확장)은 이 인프라 위에 구축

## Overview

AXLE 플랫폼 내부에서 사용자 행동, 비즈니스 메트릭, 시스템 상태를 자체 수집·저장·집계하는 이벤트 트래킹 인프라.

### 배경

- AXLE에 admin 대시보드(플랫폼 + 조직 레벨) 구축 필요
- GA4 대신 자체 트래킹 선택 — B2B 컨설팅 플랫폼 특성상 내부 데이터 조인이 핵심
- PostgreSQL 직접 저장 — Vercel serverless 환경에서 메모리 버퍼 불안정, 외부 서비스는 과잉

### Admin 전체 로드맵

| # | 서브시스템 | 상태 | 의존성 |
|---|-----------|------|--------|
| 1 | **이벤트 트래킹 인프라** (이 문서) | 설계 완료 | 없음 |
| 2 | Super Admin 콘솔 | 미착수 | #1 |
| 3 | Org Admin 확장 | 미착수 | #1 |

---

## 1. 이벤트 스키마

### AnalyticsEvent (Raw 이벤트)

```prisma
model AnalyticsEvent {
  id        String   @id @default(cuid())

  // WHO
  userId    String?
  orgId     String?
  sessionId String   // 익명 추적용 (로그인 전 포함)

  // WHAT
  category  EventCategory
  action    String         // "project.create", "ai.job.complete", "page./dashboard"
  label     String?        // 추가 컨텍스트 ("gpt-4o", "business_plan")
  value     Float?         // 수치 (비용, 소요시간ms 등)

  // WHERE
  path      String?        // URL path
  referrer  String?        // 이전 페이지

  // CONTEXT
  metadata  Json?          // 유연한 추가 데이터
  userAgent String?
  ip        String?        // HMAC-SHA256 해시 (IP_HASH_SECRET 사용)

  // WHEN
  createdAt DateTime @default(now())

  @@index([orgId, createdAt])
  @@index([category, createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@index([sessionId, createdAt])
}

enum EventCategory {
  PAGE_VIEW      // 페이지 방문
  FEATURE_USE    // 기능 사용 (버튼 클릭, CRUD 등)
  API_CALL       // API 요청/응답
  SYSTEM         // 에러, 자동화, 크롤러
  BUSINESS       // 프로젝트 생성, 매칭, AI 작업 완료
}
```

### DailyMetric (일별 집계 — 요약)

```prisma
model DailyMetric {
  id        String   @id @default(cuid())
  date      DateTime @db.Date
  orgId     String?  // null = 플랫폼 전체

  // 사용자 행동
  pageViews      Int @default(0)
  uniqueUsers    Int @default(0)
  sessions       Int @default(0)
  avgSessionSec  Int @default(0)

  // 비즈니스
  projectsCreated    Int @default(0)
  documentsProcessed Int @default(0)
  matchingsRun       Int @default(0)

  // AI
  aiJobsTotal     Int   @default(0)
  aiJobsCost      Float @default(0)
  aiAvgDurationMs Int   @default(0)

  // 시스템
  apiCalls           Int @default(0)
  apiErrors          Int @default(0)
  avgResponseMs      Int @default(0)
  automationRuns     Int @default(0)
  automationFailures Int @default(0)

  createdAt DateTime @default(now())

  @@unique([date, orgId])
  @@index([orgId, date])
}
```

### DailyActionMetric (일별 기능별 사용 빈도 — 정규화)

```prisma
model DailyActionMetric {
  id     String   @id @default(cuid())
  date   DateTime @db.Date
  orgId  String?  // null = 플랫폼 전체
  action String   // "project.create", "ai.job.complete" 등
  count  Int      @default(0)

  @@unique([date, orgId, action])
  @@index([orgId, date])
  @@index([action, date])
}
```

### PlatformRole (User 모델 확장)

```prisma
// User 모델에 추가
model User {
  // ... 기존 필드
  platformRole  PlatformRole @default(USER)
}

enum PlatformRole {
  USER           // 일반 사용자
  PLATFORM_ADMIN // 플랫폼 관리자
}
```

**Auth 연동 (C3 해결):**
- `packages/auth/src/auth.ts` JWT callback에 `platformRole` 추가 — sign-in 시 DB에서 조회하여 토큰에 포함
- session callback에 `platformRole` 노출 → 클라이언트에서 접근 가능
- `packages/auth/dal.ts`의 `AuthUser` 타입에 `platformRole` 추가
- 역할 변경 시 re-login 필요 (JWT는 immutable — 문서화된 제약)
- 최초 Super Admin은 seed 또는 DB 직접 설정 (UI 노출 안 함)

---

## 2. 이벤트 수집 레이어

### 수집 포인트 3가지

| 수집 방식 | 대상 | 구현 |
|----------|------|------|
| **클라이언트 `useTracker()`** | PAGE_VIEW + FEATURE_USE | `usePathname()` route change 감지로 PAGE_VIEW 자동 수집, 버튼/폼은 수동 호출 |
| **서버사이드 `trackEvent()`** | API_CALL, SYSTEM, BUSINESS | API Route에서 `after()` (Next.js 15+) 활용, 응답 후 비동기 기록 |
| **EventBus 구독** | BUSINESS | 기존 `eventBus`의 14개 비즈니스 이벤트 자동 수집 (이중 호출 방지) |

> **C1 해결**: Edge middleware에서 DB 접근 불가 → PAGE_VIEW를 클라이언트 `useTracker()`로 전환.
> Middleware는 sessionId 쿠키 발급만 담당 (DB 접근 없음).

### 데이터 흐름

```
Client (Browser)
  ├─ middleware.ts → sessionId 쿠키 발급만 (DB 접근 없음)
  └─ useTracker()
      ├─ usePathname() route change → PAGE_VIEW 자동
      ├─ track() 수동 호출 → FEATURE_USE
      ├─ 이벤트 큐에 축적
      └─ sendBeacon on unload / 30초 flush
            │
            ▼
      POST /api/analytics/track (batch, max 50건)
            │
            ▼
Server
  trackEvent(events[])
    ├─ Zod 입력 검증 (batch ≤ 50, body ≤ 100KB, sessionId CUID 포맷)
    ├─ Upstash Redis rate limit (sessionId 기준, 100 req/min)
    ├─ IP HMAC-SHA256 해시 (IP_HASH_SECRET)
    └─ prisma.analyticsEvent.createMany()

Server-side 직접 호출 (after() 활용, 응답 블로킹 없음):
  ├─ API Route → trackEvent() (응답시간, 에러)
  ├─ AI Job 완료 → trackEvent() (비용, 소요시간)
  └─ 자동화 → trackEvent() (성공/실패)

EventBus 구독 (자동):
  └─ eventBus.on("*") → BUSINESS 카테고리 이벤트 자동 기록
     (기존 DOC_UPLOADED, AI_JOB_COMPLETE 등 14개 이벤트)
```

### Middleware 역할 (축소)

- sessionId 쿠키만 관리: 없으면 `cuid()` 발급, 30분 만료
- DB 접근 없음, Edge 런타임 호환
- 대상 경로: `/(app)/**`, `/(portal)/**`, `/(marketing)/**`
- 제외: `/api/**`, `/_next/**`, 정적 파일

### useTracker() 클라이언트 훅

```typescript
const { track } = useTracker()

// PAGE_VIEW는 자동 (usePathname 변경 감지)
// FEATURE_USE는 수동 호출
track("feature_use", "project.create", { label: "from_dashboard" })

// 배치 전송: sendBeacon on unload + 30초 주기 flush
// sendBeacon 실패 시 localStorage 버퍼 → 다음 세션에서 재전송
```

**sendBeacon 실패 대응:**
- `sendBeacon()` 반환값 `false` 시 localStorage에 이벤트 저장
- 다음 페이지 로드 시 localStorage 버퍼를 먼저 전송
- localStorage 100건 초과 시 오래된 것부터 삭제 (데이터 유실 허용)

### 익명 → 로그인 전환 처리

- 로그인 전 이벤트는 `userId=null`, `orgId=null`, `sessionId`만 있음
- 로그인 성공 시 retroactive backfill **하지 않음** (known limitation)
- 이유: 한 sessionId에 여러 사용자가 공유 기기에서 사용할 수 있음, 잘못된 귀속 위험
- Org 레벨 통계에서 익명 이벤트는 제외됨 — 마케팅 페이지 트래픽은 플랫폼 전체 통계에서만 집계

---

## 3. 집계 전략

### 쿼리 패턴

| 대시보드 요청 | 데이터 소스 | 전략 |
|-------------|-----------|------|
| 오늘 실시간 현황 | `AnalyticsEvent` 직접 | `unstable_cache` 5분 TTL 캐시, raw 이벤트 GROUP BY |
| 최근 7/30/90일 트렌드 | `DailyMetric` | 사전 집계로 빠른 응답 |
| 특정 사용자 활동 로그 | `AnalyticsEvent` WHERE userId | 상세 추적, 인덱스 활용 |
| 기능별 사용 랭킹 | `DailyActionMetric` | 정규화된 테이블에서 SQL 집계 |
| 크로스 org 기능 채택률 | `DailyActionMetric` WHERE action | 특정 기능의 조직별 사용 현황 |

**"오늘" 쿼리 전략 (I2 해결):**
- DailyMetric에 오늘 데이터는 없음 (Cron이 03:00에 어제 데이터만 집계)
- 오늘 요약 = raw AnalyticsEvent에서 실시간 GROUP BY
- `unstable_cache` 5분 TTL로 캐시 → 대시보드 매 요청마다 full scan 방지
- 수백 개 org에서도 인덱스 `[orgId, createdAt]`로 빠른 필터링

### 집계 Cron Job

- 실행: 매일 03:00 KST
- 대상: 전일(어제) AnalyticsEvent
- 출력:
  - `DailyMetric` — 1행 (플랫폼 전체, orgId=null) + 조직별 N행
  - `DailyActionMetric` — 액션별 행 (플랫폼 + 조직별)
- 구현: Vercel Cron (`vercel.json`) → `/api/cron/aggregate-metrics`

### 데이터 보존

- `AnalyticsEvent`: 90일 보존 → Cron으로 자동 삭제
  - **배치 삭제**: `DELETE ... LIMIT 10000` 루프 (테이블 락 방지)
- `DailyMetric`, `DailyActionMetric`: 영구 보존 (행 수 미미)

---

## 4. API 구조 및 권한

### 엔드포인트

```
/api/analytics/
  ├─ track          POST   (rate limited, sessionId 기반)
  │
  ├─ /platform/     ← Super Admin 전용 (PLATFORM_ADMIN)
  │   ├─ overview   GET    전체 통계 요약
  │   ├─ users      GET    DAU/WAU/MAU 추이
  │   ├─ features   GET    기능별 사용 빈도
  │   ├─ system     GET    API 에러율, 응답시간, 자동화
  │   └─ ai         GET    AI 사용량/비용
  │
  └─ /org/          ← Org OWNER/ADMIN
      ├─ overview   GET    조직 통계 요약
      ├─ members    GET    멤버별 활동
      └─ usage      GET    기능 사용량
```

### track 엔드포인트 보호 (C2 해결)

| 보호 수단 | 상세 |
|----------|------|
| Batch 상한 | 1 요청당 최대 50 이벤트 |
| Body 크기 | 최대 100KB |
| sessionId 검증 | CUID 포맷 검증 (Zod regex) |
| Rate limit | Upstash Redis — sessionId 기준 100 req/min |
| 에러 응답 | 기존 `api-helpers.ts` 패턴: `{ error: { code, message } }` |

### 권한 체크

| 경로 | 체크 방식 |
|------|----------|
| `/api/analytics/track` | sessionId CUID 검증 + rate limit |
| `/api/analytics/platform/*` | `session.user.platformRole === PLATFORM_ADMIN` (JWT에서 읽음) |
| `/api/analytics/org/*` | `membership.role in [OWNER, ADMIN]` (DB 조회) |
| `/platform-admin/*` 페이지 | middleware에서 JWT `platformRole` 체크 → 403 리다이렉트 |

**Admin 페이지 URL (I7 해결):**
- Super Admin 페이지 URL prefix: `/platform-admin/`
- Next.js route group: `app/(admin)/platform-admin/`
- `auth.config.ts`의 `PROTECTED_PREFIXES`에 `/platform-admin` 추가
- Edge middleware에서 JWT의 `platformRole` 값으로 접근 제어 (DB 조회 불필요)

### 권한 헬퍼

```typescript
// packages/auth/dal.ts 확장
requirePlatformAdmin()  // JWT platformRole 체크 → 403
requireOrgAdmin()       // DB membership.role 체크 → 403
// 기존 getCurrentUser()에 platformRole 필드 추가
```

---

## 5. 파일 구조

### 신규 파일

```
apps/web/
  lib/analytics/
    tracker.ts                  trackEvent(), trackEvents() — 서버사이드 핵심 함수
    aggregator.ts               집계 쿼리 함수들 (today realtime, daily range)
    constants.ts                이벤트 액션명 상수, EventCategory 매핑
    rate-limit.ts               Upstash Redis rate limiter 설정
    event-bus-subscriber.ts     기존 eventBus 구독 → BUSINESS 이벤트 자동 수집

  hooks/
    use-tracker.ts              클라이언트 useTracker() 훅 (PAGE_VIEW 자동 + 수동 track)

  app/api/analytics/
    track/route.ts              POST — 이벤트 수집 (rate limited)
    platform/
      overview/route.ts         GET — 플랫폼 전체 요약
      users/route.ts            GET — DAU/WAU/MAU
      features/route.ts         GET — 기능별 사용 빈도
      system/route.ts           GET — API/자동화 메트릭
      ai/route.ts               GET — AI 사용량/비용
    org/
      overview/route.ts         GET — 조직 요약
      members/route.ts          GET — 멤버별 활동
      usage/route.ts            GET — 기능 사용량

  app/api/cron/
    aggregate-metrics/route.ts  Cron — 일별 집계 (DailyMetric + DailyActionMetric)
    cleanup-events/route.ts     Cron — 90일 초과 배치 삭제
```

### 기존 파일 수정

| 파일 | 변경 내용 |
|------|----------|
| `packages/db/prisma/schema.prisma` | +AnalyticsEvent, +DailyMetric, +DailyActionMetric, +PlatformRole enum, User.platformRole |
| `apps/web/middleware.ts` | +sessionId 쿠키 발급 로직 (DB 접근 없음) |
| `packages/auth/src/auth.ts` | JWT callback에 platformRole 추가, session callback에 노출 |
| `packages/auth/src/auth.config.ts` | PROTECTED_PREFIXES에 `/platform-admin` 추가 |
| `packages/auth/src/dal.ts` | AuthUser 타입에 platformRole, +requirePlatformAdmin(), +requireOrgAdmin() |
| `apps/web/lib/events/event-bus.ts` | BUSINESS 이벤트 구독 연결 (또는 instrumentation.ts에서) |
| `vercel.json` | Cron 스케줄 추가 (aggregate-metrics, cleanup-events) |

### 환경 변수 추가

| 변수 | 용도 |
|------|------|
| `IP_HASH_SECRET` | IP HMAC-SHA256 해시 키 (rotatable) |
| `UPSTASH_REDIS_REST_URL` | Rate limit용 Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limit용 Redis 토큰 |

---

## 6. 제외 사항 (서브시스템 #2, #3에서 처리)

- Admin 대시보드 UI 페이지 → 서브시스템 #2
- 회원 관리 CRUD UI → 서브시스템 #3
- 가입 승인 워크플로우 → 서브시스템 #3
- 플랜/구독/quota 관리 → 서브시스템 #2
- 퍼널 분석 시각화 → 서브시스템 #2

---

## 7. 테스트 전략

- **Unit**: `trackEvent()` 입력 검증, IP 해시, `aggregateDaily()` 집계 로직, rate limit 동작
- **Integration**: API Route 권한 체크 (platform/org 분리), Cron 집계 정합성, eventBus 구독
- **수동 검증**: useTracker PAGE_VIEW 자동 수집, sendBeacon 배치 전송, localStorage fallback

---

## 8. Known Limitations

| 제약 | 이유 | 영향 |
|------|------|------|
| 익명→로그인 시 retroactive backfill 없음 | 공유 기기 오귀속 위험 | 마케팅 페이지 트래픽은 플랫폼 전체에서만 집계 |
| platformRole 변경 시 re-login 필요 | JWT immutable | Super Admin 승격 후 재로그인 안내 필요 |
| "오늘" 통계는 5분 지연 | unstable_cache TTL | 실시간이 아닌 near-realtime |
| DB connection pool max=1 (Vercel serverless) | 기존 제약 | analytics write가 business query와 직렬화 |

---

## Appendix: 리뷰 반영 이력

| 리뷰 ID | 수정 내용 |
|---------|----------|
| C1 | PAGE_VIEW 수집을 Edge middleware → 클라이언트 useTracker()로 전환 |
| C2 | track 엔드포인트에 batch 상한/body 크기/rate limit/sessionId 검증 추가 |
| C3 | platformRole을 JWT callback + session에 추가, re-login 제약 문서화 |
| I1 | AnalyticsEvent에 sessionId 인덱스 추가 |
| I2 | "오늘" 쿼리 전략 명시 (raw event + unstable_cache 5분) |
| I3 | topActions JSON → DailyActionMetric 별도 모델로 정규화 |
| I4 | 익명→로그인 retroactive backfill 안 함, 이유 문서화 |
| I5 | IP 해시를 SHA-256 → HMAC-SHA256 + 서버 시크릿으로 변경 |
| I6 | analytics 로직을 apps/web/lib/analytics/로 통합 |
| I7 | admin URL prefix `/platform-admin/` 명시, PROTECTED_PREFIXES 추가 |
| S1 | 서버사이드 trackEvent에 after() 활용 명시 |
| S2 | 90일 삭제 Cron에 배치 삭제(10,000건 단위) 명시 |
| S3 | 에러 응답 형식 기존 api-helpers.ts 패턴 준수 명시 |
| S4 | useTracker sendBeacon 실패 시 localStorage fallback 추가 |
| S5 | 기존 eventBus 구독으로 BUSINESS 이벤트 자동 수집 |
