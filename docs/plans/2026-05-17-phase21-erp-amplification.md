# Phase 21 — ERP Amplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 20 ERP intake로 쌓인 거래 데이터를 분석 가능한 상태로 정규화 — 거래처 마스터 (ErpCounterparty), 한국 세무 표준 계정과목 (~30개), 리포트 3종 + DOCX/PDF 내보내기.

**Architecture:** [Phase 21 Design](../specs/2026-05-17-phase21-erp-amplification-design.md) 참조. SSOT: OrderItem.coaCode (명시) > Product.coaCode (기본) > ErpCounterparty.defaultCoa (fallback). 모든 OrderItem은 service layer resolver를 거쳐 단일 coaCode 컬럼을 보유 → 리포트 쿼리 단순화.

**Tech Stack:** Next.js 16 App Router · Prisma 7 (PostgreSQL) · Supabase + pgvector · `@axle/ai` dispatcher · ReBAC (packages/auth) · materialized view (mv_erp_monthly_summary) · mark-docx (PoC 결과에 따름) · vitest

**Mandatory references:**
- [Design spec](../specs/2026-05-17-phase21-erp-amplification-design.md) — 데이터 모델, SSOT 우선순위, ReBAC 매트릭스, 인덱스 전략
- [Phase 20 design](2026-05-15-phase20-erp-receipt-intake.md) — IntakeDraft confirm 패턴 (WI-727에서 재사용)
- `packages/db/MIGRATIONS.md` — versioned migrations (WI-720). `prisma migrate dev` 강제, `db push` 금지
- `.flowset/contracts/api-standard.md` — API envelope 표준

**Lessons (반드시 적용):**
- `feedback_axle_codebase_conventions.md` — path alias / auth / tenant / AI dispatcher / Prisma update.where / schema 필드명
- `feedback_decimal_serialization.md` — Server→Client 전달 시 Decimal/Date string 변환
- `feedback_prisma7_p2002_meta.md` — P2002 envelope fields 의존 금지
- `feedback_db_migration.md` — schema 변경 시 `prisma migrate dev` 필수
- `feedback_event_bus_pattern.md` — 이벤트 emit 연결 누락 주의

## Milestones

### M1 — Master Data (WI-721 ~ WI-727, 11 WI)

ErpCounterparty 도입 + COA 정착. **M1 머지 완료 후 1주 dogfooding 윈도우.**

종료 조건 (모두 만족 시 M2 진입):
- 머지 차단 버그 0건
- 자체 컨설팅팀 사용자 피드백 ≥3건 반영
- 백필된 ErpCounterparty 데이터 정합성 샘플 50건 수동 검수 통과

### M2 — Reporting (WI-728-prep ~ WI-733, 8 WI)

mv 인프라 + 리포트 3종 + DOCX/PDF 내보내기.

## Tasks

### M1

- [ ] **WI-721-feat** ErpCounterparty + ChartOfAccounts + CounterpartyMergeLog + CounterpartyBackfillBatch Prisma model + migration
  - 4개 model + CoaCategory + BackfillStatus + CounterpartyType enum
  - partial unique 인덱스 `ErpCounterparty(orgId, bizRegNo) WHERE bizRegNo IS NOT NULL`은 raw SQL로 migration.sql에 추가
  - `prisma migrate dev --name phase21_master_data` 실행, drift 0 확인
  - Acceptance: design spec §5 WI-721 row 참조

- [ ] **WI-722-feat** ErpCounterparty CRUD API + ReBAC scope 등록
  - `apps/web/app/api/erp/counterparties/route.ts` (GET, POST) + `[id]/route.ts` (GET, PATCH, DELETE)
  - Zod 검증 + Multi-org 스코프 강제 + `erp:counterparty:read/write` 게이트
  - `packages/auth/src/rebac/scopes.ts`에 새 scope 등록 (WI-734 마지막 배치 제거 — 이 시점에 함께)
  - Acceptance: design spec §5 WI-722 row 참조

