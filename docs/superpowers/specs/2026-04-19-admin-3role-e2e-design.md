# Admin 3권한 교차 E2E 설계

**작성일**: 2026-04-19
**목적**: platform / admin(owner) / employee(member) 권한 경계를 CI에서 회귀 감지
**범위**: 접근 경계 + ReBAC + 쓰기 차단 + Platform admin 운영 흐름 (S4 풀셋)

## 배경 및 동기

- 현재 E2E는 단일 계정(`E2E_USER_EMAIL`) 기반 CRUD 스모크에 그쳐 권한 회귀를 잡지 못함.
- `/platform-admin/*`, `/api/admin/*`, ReBAC 프로젝트 권한 5개 라우트가 수동 검증만 통과한 상태.
- 향후 SaaS 과금/화이트라벨/API 개방 진행 시 권한 경계가 더 복잡해지므로 안전망 선행 필요.

## 결정 요약

| 항목 | 선택 | 이유 |
|------|------|------|
| DB 전략 | **하이브리드** | 경계 검증은 prod(읽기), 파괴 동작은 ephemeral |
| 커버리지 | **S4 풀셋** | 접근+ReBAC+쓰기+Platform 운영 |
| 조직 구조 | **전용 E2E 조직 2개** | 실 데이터 오염 방지 + 크로스 조직 격리 검증 |
| CI 트리거 | **2단계** | 경계(모든 PR) + 쓰기(path filter/nightly) |

## 아키텍처

### 3권한 매핑

| 역할 | 시스템 | 조직 멤버십 | 용도 |
|------|--------|------------|------|
| **platform** | `SystemRole.PLATFORM_ADMIN` | 없음 | 전체 조직/사용자 관리 |
| **admin** | `SystemRole.USER` | `MemberRole.OWNER` | 자기 조직 관리 |
| **employee** | `SystemRole.USER` | `MemberRole.MEMBER` | 자기 담당 업무만 |

### Seed 확장 (`packages/db/seed.ts`)

기존 `org-1`(플로우코더 컨설팅) 유지, 하단에 E2E 섹션 추가.

**User 4명** (email 도메인 `@e2e.axleai.io`, password `test1234`)
- `e2e-platform` — `platform@e2e.axleai.io`, `systemRole: PLATFORM_ADMIN`, 조직 소속 없음
- `e2e-org1-owner` — `owner1@e2e.axleai.io`, org-e2e-1 OWNER
- `e2e-org1-member` — `member1@e2e.axleai.io`, org-e2e-1 MEMBER
- `e2e-org2-owner` — `owner2@e2e.axleai.io`, org-e2e-2 OWNER

**Organization 2개**
- `org-e2e-1` — "E2E 컨설팅 A" (slug: `e2e-consulting-a`)
- `org-e2e-2` — "E2E 컨설팅 B" (slug: `e2e-consulting-b`)

**도메인 데이터**
- Client: `client-e2e-1` (org-e2e-1 소속), `client-e2e-2` (org-e2e-2 소속)
- Project (org-e2e-1):
  - `project-e2e-1` — LEAD: e2e-org1-owner, MEMBER: e2e-org1-member
  - `project-e2e-2` — LEAD: e2e-org1-owner만 (member1은 접근 불가)
- Project (org-e2e-2): `project-e2e-3` — LEAD: e2e-org2-owner

**RelationTuple** (ReBAC)
- 조직 member/owner 관계
- 프로젝트 lead/member 관계

**격리 원칙**
- E2E 엔티티 ID는 모두 `*-e2e-*` prefix → 수동 필터링 가능
- Email 도메인 `@e2e.axleai.io`로 실 사용자와 명확히 분리

### E2E 헬퍼 (`e2e/helpers/`)

