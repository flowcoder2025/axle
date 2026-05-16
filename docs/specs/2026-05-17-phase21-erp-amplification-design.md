# Phase 21 — ERP Amplification (Counterparty + Chart of Accounts + Reporting) Design

- **Status**: Approved (사용자 승인 2026-05-17) — v2.1 (3-reviewer feedback 반영: backend-architect / evaluator / feasibility-analyst)
- **Author**: flowcoder25 (Jerome)
- **Phase 20 종속**: ERP intake 워크플로우 (Product/InventoryMovement/Order/OrderItem/IntakeDraft) 가동 위에 구축
- **목표 기간**: 5~7주 (WI 19건, M1 11 + M2 8). M1 머지 후 1주 dogfooding 윈도우.

## 0. Prerequisites

- Phase 20 active 24/24 E2E green (이전 머지: c0d40cc, 110f62f)
- versioned migrations 도입 완료 (PR #197, d7372dd) — 모든 schema 변경은 `prisma migrate dev` 강제
- prod DB에 baseline_resolve 액션 적용 완료 가정 (사용자 후 액션)
- Supabase Postgres `pg_trgm` extension 사전 활성화 검증 (WI-724a-prep) — **pg_bigm은 self-host만 가능, Supabase에서 미지원**

## 1. Goals

1. ERP intake로 쌓인 거래 데이터를 **분석/리포트 가능한 상태**로 정규화
2. 거래처를 자유 텍스트 snapshot에서 **마스터 엔티티 (ErpCounterparty)** 로 승격
3. 한국 세무 표준 계정과목(메이저 ~30) 도입 → 모든 거래 라인이 계정과목 1개로 분류
4. 컨설팅 산출물 수준의 **DOCX/PDF 리포트 3종** 자동 생성

## 2. Non-Goals (Phase 22+로 이관)

- 부가세 신고서 자동 생성, 전자세금계산서 발행
- 다국가/다언어 COA, 외화 거래
- COA 자동 분류 정확도 ≥90% (Phase 21은 75% SLO)
- 실시간 리포트 (Phase 21은 daily refresh materialized view 기반)
- 외부 워커 (Render/Railway) 인프라 — WI-731-poc 결과에 따라 결정

## 3. Architecture

### 3.1 데이터 흐름

```
Receipt → IntakeDraft (Phase 20)
            │
            │  AI: suggestedCoaCode 채움 (WI-727)
            ▼
        User Confirm
            │
            │  resolver: OrderItem > Product > Counterparty.default (WI-726)
            │  + ErpCounterparty upsert/match (WI-723c)
            ▼
        Order + OrderItem (FK to ErpCounterparty + coaCode)
            │
            │  (daily refresh)
            ▼
    mv_erp_monthly_summary (WI-728-prep)
            │
            ├─ 거래처별 매출/매입 (WI-728)
            ├─ 손익계산서 간이판 (WI-729)
            └─ DOCX/PDF 비동기 jobId (WI-731)
```

### 3.2 SSOT 우선순위 (COA)

```
OrderItem.coaCode (명시) > Product.coaCode (기본) > ErpCounterparty.defaultCoa (fallback)
```

OrderItem 생성 시 service layer가 resolve해서 **OrderItem.coaCode를 항상 채움**. 리포트 쿼리는 단일 컬럼만 본다 (성능 + 단순성).

### 3.3 ReBAC scope (WI-722 시점부터 적용)

| Scope | Read | Write | Notes |
|---|---|---|---|
| `erp:counterparty:read` | ✓ | — | 모든 멤버 (READ_ONLY 이상) |
| `erp:counterparty:write` | — | ✓ | OWNER + ADMIN |
| `erp:counterparty:merge` | — | ✓ | OWNER만 (파괴적) |
| `erp:coa:write` | — | ✓ | OWNER + ADMIN |
| `erp:reports:read` | ✓ | — | 모든 멤버 |

기존 `erp:read/write`와의 매핑: admin role에 일괄 grant.

## 4. Data Model

### 4.1 ErpCounterparty (신규)

```prisma
model ErpCounterparty {
  id              String   @id @default(cuid())
  orgId           String
  name            String                              // 표시명
  normalizedName  String                              // NFC + 공백/접두접미 제거 (검색 키)
  bizRegNo        String?                             // 사업자등록번호 (10자리, optional)
  address         String?
  contactName     String?
  contactPhone    String?
  contactEmail    String?
  type            CounterpartyType                    // CUSTOMER | SUPPLIER | BOTH
  defaultCoaCode  String?                             // ChartOfAccounts.code fallback
  deletedAt       DateTime?                           // soft-delete (머지된 source row)
  mergedIntoId    String?                             // 머지된 경우 target id
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  orders          Order[]
  mergeLogsFrom   CounterpartyMergeLog[] @relation("mergeFrom")
  mergeLogsInto   CounterpartyMergeLog[] @relation("mergeInto")

  @@index([orgId, normalizedName])
  @@index([orgId, type])
  // partial unique: bizRegNo가 있는 row끼리만 unique (NULL은 중복 허용)
  // Prisma 7 schema는 raw SQL로 작성 (migration.sql에 직접 추가)
  // CREATE UNIQUE INDEX "ErpCounterparty_orgId_bizRegNo_uniq"
  //   ON "ErpCounterparty"("orgId", "bizRegNo") WHERE "bizRegNo" IS NOT NULL;
}

enum CounterpartyType {
  CUSTOMER
  SUPPLIER
  BOTH
}
```

### 4.2 ChartOfAccounts (신규)

```prisma
model ChartOfAccounts {
  id            String   @id @default(cuid())
  orgId         String                               // org-scoped (사용자 추가 가능)
  code          String                               // "608", "452", "811" 등
  name          String                               // "매출", "원료매입", "소모품비"
  category      CoaCategory                          // REVENUE | COGS | OPEX | NON_OPERATING | OTHER
  parentCode    String?                              // 계층 (depth 2~3)
  source        String                               // "국세청 표준재무제표 v2024" 등
  effectiveFrom DateTime @default(now())
  effectiveTo   DateTime?
  isSystem      Boolean  @default(false)             // seed 데이터는 true (사용자 수정 불가)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([orgId, code])
  @@index([orgId, category])
}

enum CoaCategory {
  REVENUE         // 매출
  COGS            // 매출원가
  OPEX            // 판매관리비
  NON_OPERATING   // 영업외손익
  OTHER
}
```

### 4.3 CounterpartyMergeLog (신규)

```prisma
model CounterpartyMergeLog {
  id             String   @id @default(cuid())
  orgId          String
  mergedFromId   String                              // source (soft-deleted)
  mergedIntoId   String                              // target (kept)
  orderCount     Int                                 // 재포인팅된 Order 수
  performedBy    String                              // userId
  reason         String
  performedAt    DateTime @default(now())

  mergedFrom     ErpCounterparty @relation("mergeFrom", fields: [mergedFromId], references: [id])
  mergedInto     ErpCounterparty @relation("mergeInto", fields: [mergedIntoId], references: [id])

  @@index([orgId, performedAt])
}
```

### 4.4 CounterpartyBackfillBatch (신규)

체크포인트 — WI-723b 백필이 부분 중단되면 재시작 시 SKIP 처리 (R1).

```prisma
model CounterpartyBackfillBatch {
  id              String         @id @default(cuid())
  orgId           String
  status          BackfillStatus // PENDING | RUNNING | COMPLETED | FAILED
  totalOrders     Int            @default(0)
  processedOrders Int            @default(0)
  matchedCount    Int            @default(0)
  pendingReview   Int            @default(0)        // 자동 매칭 실패 (bizRegNo 없음 등)
  lastOrderId     String?                            // 마지막 처리 Order.id (재시작 키)
  startedAt       DateTime       @default(now())
  completedAt     DateTime?
  notes           String?

  @@index([orgId, status])
}

enum BackfillStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

### 4.5 기존 모델 변경

```prisma
// Order: counterpartyId String? → FK
model Order {
  // ... 기존 필드 ...
  counterparty   ErpCounterparty? @relation(fields: [counterpartyId], references: [id])
  // counterpartyId는 nullable 유지 (백필 실패 row 보호). FK는 ON DELETE RESTRICT.
  // FK 추가는 WI-723a (NOT VALID) → WI-723c (VALIDATE) 2단계.
}

// Product: coaCode 추가
model Product {
  // ... 기존 필드 ...
  coaCode  String?  // ChartOfAccounts.code (default)
  @@index([orgId, coaCode])
}

// OrderItem: coaCode 추가 (resolver가 채움)
model OrderItem {
  // ... 기존 필드 ...
  coaCode  String?  // 명시값 / Product.coaCode / Counterparty.defaultCoa 순으로 resolve
  @@index([orgId, coaCode, lineTotal])    // 손익계산서 집계 (orgId는 Order join 필요 — denormalize)
}

// IntakeDraft: AI 제안 필드 + confirm 동시성 보호 (R4)
model IntakeDraft {
  // ... 기존 필드 ...
  suggestedCoaCodes Json?      // [{ lineIndex: 0, coaCode: "608", confidence: 0.92 }]
  confirmedAt       DateTime?  // 동시 confirm 방지 (NULL → 한 번만 처리 가능)
  confirmedBy       String?
}
```

`@@index` for `OrderItem(orgId, coaCode, ...)` requires denormalizing `orgId` to `OrderItem` (현재 Order에만 있음). WI-728-prep에서 함께 처리.

### 4.6 Materialized View (WI-728-prep)

```sql
CREATE MATERIALIZED VIEW mv_erp_monthly_summary AS
SELECT
  o."orgId",
  EXTRACT(YEAR FROM o."occurredAt")::INT  AS year,
  EXTRACT(MONTH FROM o."occurredAt")::INT AS month,
  o."counterpartyId",
  oi."coaCode",
  o."type",                                          -- SALE | PURCHASE
  SUM(oi."lineTotal")                     AS total_amount,
  SUM(oi."qty")                           AS total_qty,
  COUNT(*)                                AS line_count
FROM "Order" o
JOIN "OrderItem" oi ON oi."orderId" = o."id"
WHERE o."status" = 'CONFIRMED'
GROUP BY o."orgId", year, month, o."counterpartyId", oi."coaCode", o."type";

CREATE UNIQUE INDEX mv_erp_monthly_summary_uniq
  ON mv_erp_monthly_summary("orgId", year, month, "counterpartyId", "coaCode", "type");

-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_erp_monthly_summary;  (daily cron)
```

UNIQUE INDEX는 `CONCURRENTLY` refresh의 전제조건 (R5).

### 4.7 추가 인덱스

```sql
-- WI-728~730 P50 < 500ms 달성용
CREATE INDEX "Order_orgId_occurredAt_type_idx"
  ON "Order"("orgId", "occurredAt", "type") INCLUDE ("counterpartyId", "total");
CREATE INDEX "InventoryMovement_orgId_productId_occurredAt_idx"
  ON "InventoryMovement"("orgId", "productId", "occurredAt" DESC);
```

## 5. WI 분할 (총 19건)

### M1 — Master Data (11 WI)

| WI | 타입 | 내용 | Acceptance Criteria (검증 가능, 3+) |
|---|---|---|---|
| 721 | feat | ErpCounterparty + ChartOfAccounts + CounterpartyMergeLog + CounterpartyBackfillBatch Prisma model + migration | (1) `prisma migrate dev` 성공, 4 모델 생성, partial unique 인덱스 raw SQL 포함 (2) `npx prisma migrate diff --exit-code` drift 0 (3) RED 케이스: bizRegNo NULL 2개 row 삽입 시 unique 위반 없음 |
| 722 | feat | ErpCounterparty CRUD API `/api/erp/counterparties` + ReBAC `erp:counterparty:read/write` scope 등록 | (1) GET/POST/PATCH/DELETE 4 라우트 + Zod 검증 + ReBAC 게이트 (2) Multi-org 스코프: 다른 org 데이터 조회 시 404 (3) RED 케이스: write scope 없는 사용자의 POST → 403 |
| 723a | feat | Order.counterpartyId FK constraint NOT VALID로 추가 (nullable 유지) | (1) migration이 prod DB에서 즉시 적용 가능 (테이블 락 없음) (2) 기존 row 변경 없음 (3) RED 케이스: 존재하지 않는 ErpCounterparty.id로 Order 생성 → P2003 |
| 723b | feat | CounterpartyBackfillBatch 기반 백필 스크립트 (dry-run + 1k chunk + 재시작 SKIP) + admin staging UI | (1) `--dry-run` 모드: 매칭 결과 JSON 출력, DB 변경 없음 (2) 1k chunk per transaction + advisory lock + lastOrderId 체크포인트 (3) bizRegNo 없는 row는 자동 머지 금지 — staging UI에 "pending review" 노출 (4) RED 케이스: 100k Order row에서 중단 후 재실행 시 SKIP 처리 검증 |
| 723c | feat | FK VALIDATE CONSTRAINT + 작성 경로 전환 (intake/confirm, orders POST) + 배포 윈도우 명시 | (1) `ALTER TABLE ... VALIDATE CONSTRAINT`이 statement_timeout 내 완료 (2) 신규 Order는 ErpCounterparty.id 필수 (NULL 불가 — service layer에서 강제 upsert) (3) counterpartyName snapshot은 historical 표시용으로 유지 (4) RED 케이스: 신규 Order POST에 counterpartyId 없을 때 400 |
| 724a-prep | chore | Supabase Postgres pg_trgm extension 가용성 검증 + ErpCounterparty.normalizedName GIN 인덱스 | (1) `CREATE EXTENSION IF NOT EXISTS pg_trgm` 실행 (baseline migration에 추가 or 별도 SQL) (2) GIN 인덱스 생성: `USING gin (normalized_name gin_trgm_ops)` (3) `EXPLAIN ANALYZE`로 인덱스 사용 확인 |
| 724a | feat | 한국어 fuzzy 검색 API `/api/erp/counterparties/search?q=...` | (1) "(주)에이비씨" 검색에 "에이비씨", "ABC상사" 등 유사도 ≥0.3 결과 (2) 응답 ≤200ms (10k row 기준) (3) RED 케이스: 빈 쿼리 → 400 |
| 724b | feat | 중복 감지 read-only 리포트 `/api/erp/counterparties/duplicates` | (1) bizRegNo 동일 + name 유사도 ≥0.7 묶음 출력 (2) 응답에 머지 제안 페어 + 각 row의 Order 카운트 포함 (3) RED 케이스: 빈 결과 시 200 + empty array |
| 724c | feat | 머지 API `/api/erp/counterparties/:id/merge` + CounterpartyMergeLog + advisory lock + `erp:counterparty:merge` 권한 | (1) `SELECT ... FOR UPDATE` on source/target + `pg_advisory_xact_lock` (2) Order.counterpartyId 일괄 재포인팅 (단일 트랜잭션) (3) source는 soft-delete (`deletedAt` set + `mergedIntoId` set) (4) CounterpartyMergeLog row 생성 (5) RED 케이스: merge 권한 없는 사용자 → 403, 동시 머지 시 두 번째 호출 conflict |
| 725 | feat | ChartOfAccounts model + seed (한국 세무 표준 ~30 과목, 출처 "국세청 표준재무제표 v2024") + CRUD API | (1) seed 후 isSystem=true row 30+ 생성 (2) 사용자 추가는 `erp:coa:write`, isSystem=false (3) seed row 수정/삭제 시 400 (4) RED 케이스: 동일 orgId+code 중복 INSERT → P2002 |
| 726 | feat | Product.coaCode + OrderItem.coaCode + SSOT resolver (service layer) | (1) `resolveCoaCode({ orderItemCoa, productCoa, counterpartyDefaultCoa })` 함수 + 단위 테스트 (2) 모든 OrderItem 생성 경로 (intake/confirm, orders POST)가 resolver 호출 (3) Product 편집 UI에 coaCode dropdown (4) RED 케이스: 셋 다 NULL → OrderItem.coaCode NULL 허용 (리포트에서 "미분류"로 집계) |
| 727 | feat | AI suggestedCoaCode (IntakeDraft 단계) + IntakeDraft.confirmedAt 동시성 보호 + accuracy SLO | (1) `@axle/ai` dispatcher 확장: product name → coaCode 추론 (suggest 모드, IntakeDraft.suggestedCoaCodes JSON에 저장) (2) confirm 시 service layer가 suggested → OrderItem.coaCode 승격 + `coaSource: AI` 감사 (3) IntakeDraft.confirmedAt unique 검증 (이미 confirmed면 409) (4) **Accuracy SLO**: 검증 셋 100건에서 top-1 ≥75% 시 PASS — 미달 시 dropdown override만 사용 (자동 승격 비활성) (5) RED 케이스: 같은 IntakeDraft 동시 confirm 시 1개만 성공 |

→ **M1 머지 완료 후 1주 dogfooding 윈도우**
종료 조건:
- 머지 차단 버그 0건
- 자체 컨설팅팀 사용자 피드백 ≥3건 반영
- 백필된 ErpCounterparty 데이터 정합성 검수 통과 (샘플 50건 수동 확인)

### M2 — Reporting (8 WI)

| WI | 타입 | 내용 | Acceptance Criteria |
|---|---|---|---|
| 728-prep | feat | materialized view `mv_erp_monthly_summary` + OrderItem orgId denormalize + 추가 인덱스 + REFRESH CONCURRENTLY 가능한 UNIQUE INDEX | (1) mv 생성 + UNIQUE INDEX (CONCURRENTLY 전제) (2) `REFRESH MATERIALIZED VIEW CONCURRENTLY` 1초 이내 (1년 데이터) (3) cron job 등록 (daily) (4) RED: 미초기화 mv 조회 시 빈 결과 |
| 728 | feat | 거래처별 매출/매입 요약 API + UI (월별 누적, Top 10) | (1) `GET /api/erp/reports/counterparty?from=2026-01&to=2026-05&type=SALE` (2) mv 기반 쿼리 P50 < 500ms (10k row 기준) (3) UI에 "데이터 기준 시각" 표시 (mv refresh 시각) (4) RED: Decimal/Date는 string 직렬화 (feedback_decimal_serialization) |
| 729 | feat | 계정과목별 손익계산서 간이판 API + UI (월/연도 토글) | (1) `GET /api/erp/reports/income-statement?year=2026&month=5` (2) category별 합계 (REVENUE - COGS - OPEX = 영업이익) (3) parentCode 계층 2~3 depth 애플리케이션 레벨 집계 (4) RED: 거래 0건일 때 0 반환 + 200 |
| 730 | feat | 재고 회전율·데드재고 API + UI (30/60/90일 임계치 admin 설정) | (1) `GET /api/erp/reports/inventory-turnover` + `GET /api/erp/reports/dead-stock?days=60` (2) 임계치는 ORG 설정 (default 30/60/90) (3) UI 배지: 데드재고 표시 (4) RED: InventoryMovement 0건인 Product는 dead-stock 후보 |
| 731-poc | chore | mark-docx PoC: 한글 폰트 + Vercel serverless puppeteer + Blob jobId 패턴 검증 | (1) `@sparticuz/chromium` + Fluid Compute 환경에서 한글 PDF 1페이지 생성 성공 (2) 응답 시간 ≤30초 (3) Blob 업로드 + signed URL 발급 (4) **실패 시**: 외부 워커(Render/Railway) 대안 결정 — WI-731에 반영 |
| 731 | feat | DOCX/PDF 비동기 jobId 패턴 내보내기 | (1) `POST /api/erp/reports/export` → 즉시 jobId 반환 + 202 (2) `GET /api/erp/reports/export/:jobId` → 진행상태 + Blob URL (3) 응답 5MB+ 동기 반환 금지 (4) RED: 잘못된 jobId → 404 |
| 732 | feat | ErpCounterparty 페이지 UI (목록 + CRUD 모달 + 머지 액션) | (1) wireframes/erp-counterparties.html 준수 (2) 머지는 dialog confirm + erp:counterparty:merge 권한 확인 (3) 검색 박스 → 724a API 호출 (4) RED: 권한 없는 사용자에게 머지 버튼 hide |
| 733 | feat | 레포팅 대시보드 페이지 (3 리포트 + 필터 공통 + DOCX 내보내기 트리거) | (1) wireframes/erp-reports.html 준수 (2) "데이터 기준 시각" 노출 (3) **샘플 컨설팅 리뷰 DOCX 1건 생성 + 시각 검수 통과** (acceptance) (4) RED: erp:reports:read 없는 사용자 → 403 페이지 |

## 6. Risks & Mitigations

| Risk | Mitigation | WI |
|---|---|---|
| 백필 시 동명이인 잘못 머지 → 데이터 손상 | bizRegNo 없는 row 자동 머지 금지 + admin staging UI 명시 confirm | 723b |
| FK VALIDATE 락 비용 (수만 row Order) | NOT VALID → VALIDATE 2단계 + 배포 윈도우 + statement_timeout 사전 측정 | 723a/c |
| 머지 도중 동시 Order 작성 → dangling reference | SELECT FOR UPDATE + pg_advisory_xact_lock | 724c |
| Supabase pg_bigm 미지원 | pg_trgm으로 진행 (한국어 trigram 효과 제한적이나 normalized name + GIN으로 보완) | 724a-prep |
| AI 태깅 정확도 ≥75% 미달 | dropdown override만 사용 (자동 승격 비활성) | 727 |
| Vercel serverless puppeteer 50MB 한계 | WI-731-poc로 사전 검증, 실패 시 외부 워커 대안 | 731-poc |
| mv refresh 실시간 데이터와 어긋남 | "데이터 기준 시각" UI 명시 + CONCURRENTLY refresh | 728-prep |
| Decimal/Date 직렬화 함정 | 리포트 API 모두 string 변환 | 728~730 |
| Prisma 7 P2002 meta.target undefined | envelope fields 의존 금지, message prefix만 검증 | 전체 |

## 7. Definition of Done

- 19 WI 모두 머지 (M1 11 + M2 8)
- 각 WI: RED 케이스 ≥1개 단위 테스트
- M1 dogfooding 종료 조건 충족 (머지 차단 버그 0 + 사용자 피드백 ≥3 반영)
- Drift detection CI green (WI-720에서 추가됨)
- E2E는 대화형 세션에서 별도 작성 (Phase 21 plan 외)
- 샘플 컨설팅 리뷰 DOCX 1건 시각 검수 통과 (WI-733)
- `docs/manual/user/`에 거래처/COA/리포트 페이지 사용 가이드 추가 (M2 종료 시)

## 8. 외부 참조

- 국세청 표준재무제표 v2024: https://www.nts.go.kr (계정과목 seed 출처)
- Prisma migrate diff: https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-diff
- pg_trgm: https://www.postgresql.org/docs/current/pgtrgm.html
- @sparticuz/chromium (Vercel serverless): https://github.com/sparticuz/chromium