- [ ] **WI-723a-feat** Order.counterpartyId FK constraint NOT VALID 추가
  - Migration: `ALTER TABLE "Order" ADD CONSTRAINT "Order_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "ErpCounterparty"("id") ON DELETE RESTRICT NOT VALID;`
  - nullable 유지 (백필 실패 row 보호)
  - 즉시 적용 가능 (테이블 락 없음)
  - Acceptance: design spec §5 WI-723a row 참조

- [ ] **WI-723b-feat** CounterpartyBackfillBatch 기반 백필 스크립트 + admin staging UI
  - `packages/db/scripts/backfill-counterparty.ts` — `--dry-run` + 1k chunk + `pg_advisory_xact_lock` + lastOrderId 체크포인트
  - 매칭 키: (normalizedName, bizRegNo). bizRegNo 없는 row는 `pendingReview` 카운트로 적재, 자동 머지 금지
  - `apps/web/app/admin/counterparty-backfill/page.tsx` — pending review 목록 + 명시 confirm 액션
  - Acceptance: design spec §5 WI-723b row 참조

- [ ] **WI-723c-feat** FK VALIDATE + 작성 경로 전환
  - Migration: `ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_counterpartyId_fkey";` (배포 윈도우 사전 측정 + statement_timeout 확인)
  - `apps/web/app/api/erp/intake/[draftId]/confirm/route.ts` + `apps/web/app/api/erp/orders/route.ts` — service layer에서 ErpCounterparty.id 강제 upsert (NULL POST 시 400)
  - counterpartyName snapshot 유지 (historical 표시)
  - Acceptance: design spec §5 WI-723c row 참조