**`roles.ts`** (신규)
```ts
export type E2ERole = "platform" | "org1-owner" | "org1-member" | "org2-owner";

export const E2E_ACCOUNTS: Record<E2ERole, { email: string; password: string }> = {
  platform:      { email: process.env.E2E_PLATFORM_EMAIL!,     password: process.env.E2E_PLATFORM_PASSWORD! },
  "org1-owner":  { email: process.env.E2E_ORG1_OWNER_EMAIL!,   password: process.env.E2E_ORG1_OWNER_PASSWORD! },
  "org1-member": { email: process.env.E2E_ORG1_MEMBER_EMAIL!,  password: process.env.E2E_ORG1_MEMBER_PASSWORD! },
  "org2-owner":  { email: process.env.E2E_ORG2_OWNER_EMAIL!,   password: process.env.E2E_ORG2_OWNER_PASSWORD! },
};

export const E2E_IDS = {
  orgs: { org1: "org-e2e-1", org2: "org-e2e-2" },
  clients: { org1: "client-e2e-1", org2: "client-e2e-2" },
  projects: { memberShared: "project-e2e-1", ownerOnly: "project-e2e-2", org2: "project-e2e-3" },
} as const;
```

**`auth.ts`** (확장)
- `signInAs(page, role)` — role 기반 로그인
- 기존 `signInAsTestUser` → `signInAs(page, "org1-owner")` 래퍼로 유지 (후방 호환)

**Storage state 재사용**
- `playwright.config.ts`의 `globalSetup`에서 4역할 로그인 → `.playwright-auth/{role}.json` 저장
- 스펙에서 `test.use({ storageState: ".playwright-auth/platform.json" })`로 로드
- 테스트당 로그인 반복 제거 → 실행 시간 단축

### 테스트 시나리오

**태그 체계**: `@boundary`(prod read-only) / `@write`(ephemeral 파괴 가능)

#### A. `e2e/role-boundary.spec.ts` — @boundary

| # | 역할 | 동작 | 기대 |
|---|------|------|------|
| 1 | platform | `/platform-admin/users` 렌더 | 사용자 목록 표시 |
| 2 | platform | `/platform-admin/organizations` 렌더 | 조직 목록 표시 |
| 3 | org1-owner | `/platform-admin` 접근 | `/dashboard` 리다이렉트 또는 403 |
| 4 | org1-member | `/platform-admin` 접근 | `/dashboard` 리다이렉트 또는 403 |
| 5 | 비로그인 | `/platform-admin` 접근 | `/login` 리다이렉트 |
| 6 | org1-owner | `GET /api/admin/users` | 403 |
| 7 | org1-owner | `GET /api/admin/stats` | 403 |
| 8 | org1-member | `GET /api/admin/organizations` | 403 |

#### B. `e2e/cross-org-isolation.spec.ts` — @boundary

| # | 역할 | 동작 | 기대 |
|---|------|------|------|
| 1 | org1-owner | `/clients/client-e2e-2` (org2 소속) 직접 접근 | 404 또는 403 |
| 2 | org1-owner | `/projects/project-e2e-3` (org2 소속) 직접 접근 | 404 또는 403 |
| 3 | org1-owner | `/clients` 목록에 `client-e2e-2` 미표시 | 목록에 없음 |
| 4 | org2-owner | `/clients/client-e2e-1` (org1 소속) 직접 접근 | 404 또는 403 |
| 5 | org2-owner | `/projects/project-e2e-1` 접근 | 차단 |

#### C. `e2e/rebac-project-access.spec.ts` — @boundary

| # | 역할 | 동작 | 기대 |
|---|------|------|------|
| 1 | org1-member | `/projects/project-e2e-1` (MEMBER 등록됨) | 상세 렌더, 편집 버튼 disabled/숨김 |
| 2 | org1-member | `/projects/project-e2e-2` (비멤버) | 404/403 |
| 3 | org1-owner | `/projects/project-e2e-1` | 상세 렌더 + 편집 버튼 활성화 |
| 4 | org1-member | `PATCH /api/projects/project-e2e-2` | 403 |

