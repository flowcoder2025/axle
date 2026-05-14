# Phase 20 — AI-driven ERP / 영수증 OCR Intake MVP

- **Status**: Approved (사용자 승인 2026-05-15)
- **Author**: flowcoder25 (Jerome)
- **Phase 19 종속**: 6 Pack × 35 모듈 + Multi-org tenancy + core-module-system 인프라 완료 위에 구축
- **목표 기간**: 4~5주 (WI 15건 + 사양 마무리 3건)

## 1. Goals

1. Pack F (ERP) 7개 모듈의 메타데이터를 카탈로그에 등록하여 35-모듈 사양을 마감한다.
2. 그중 핵심 3개 모듈(products / inventory / orders)에 대해 실제 CRUD 페이지·API를 제공한다.
3. AI 주도형 ERP의 첫 킬러 워크플로우로 **영수증 이미지 OCR → 사용자 승인 → Order/Inventory 자동 등록**을 end-to-end 구현한다.
4. Phase 19에서 미뤘던 "사양 마무리" 항목(sidebar-builder 통일 + flowset 병렬 모드 가짜 완료 게이트)을 마감한다.

## 2. Non-Goals (Phase 21+로 이관)

- ErpCounterparty 모델 (매입 거래처를 CRM `Client`와 분리)
- Shipping / Purchase 워크플로우 구현
- ErpReports (재고 평가 / 판매 통계 / 매입 분석)
- Multi-warehouse / Multi-currency
- 이메일·문자·사진 외 추가 intake 채널
- 고신뢰도 자동 등록 (auto-commit) — Phase 20은 사용자 승인 게이트만
- 재고 평가법 (FIFO / 이동평균)
- OCR 셀렉터 self-repair

## 3. Architecture

```
[Receipt image upload]
        │
        ▼
[POST /api/erp/intake]  ──► [Vercel Blob] (receipt url 저장)
        │
        ▼
[AI Job dispatch] ── type: "ocr", mode: "receipt"
        │
        ▼
[ocrHandler 확장] ── Claude Vision (sonnet-4-6) → 구조화 JSON
        │
        ▼
[Product/Client fuzzy match]  → top-3 추천 per item
        │
        ▼
[IntakeDraft record] (status: PENDING)
        │
        ▼
[UI: /erp/intake/[draftId]] ── 사용자가 모든 필드 검토/수정
        │  "등록"
        ▼
[Atomic commit] = Order + OrderItem[] + InventoryMovement[] + (필요 시 신규 Product)
```

### 3.1 핵심 결정

| 결정 | 이유 |
|---|---|
| 기존 `@axle/ai` dispatcher의 `ocrHandler`를 확장 (신규 패키지 X) | business-card / document OCR 패턴과 동일 인프라 재사용. 검증된 표면. |
| AI 결과는 항상 IntakeDraft로 들어가고, 사용자가 명시적 "등록" 후에만 Order/Inventory 반영 | 환영(hallucination) 위험을 사용자 게이트로 차단. 옵션 A의 "confirm-everything"는 MVP 단계의 안전 원칙. |
| Pack F 7개 중 **3개만 라이브** (products / inventory / orders), 나머지 4개는 메타데이터만 | 4주 MVP 안에서 가치 검증 가능한 최소 범위. erp-customers/shipping/purchase/erp-reports는 사양만 등록, Phase 21+에서 활성화. |
| Vision provider는 Claude Sonnet 4.6 | 한국어 영수증·상호 인식 정확도 + 기존 ANTHROPIC_API_KEY 재사용 + `@axle/ai`가 Claude 중심 표면. (GPT-4V/Upstage 비교는 follow-up.) |
| OCR confidence는 **차단 기준 아님**, 사용자 안내 표시용 | 사용자가 모든 필드 검토하므로 신뢰도가 낮아도 폐기 결정은 사람이 한다. 자동 차단은 false negative를 만든다. |
| Product fuzzy match는 in-memory Levenshtein 유사도 (정규화 거리 1 - dist/max(len)) | 영수증 1장당 비교 대상이 보통 수십~수백 Product. 별도 인덱스 불필요. Product 1만 개 초과 시 pgvector/trigram으로 확장 (Phase 21+). |

## 4. Data Model

5개 신규 model + 5개 신규 enum. 기존 Phase 19까지의 스키마는 변경 없음.