- [ ] **WI-724a-prep-chore** Supabase pg_trgm 활성화 + normalizedName GIN 인덱스
  - Migration에 `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + `CREATE INDEX ... USING gin (normalized_name gin_trgm_ops);`
  - `EXPLAIN ANALYZE`로 인덱스 사용 검증
  - Acceptance: design spec §5 WI-724a-prep row 참조

- [ ] **WI-724a-feat** 한국어 fuzzy 검색 API
  - `GET /api/erp/counterparties/search?q=...` — `similarity(normalizedName, $q) > 0.3` 정렬
  - 10k row 기준 응답 ≤200ms
  - Acceptance: design spec §5 WI-724a row 참조

- [ ] **WI-724b-feat** 중복 감지 read-only 리포트
  - `GET /api/erp/counterparties/duplicates` — bizRegNo 동일 OR (normalizedName 유사도 ≥0.7) 페어
  - 각 페어에 Order 카운트 + 머지 제안 포함
  - Acceptance: design spec §5 WI-724b row 참조

- [ ] **WI-724c-feat** 머지 API + CounterpartyMergeLog + advisory lock
  - `POST /api/erp/counterparties/:id/merge` — `pg_advisory_xact_lock(hashtextextended(:id), hashtextextended(:targetId))` + `SELECT FOR UPDATE`
  - Order.counterpartyId 일괄 재포인팅 + source soft-delete + log row 생성
  - 별도 권한 `erp:counterparty:merge` 게이트
  - Acceptance: design spec §5 WI-724c row 참조

- [ ] **WI-725-feat** ChartOfAccounts seed + CRUD API
  - `packages/db/seeds/chart-of-accounts.ts` — 한국 세무 표준 ~30 과목 (출처: "국세청 표준재무제표 v2024")
  - isSystem=true는 사용자 수정/삭제 불가 (400 반환)
  - `apps/web/app/api/erp/coa/route.ts` (GET, POST) + `[code]/route.ts`
  - Acceptance: design spec §5 WI-725 row 참조

- [ ] **WI-726-feat** Product.coaCode + OrderItem.coaCode + SSOT resolver
  - Migration: 두 컬럼 추가 (nullable) + OrderItem.orgId denormalize (Order에서)
  - `packages/db/src/coa-resolver.ts` — `resolveCoaCode({ orderItemCoa, productCoa, counterpartyDefaultCoa }): string | null`
  - 모든 OrderItem 생성 경로 (intake/confirm, orders POST)에서 resolver 호출 → OrderItem.coaCode 채움
  - Product 편집 UI에 coaCode dropdown
  - 단위 테스트: 4 케이스 (셋 다 값 / OrderItem만 / Product만 / Counterparty만 / 모두 NULL)
  - Acceptance: design spec §5 WI-726 row 참조

- [ ] **WI-727-feat** AI suggestedCoaCode + IntakeDraft confirm 동시성 보호 + accuracy SLO
  - IntakeDraft.suggestedCoaCodes JSON + IntakeDraft.confirmedAt unique 추가 (migration)
  - `@axle/ai` dispatcher 확장: product name + counterpartyType → coaCode 추론 (suggest 모드)
  - confirm flow에서 suggested → OrderItem.coaCode 승격 + `coaSource: AI` 감사 로그
  - 검증 셋: `packages/ai/fixtures/coa-tagging.json` 100건. top-1 ≥75% 시 PASS
  - SLO 미달 시 자동 승격 비활성 + dropdown override만 사용 (feature flag)
  - 동시 confirm 시 409 (`confirmedAt` unique)
  - Acceptance: design spec §5 WI-727 row 참조

→ **M1 완료 후 1주 dogfooding 윈도우** (위 종료 조건 참조)

### M2

- [ ] **WI-728-prep-feat** materialized view + OrderItem orgId denormalize + 추가 인덱스
  - Migration:
    - OrderItem에 orgId 컬럼 추가 + 백필 (Order에서 join 후 UPDATE)
    - `CREATE INDEX "Order_orgId_occurredAt_type_idx" ON "Order"("orgId", "occurredAt", "type") INCLUDE ("counterpartyId", "total");`
    - `CREATE INDEX "InventoryMovement_orgId_productId_occurredAt_idx" ON "InventoryMovement"("orgId", "productId", "occurredAt" DESC);`
    - `CREATE MATERIALIZED VIEW mv_erp_monthly_summary ...` + UNIQUE INDEX (CONCURRENTLY 전제)
  - Daily refresh cron: `apps/web/app/api/cron/erp-mv-refresh/route.ts` (`REFRESH MATERIALIZED VIEW CONCURRENTLY`)
  - vercel.json에 cron 등록
  - Acceptance: design spec §5 WI-728-prep row 참조

- [ ] **WI-728-feat** 거래처별 매출/매입 요약 API + UI
  - `GET /api/erp/reports/counterparty?from=YYYY-MM&to=YYYY-MM&type=SALE|PURCHASE&limit=10`
  - mv 기반 쿼리, Decimal/Date는 string 직렬화
  - UI: `apps/web/app/erp/reports/counterparty/page.tsx` (wireframes/erp-reports.html 참조) + "데이터 기준 시각" 노출
  - Acceptance: design spec §5 WI-728 row 참조

- [ ] **WI-729-feat** 계정과목별 손익계산서 간이판 API + UI
  - `GET /api/erp/reports/income-statement?year=2026&month=5` (월/연도 토글)
  - category별 합계 + parentCode 계층 2~3 depth 애플리케이션 집계
  - `영업이익 = REVENUE - COGS - OPEX`
  - Acceptance: design spec §5 WI-729 row 참조

- [ ] **WI-730-feat** 재고 회전율·데드재고 API + UI
  - `GET /api/erp/reports/inventory-turnover` + `GET /api/erp/reports/dead-stock?days=60`
  - 임계치 ORG 설정 (default 30/60/90), admin 변경 가능
  - UI 배지: 데드재고 표시
  - Acceptance: design spec §5 WI-730 row 참조

- [ ] **WI-731-poc-chore** mark-docx PoC (한글 폰트 + Vercel serverless + Blob jobId)
  - `apps/web/app/api/erp/reports/_poc-docx/route.ts` (임시) — 1페이지 한글 PDF 생성
  - `@sparticuz/chromium` + Fluid Compute 검증
  - 응답 시간 ≤30초 + Blob signed URL 발급
  - **실패 시 결정**: 외부 워커 (Render/Railway) 대안 → WI-731에 반영. plan 문서 갱신
  - Acceptance: design spec §5 WI-731-poc row 참조

- [ ] **WI-731-feat** DOCX/PDF 비동기 jobId 패턴 내보내기
  - `POST /api/erp/reports/export` → 즉시 202 + jobId
  - `GET /api/erp/reports/export/:jobId` → 진행상태 + Blob URL (완료 시)
  - 5MB+ 동기 반환 금지
  - Acceptance: design spec §5 WI-731 row 참조

- [ ] **WI-732-feat** ErpCounterparty 페이지 UI
  - `apps/web/app/erp/counterparties/page.tsx` — 목록 + 검색 + CRUD 모달 + 머지 액션
  - wireframes/erp-counterparties.html 준수
  - 머지: confirm dialog + `erp:counterparty:merge` 권한 사용자에게만 버튼 노출
  - Acceptance: design spec §5 WI-732 row 참조

- [ ] **WI-733-feat** 레포팅 대시보드 페이지 + 샘플 컨설팅 리뷰 DOCX 시각 검수
  - `apps/web/app/erp/reports/page.tsx` — 3 리포트 라우팅 + 필터 공통 + DOCX 내보내기 트리거
  - wireframes/erp-reports.html 준수
  - 샘플 데이터로 컨설팅 리뷰 DOCX 1건 생성 → 시각 검수 (acceptance criterion)
  - Acceptance: design spec §5 WI-733 row 참조

## Definition of Done

- 19 WI 모두 머지 (M1 11 + M2 8)
- 각 WI: RED 케이스 ≥1개 단위 테스트
- M1 dogfooding 종료 조건 충족
- Drift detection CI green
- 샘플 컨설팅 리뷰 DOCX 1건 시각 검수 통과
- `docs/manual/user/`에 거래처/COA/리포트 사용 가이드 추가 (M2 종료 시)

## Verification

- 각 WI 종료 시 `npx turbo lint build typecheck test --filter=...` 통과
- API WI: Zod 입력 검증 + Multi-org 스코프 강제 + ReBAC 게이트
- DB WI: `prisma migrate diff --exit-code` drift 0 + 기존 데이터 영향 분석 명시
- UI WI: wireframes 준수 + 키보드 네비게이션 + 권한별 표시 분기
- E2E는 plan 외 — M2 완료 후 대화형 세션에서 별도 작성

## Risk Management

| Risk | Mitigation | WI |
|---|---|---|
| 백필 시 동명이인 잘못 머지 | bizRegNo 없는 row 자동 머지 금지 + admin staging UI | 723b |
| FK VALIDATE 락 비용 | NOT VALID → VALIDATE 2단계 + 배포 윈도우 | 723a/c |
| 머지 도중 동시 Order | SELECT FOR UPDATE + advisory lock | 724c |
| Supabase pg_bigm 미지원 | pg_trgm + normalizedName + GIN | 724a-prep |
| AI 태깅 정확도 미달 | dropdown override만 (자동 승격 비활성 feature flag) | 727 |
| Vercel serverless puppeteer 한계 | WI-731-poc 사전 검증 + 외부 워커 대안 | 731-poc |
| mv refresh 실시간성 | "데이터 기준 시각" UI + CONCURRENTLY refresh | 728-prep |
| Decimal/Date 직렬화 | 리포트 API 모두 string 변환 | 728~730 |

## 참조 (RAG)

- `.claude/memory/rag/erp.md` — Phase 20 ERP 도메인 (M1 진행 중 갱신)
- `.claude/memory/rag/api-routes.md` — API 라우트 인벤토리 (각 WI 진행 시 갱신 필수)
- `.claude/memory/rag/db-schema.md` — schema 변경 시 즉시 갱신