#### D. `e2e/role-write-actions.spec.ts` — @write (ephemeral)

| # | 역할 | 동작 | 기대 |
|---|------|------|------|
| 1 | org1-member | 다른 사람 LEAD 프로젝트 `DELETE /api/projects/project-e2e-2` | 403 |
| 2 | org1-member | `POST /api/admin/organizations/{org}/members` | 403 |
| 3 | org1-owner | 자기 조직 client CRUD (create → edit → delete) | 모두 성공, UI 반영 |
| 4 | platform | 신규 조직 생성 폼 제출 (`/platform-admin/organizations/new`) | 목록에 반영 |
| 5 | platform | 사용자 suspend (`POST /api/admin/users/bulk` action=suspend) | 해당 사용자 로그인 차단 |
| 6 | platform | 사용자 unsuspend | 로그인 복구 |
| 7 | platform | 다른 조직 상세 진입 (`/platform-admin/organizations/org-e2e-1`) | 조직 메타/멤버 표시 |
| 8 | platform | 사용자 bulk export CSV (`/api/admin/users/export`) | CSV 다운로드 성공, 행 수 > 0 |

**시나리오 총 합계**: @boundary 17개 / @write 8개 = 25개

### CI 워크플로우

#### `.github/workflows/e2e-boundary.yml` (신규)

```yaml
name: E2E Boundary Tests

on:
  pull_request:
  workflow_dispatch:

jobs:
  boundary:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      NODE_OPTIONS: --max-old-space-size=4096
      E2E_BASE_URL: https://axleai.io
      E2E_PLATFORM_EMAIL: ${{ secrets.E2E_PLATFORM_EMAIL }}
      E2E_PLATFORM_PASSWORD: ${{ secrets.E2E_PLATFORM_PASSWORD }}
      E2E_ORG1_OWNER_EMAIL: ${{ secrets.E2E_ORG1_OWNER_EMAIL }}
      E2E_ORG1_OWNER_PASSWORD: ${{ secrets.E2E_ORG1_OWNER_PASSWORD }}
      E2E_ORG1_MEMBER_EMAIL: ${{ secrets.E2E_ORG1_MEMBER_EMAIL }}
      E2E_ORG1_MEMBER_PASSWORD: ${{ secrets.E2E_ORG1_MEMBER_PASSWORD }}
      E2E_ORG2_OWNER_EMAIL: ${{ secrets.E2E_ORG2_OWNER_EMAIL }}
      E2E_ORG2_OWNER_PASSWORD: ${{ secrets.E2E_ORG2_OWNER_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --grep @boundary
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-boundary-trace
          path: test-results/
```

**특징**
- prod `axleai.io`에 read-only로 붙음 (CI secret에 DATABASE_URL 없음 → 쓰기 불가)
- 런타임 목표: ~90초
- 필수 체크로 브랜치 보호 규칙 등록

#### `.github/workflows/e2e-write.yml` (신규, 기존 `e2e.yml` 흡수)

```yaml
name: E2E Write Tests (ephemeral)

on:
  pull_request:
    paths:
      - 'apps/web/app/(admin)/**'
      - 'apps/web/app/api/admin/**'
      - 'apps/web/lib/admin/**'
      - 'packages/auth/**'
      - 'packages/db/prisma/schema.prisma'
      - 'packages/db/seed.ts'
      - '.github/workflows/e2e-write.yml'
  schedule:
    - cron: '0 17 * * *'  # 02:00 KST
  workflow_dispatch:

jobs:
  write:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: axle_e2e }
        ports: [5432:5432]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/axle_e2e
      DIRECT_URL: postgres://postgres:postgres@localhost:5432/axle_e2e
      NEXTAUTH_SECRET: test-secret-for-e2e
      AUTH_SECRET: test-secret-for-e2e
      NEXTAUTH_URL: http://localhost:3000
      AUTH_URL: http://localhost:3000
      E2E_BASE_URL: http://localhost:3000
      # E2E 계정 이메일은 seed가 생성한 고정값 사용 (secret 불필요)
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx prisma generate --schema=packages/db/prisma/schema.prisma
      - run: npx prisma db push --schema=packages/db/prisma/schema.prisma --skip-generate
      - run: npx tsx packages/db/seed.ts
      - run: npx turbo build --filter=web
      - run: npm run -w apps/web start &
      - run: npx wait-on http://localhost:3000
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --grep "@write|@smoke"
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-write-trace
          path: test-results/
```