```prisma
model Product {
  id         String   @id @default(cuid())
  orgId      String
  sku        String?
  name       String
  unit       String                 // 개, 박스, kg
  unitPrice  Decimal  @default(0)   // KRW
  category   String?
  archived   Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  movements   InventoryMovement[]
  orderItems  OrderItem[]

  @@unique([orgId, sku])
  @@index([orgId, name])
  @@index([orgId, archived])
}

model InventoryMovement {
  id          String         @id @default(cuid())
  orgId       String
  productId   String
  type        MovementType   // IN | OUT | ADJUST
  qty         Int            // signed (IN +, OUT -)
  source      ReferenceType?
  sourceId    String?
  unitCost    Decimal?
  note        String?
  occurredAt  DateTime
  createdAt   DateTime       @default(now())

  product     Product @relation(fields: [productId], references: [id])

  @@index([orgId, productId, occurredAt])
  @@index([orgId, occurredAt])
}

model Order {
  id                String        @id @default(cuid())
  orgId             String
  type              OrderType     // SALE | PURCHASE
  counterpartyId    String?       // FK to Client (sale) — Phase 21에 ErpCounterparty 분리
  counterpartyName  String        // free-text snapshot
  status            OrderStatus   // DRAFT | CONFIRMED | CANCELLED
  total             Decimal
  tax               Decimal       @default(0)
  occurredAt        DateTime
  source            ReferenceType?
  sourceId          String?
  note              String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  items             OrderItem[]

  @@index([orgId, type, occurredAt])
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  productId   String?           // null = ad-hoc item (사전등록 안 된 품목)
  productName String            // snapshot
  qty         Int
  unitPrice   Decimal
  lineTotal   Decimal

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product? @relation(fields: [productId], references: [id])
}

model IntakeDraft {
  id                String       @id @default(cuid())
  orgId             String
  userId            String
  blobUrl           String                  // 영수증 이미지 (Vercel Blob)
  ocrJson           Json                    // raw OCR 결과
  parsedJson        Json                    // 구조화된 추출 결과
  matchSuggestions  Json                    // product/client 매칭 후보
  status            DraftStatus             // PENDING | CONFIRMED | DISCARDED
  confirmedOrderId  String?
  errorMsg          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([orgId, status, createdAt])
}

enum MovementType  { IN OUT ADJUST }
enum ReferenceType { RECEIPT_INTAKE ORDER MANUAL INITIAL }
enum OrderType     { SALE PURCHASE }
enum OrderStatus   { DRAFT CONFIRMED CANCELLED }
enum DraftStatus   { PENDING CONFIRMED DISCARDED }
```

### 4.1 모델 결정 노트

- `Order.counterpartyId`는 일단 `Client` FK (논리적). Phase 21에서 매입 거래처 분리 시 별도 ErpCounterparty 모델 도입.
- `OrderItem.productId nullable` — OCR이 매칭 못 한 ad-hoc 품목도 저장. `productName` snapshot으로 추적 유지.
- `InventoryMovement.qty`는 signed integer (IN: +, OUT: -). 잔량 = SUM(qty) WHERE productId. 단순한 모델로 시작, 평가법은 Phase 21+.
- `IntakeDraft.matchSuggestions Json` — 임시 작업 상태. 사용자가 수정·확인 동안 보존, "등록" 시 confirmedOrderId로 잠금.

## 5. OCR Pipeline (Claude Vision 확장)

### 5.1 Job spec

```ts
// @axle/ai dispatcher
type AiJobType = "ocr"
type AiJobInput = {
  mode: "business-card" | "document" | "receipt"   // 신규: "receipt"
  blobUrl: string
  orgId: string
}
```

### 5.2 Receipt extraction prompt (Claude Vision)

영수증 이미지를 분석해 다음 JSON 스키마로만 응답하세요. 추측 금지 — 읽을 수 없는 필드는 null로.

```json
{
  "vendor":      "string",
  "date":        "YYYY-MM-DD | null",
  "type":        "purchase | sale | unknown",
  "items":       [
    { "name": "string", "qty": "number", "unitPrice": "number", "unit": "string | null" }
  ],
  "subtotal":    "number | null",
  "tax":         "number | null",
  "total":       "number | null",
  "currency":    "KRW",
  "confidence":  "0.0~1.0"
}
```

### 5.3 Pipeline steps

1. **OCR call** — Anthropic Claude (sonnet-4-6, vision) + image_url + JSON schema prompt. JSON.parse 실패 시 1회 재시도.
2. **Product fuzzy match (in-memory)** — `Product.findMany({ orgId, archived: false })`로 후보군 로드. 각 item.name × product.name 정규화 Levenshtein 유사도 `1 - dist / max(len(a), len(b))` 계산 → top-3 + 점수. score < 0.6 → "신규 등록 권장" 플래그.
3. **Counterparty match** — vendor 문자열 × `Client.findMany({ orgId })` (name + businessName) → top-3 후보.
4. **IntakeDraft.create** — blobUrl, ocrJson(raw), parsedJson(스키마), matchSuggestions, status: PENDING.

