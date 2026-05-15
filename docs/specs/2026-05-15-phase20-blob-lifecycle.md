# Phase 20 — Vercel Blob Lifecycle (영수증 보관 정책)

**작성**: 2026-05-15
**범위**: ERP 영수증 OCR Intake (WI-711 / WI-714)
**관련 코드**: `apps/web/lib/erp/blob.ts`, `scripts/cron/blob-orphan-cleanup.ts`

---

## 1. 보관 기간 — 5년

| 상태 | 보관 기간 | 근거 |
|------|----------|------|
| `IntakeDraft.status = CONFIRMED` (Order 변환 완료) | **5년** | 소득세법 §160 + 부가가치세법 §32 (장부·증빙서류 보관 의무) |
| `IntakeDraft.status = DISCARDED` | 즉시 삭제 | 사용자가 명시적으로 폐기 |
| `IntakeDraft.status = PENDING` (30일 경과) | 즉시 삭제 | stale draft. 사용자가 검토를 포기한 것으로 간주 |

상수: `RETENTION_POLICY = { days: 5 * 365, reason: "한국 세무 보관 의무 (소득세법 §160 / 부가가치세법 §32)" }`

> 한국 세무 보관 기한은 사업연도 종료일 다음달부터 기산하지만, 본 구현은 안전한 over-approximation으로 업로드일 기준 5년을 사용한다. 정확한 회계기간 연동은 ERP가 단일 사업장 기준으로 정착한 뒤 후속 WI에서 개선.

---

## 2. URL 노출 모델 (Phase 20 MVP)

Vercel Blob은 현재 **public scope만 지원**한다. signed URL / private scope는 Enterprise plan 또는 Phase 21+ Vercel Blob 로드맵 의존.

**MVP 절충안:**
- `put(path, buf, { access: "public", addRandomSuffix: true })`
- 결과 URL은 `https://<store>.public.blob.vercel-storage.com/erp/receipts/<orgId>/<draftId>-<ts>-<random>.<ext>` 형태
- `<random>`은 Vercel이 자동 생성하는 12+자 토큰 → 실질적으로 브루트포스 불가
- URL은 `IntakeDraft.blobUrl`에만 저장. 검색엔진 색인 차단을 위한 robots.txt/X-Robots-Tag는 별도 (스토어 도메인 분리)

**Phase 21+ 후속 작업** (별도 WI):
1. Vercel Blob private scope GA 시 마이그레이션
2. 단기 만료 signed URL 발급 헬퍼 (`getSignedReceiptUrl(draftId, ttlSec=300)`)
3. 영수증 표시 컴포넌트에서 signed URL 사용

---

## 3. PII 정당성

영수증 이미지는 다음 개인정보를 포함할 수 있다:
- 가맹점명, 사업자번호, 주소 (사업자 정보 — 공개 정보)
- 결제 카드 마지막 4자리 (PCI 비-민감 정보)
- 구매 품목 / 금액 (조직 운영 데이터)
- 드물게 고객명 (B2B 영수증)

**처리 근거:**
- 사용자가 자발적으로 업로드 (명시적 동의)
- 처리 목적: 조직의 회계 자동화 (계약 이행)
- 보관 근거: 세무 보관 의무 (법적 의무 — GDPR Art. 6(1)(c) 등가)
- 테넌트 격리: 경로에 `<orgId>` 포함 + ReBAC `erp:read` 스코프로 접근 제어
- 5년 후 자동 폐기 (확장 보관 요청 시 사용자 동의 추가)

---

## 4. Orphan Cleanup — 일일 cron

스크립트: `scripts/cron/blob-orphan-cleanup.ts`

**동작:**
1. `IntakeDraft`에서 `status = DISCARDED` 또는 (`status = PENDING` AND `createdAt < now - 30d`) 행 조회
2. 각 행의 `blobUrl`에 대해 `deleteReceipt(url)` 호출
3. 삭제 성공 시 `blobUrl = ""`로 무력화 (draft 행은 감사 추적 위해 보존)
4. 개별 실패는 로그만 남기고 배치 계속 (404 등으로 전체가 멈추지 않음)

**스케줄:** 일 1회 (UTC 18:00 ≈ KST 03:00 권장 — 트래픽 최소 시간대). Vercel Cron 또는 외부 워커에서 호출.

**모니터링:** `[blob-orphan-cleanup] done deleted=N failed=M total=T` 로그 라인을 관측. `failed > 0` 가 누적되면 알림.

**고아 list 보조:** `findOrphans(beforeIso)` 헬퍼는 Blob store를 직접 페이지네이션 스캔하여 `IntakeDraft`에 매칭되지 않는 잔여 blob을 찾을 때 사용 (DB ↔ Blob 정합성 감사용 — 일상 cron에서는 미사용).

---

## 5. 비용 추정

**가정** (100개 조직, 조직당 월 1,000건 영수증, 1건당 평균 1MB):
- 월 신규 100,000건 × 1MB = **100GB/월**
- 5년 누적 = 100GB × 60개월 = **6TB**
- 단, 30일 내 폐기되는 PENDING + DISCARDED ≈ 30% → 실보관 ≈ **4.2TB**

**Vercel Blob 가격** (2026-05 기준 Pro plan):
- 스토리지: $0.023/GB-월 → 4.2TB × $0.023 × 12 = **$1,159/년** (전사 합산)
- 조직당 환산: $11.6/년 → 사용자 단가 영향 미미

> 실제 사용량은 조직 규모/업종에 크게 의존. 4.2TB는 보수적 상한 추정. 영세 조직 평균은 월 100건 수준 → 실 비용은 1/10 수준일 가능성.

**비용 최적화 트리거** (별도 WI):
- 누적 1TB 도달 시 이미지 압축 (sharp / WebP 변환) 도입 검토
- 누적 5TB 도달 시 cold storage 티어 (Vercel Blob → S3 Glacier) 검토

---

## 6. 삭제 / 보관 만료 정책 (5년 경과 시 — 후속 WI)

본 WI(WI-714) 범위 밖. 5년 만료 처리는 다음 조건이 함께 충족돼야 실행한다:
- Order 라이프사이클이 안정 (취소/환불 흐름 정착)
- 회계기간 종료일 기반 보관 만료 계산 (단순 업로드일 + 5년이 아닌)
- 사용자 명시 확인 (만료 30일 전 알림)

당분간은 **삭제하지 않는다** — 5년이 도래하기 전까지 시간 여유가 있다.

---

## 7. 변경 이력

- 2026-05-15: 초기 작성 (WI-714)