**특징**
- ephemeral postgres → seed → web 기동 → 테스트
- E2E 계정 ENV는 seed의 고정 email로 자동 주입 (workflow env에 기본값 세팅)
- `@write` + `@smoke` (기존 client-crud/project-crud/meeting-crud 흡수) 실행
- 런타임 목표: ~5분
- prod DB에 절대 접근 안 함

#### 기존 `e2e.yml` 처리
- 내용을 `e2e-write.yml`에 흡수
- 삭제 또는 주석 처리 후 deprecate — 동일 스펙이 `@smoke` 태그로 이전

### 장애/플래키 대응

**storageState 만료**
- `globalSetup`이 매 실행 재생성 → 세션 만료 원천 차단

**Prod E2E 계정 변조**
- 실수로 운영자가 E2E 계정 삭제/suspend 시 @boundary 전체 fail
- 완화책: `e2e-boundary.yml` 첫 단계에서 platform 계정 로그인 선검증, 실패 시 명확한 에러 메시지 + seed 재주입 안내 (`tsx packages/db/seed.ts`)

**ephemeral DB 격리**
- `services.postgres`는 job 종료 시 자동 소멸
- seed.ts의 `cleanDatabase()`는 ephemeral에서 안전 (실 데이터 없음)
- 실수로 prod DATABASE_URL이 job에 유출되지 않도록 `e2e-write.yml`에서 secret 참조 금지 (env에 하드코딩된 localhost만)

**Nightly 실패 알림**
- `schedule` 트리거 실패 시 GitHub Actions 기본 알림으로 충분 (이메일)
- 추후 Slack 웹훅 추가 가능

## 수용 기준 (Acceptance Criteria)

- [ ] `packages/db/seed.ts` 실행 시 E2E 섹션 4 users / 2 orgs / 3 projects / relation tuples 생성
- [ ] `e2e/helpers/roles.ts` + `signInAs()` 구현, 기존 `signInAsTestUser` 후방 호환 유지
- [ ] `playwright.config.ts` globalSetup에서 4역할 storageState 저장
- [ ] @boundary 17개 시나리오 작성 및 로컬 통과
- [ ] @write 8개 시나리오 작성 및 ephemeral DB에서 통과
- [ ] `.github/workflows/e2e-boundary.yml` 신규 — PR에서 ~90초 내 완료
- [ ] `.github/workflows/e2e-write.yml` 신규 — path filter + nightly + manual, ~5분 내 완료
- [ ] 기존 `e2e.yml` 제거 또는 흡수
- [ ] prod Supabase에 E2E seed 주입 완료 (owner1/member1/owner2/platform 계정 로그인 가능 확인)
- [ ] GitHub secrets 8개 등록 (`E2E_{ROLE}_EMAIL/PASSWORD`)
- [ ] PR 브랜치 보호 규칙에 `e2e-boundary` 필수 체크 추가

## 범위 외 (Out of Scope)

- 3권한 외 추가 역할 (예: CLIENT 포털 사용자) — 별도 스펙
- 성능 테스트, 부하 테스트
- Impersonate/masquerade 기능 (구현 안 되어 있으면 시나리오 D-7에서 단순 조직 진입으로 대체)
- Slack 알림 연동 — 후속 과제