### 5.4 에러 처리

- 이미지 업로드 실패 → 4xx, IntakeDraft 안 만듦.
- OCR provider 호출 실패 → IntakeDraft.status = PENDING + errorMsg 기록 + UI "재시도" 버튼.
- JSON 파싱 실패 → 1회 retry, 실패 시 raw text를 ocrJson에 저장 + UI 수동 입력 모드 fallback.

## 6. UI Flow

### 6.1 페이지 목록

| Route | 목적 |
|---|---|
| `/erp/intake` | 영수증 목록 + 상태 필터 + "+ 새 영수증" CTA |
| `/erp/intake/new` | 이미지 업로드 (드래그-드롭 + `<input capture>` + 파일 선택) → OCR 처리 스피너 → draft 페이지로 redirect |
| `/erp/intake/[draftId]` | **검토 페이지** — 이미지 미리보기(좌) + 편집 폼(우): 유형/일자/거래처/품목 표/총액. 모든 필드 인라인 편집. 등록·폐기·초안저장 액션. |
| `/erp/products` | Product CRUD 테이블 + 신규 모달 |
| `/erp/products/[productId]` | Product 상세/편집 |
| `/erp/inventory` | 상품 선택 → InventoryMovement timeline + 현재 재고. 기간/유형 필터. |
| `/erp/orders` | Order 목록 (구매/판매 탭) + 상세 |
| `/erp/orders/[orderId]` | Order 상세 + 출처(IntakeDraft) 링크 + 취소 액션 (CANCELLED + 역방향 InventoryMovement) |

### 6.2 검토 페이지 핵심 동작 (사용자 게이트)

- 거래처/품목 autocomplete: 기존 `Client` / `Product` 검색 (matchSuggestions를 초기 추천으로 표시).
- "신규 상품 자동 등록" 토글 (기본 ON): 매칭 안 된 OrderItem.productName을 등록 시 Product 신규 생성.
- "등록" 클릭 → POST `/api/erp/intake/[draftId]/confirm` → Prisma transaction:
  1. 필요 시 Product 신규 create (없으면 OrderItem.productId = null)
  2. Order create + items create
  3. InventoryMovement create (SALE → OUT, PURCHASE → IN, qty 변경)
  4. IntakeDraft.status = CONFIRMED, confirmedOrderId 기록
- 등록 후 토스트 + `/erp/orders/[orderId]` 로 redirect.

## 7. Module Metadata + 사양 마무리

### 7.1 Pack F 8개 module (`apps/web/src/modules/pack-f-erp/`)

| Module id | route | permission | 페이지 | Phase 20 라이브? |
|---|---|---|---|---|
| products | `/erp/products` | `erp:read` | ✅ 신규 | Yes |
| inventory | `/erp/inventory` | `erp:read` | ✅ 신규 | Yes |
| orders | `/erp/orders` | `erp:read` | ✅ 신규 | Yes |
| intake | `/erp/intake` | `erp:write` | ✅ 신규 (OCR intake) | Yes |
| erp-customers | `/erp/counterparties` | `erp:read` | placeholder | No (Phase 21) |
| shipping | `/erp/shipping` | `erp:read` | placeholder | No (Phase 21) |
| purchase | `/erp/purchase` | `erp:read` | placeholder | No (Phase 21) |
| erp-reports | `/erp/reports` | `erp:read` | placeholder | No (Phase 21) |

**Note**: module-catalog.ts는 Pack F가 7 모듈인데, intake 모듈을 신규 추가하여 **8 모듈**로 확장. 35→36 모듈 카탈로그.

Pack config: `{ id: "F", label: "Pack F. ERP", modules: [...8 ids...], pricing: { monthly: 89_000 } }`.

테스트: `apps/web/__tests__/modules/pack-f.test.ts` (WI-622~626 패턴 — 모듈 수, deps 일관성, scope 검증).

### 7.2 사양 마무리 (Phase 19 잔여)

1. **sidebar-builder unify** — `apps/web/src/lib/sidebar-builder.ts`의 `bootstrapPlatformRegistry()`가 `module-catalog.ts`(레거시 catalog)에서 부트스트랩하는 부분을 `apps/web/src/modules/registry.ts`(per-module config 진입점)로 치환. 회귀 테스트 필수 — 사이드바 sections/items가 변경되지 않아야 함.
2. **flowset.sh 병렬 모드 게이트** — flowset.sh의 worktree 경로(`mark_wi_done` 호출 line ~1563, ~1614)에도 `verify_wi_actually_merged` 게이트 적용. 글로벌 템플릿(`~/.claude/templates/flowset/flowset.sh`) 동기화 포함.

## 8. WI 분할 (총 16건 — 사양 마무리 3 + ERP 13)

```
A. Pack F + 사양 마무리 (1주)
  WI-701-feat  Pack F 8 modules metadata + tests + registry 등록
  WI-702-refactor sidebar-builder unify (catalog → registry) + 회귀 테스트
  WI-703-fix   flowset.sh 병렬 모드 mark_wi_done 게이트 + 글로벌 템플릿 동기화

B. Data layer (1주)
  WI-704-feat  Prisma: Product/InventoryMovement/Order/OrderItem/IntakeDraft + enums + migration
  WI-705-feat  Product CRUD API + /erp/products UI
  WI-706-feat  /erp/inventory timeline + 현재 재고 view
  WI-707-feat  /erp/orders 목록 + 상세 + 취소 흐름

C. OCR intake (2주)
  WI-708-feat  ocrHandler receipt 모드 확장 (Claude Vision sonnet-4-6)
  WI-709-feat  fuzzy match (Product + Client) + matchSuggestions
  WI-710-feat  IntakeDraft API: upload / parse / list / confirm / discard
  WI-711-feat  /erp/intake 목록 + /erp/intake/new 업로드 페이지
  WI-712-feat  /erp/intake/[draftId] 검토 페이지 (핵심 UI)
  WI-713-feat  Confirm flow: atomic commit (Order + items + InventoryMovement + 신규 Product)

D. 테스트 + 문서 (C와 병행)
  WI-714-test  단위테스트: OCR parse + fuzzy match + atomic commit
  WI-715-test  E2E intake happy path (대화형 작성, page.goto + UI 인터랙션)
  WI-716-docs  PRD update + ERP intake 사용자 가이드
```

순차 실행 4~5주, D는 C와 병행 가능. WI-704는 데이터 계층 전체의 종속이라 가장 먼저 작업.

## 9. Risks & Mitigations

| Risk | 영향 | Mitigation |
|---|---|---|
| Claude Vision이 한국어 영수증·상호를 못 읽음 | 핵심 가치 무력화 | 베타 영수증 10장 샘플로 사전 정확도 측정. 60% 미만이면 GPT-4V/Upstage 비교 검토(별도 follow-up). |
| 환영(hallucination) — 없는 품목/숫자 생성 | 잘못된 등록 | 사용자 confirm-everything 게이트가 1차 방어. 단위 테스트에 환영 케이스 시나리오 포함. |
| OrderItem.productId nullable이 inventory 계산 일관성 깨뜨림 | 재고 수치 오차 | InventoryMovement는 productId 필수. ad-hoc item(productId=null OrderItem)은 InventoryMovement를 만들지 않음 — confirm 시 사용자가 "신규 상품 자동 등록" 토글로 명시적 선택. |
| sidebar-builder 치환 시 회귀 (sidebar items 누락/순서 변경) | 사용자 navigation 깨짐 | snapshot 테스트로 sections/items 동일성 검증. WI-702에서 회귀 테스트가 통과 게이트. |

## 10. Definition of Done

- [ ] Pack F 8 모듈 메타데이터 main에 머지, `apps/web/src/modules/registry.ts`로 노출
- [ ] sidebar-builder가 module-catalog.ts 대신 registry.ts에서 부트스트랩 (snapshot 회귀 없음)
- [ ] flowset.sh 병렬 모드 가짜 완료 게이트 동작 확인 (테스트 추가)
- [ ] Prisma migration 적용 + 5 model 모두 prisma db push 통과
- [ ] `/erp/products`, `/erp/inventory`, `/erp/orders` 3 페이지 CRUD 동작
- [ ] `/erp/intake/new` 업로드 → OCR → draft 생성 happy path 성공
- [ ] `/erp/intake/[draftId]` 검토 + 등록 → Order/InventoryMovement 생성 happy path 성공
- [ ] E2E 테스트 1건: 업로드 → 검토 → 등록 → 재고 반영 확인
- [ ] 단위 테스트: OCR parse / fuzzy match / atomic commit
- [ ] PRD + 사용자 가이드 갱신
