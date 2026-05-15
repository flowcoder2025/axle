# Phase 20 — AI-driven ERP / 영수증 OCR Intake MVP

- **Status**: Approved (사용자 승인 2026-05-15) — **Revised 2026-05-15** (evaluator feedback C1~C5 + M1~M5 반영)
- **Author**: flowcoder25 (Jerome)
- **Phase 19 종속**: 6 Pack × 35 모듈 + Multi-org tenancy + core-module-system 인프라 완료 위에 구축
- **목표 기간**: 4~5주 (WI 18건 — C1·C4 분할 반영)

## 0. Prerequisites (revision 2026-05-15 추가)

- ✅ Phase 19 가짜 완료 복구 완료 (PR #167 / #170 / #171, 2026-05-12). WI-621~626 main에 진짜 머지됨 — 별도 선행작업 불필요.
- ⚠️ `loadUserPermissions` (sidebar-builder.ts:94)는 여전히 grant-all mock 가능성 — Phase 20 §6.3에서 강제로 검증.

## 1. Goals

1. Pack F (ERP)의 카탈로그 모듈 7개 + 신규 `intake` 모듈 1개 = **8 모듈 메타데이터를 등록**하여 카탈로그를 35→**36 모듈**로 마감한다.
2. 그중 4개 모듈(products / inventory / orders / intake)에 대해 실제 페이지·API·Prisma 모델을 제공한다.
3. AI 주도형 ERP의 첫 킬러 워크플로우로 **영수증 이미지 OCR → 사용자 승인 → Order/Inventory 자동 등록**을 end-to-end 구현한다.
4. Phase 19에서 미뤘던 "사양 마무리" 항목(sidebar-builder registry handoff 일원화 + flowset 병렬모드 가짜 완료 게이트)을 마감한다.

## 2. Non-Goals (Phase 21+로 이관)

- ErpCounterparty 모델 (매입/판매 거래처를 CRM `Client`와 분리) — Phase 20에선 `counterpartyName: String` snapshot + `counterpartyId: String?` (free-form, FK 없음)로 시작
- Shipping / Purchase 워크플로우 구현 (메타데이터만)
- ErpReports (재고 평가 / 판매 통계 / 매입 분석) — 메타데이터만
- Multi-warehouse / Multi-currency
- 이메일·문자·사진 외 추가 intake 채널
- 고신뢰도 자동 등록 (auto-commit) — Phase 20은 사용자 승인 게이트만
- 재고 평가법 (FIFO / 이동평균)
- OCR 셀렉터 self-repair
- `module-catalog.ts` 전면 폐기 (Phase 20은 registry handoff만 swap, UI display catalog는 잔존)

## 3. Architecture

```
[Receipt image upload]
        │
        ▼
[POST /api/erp/intake] ── auth() + erp:write 검증
        │
        ▼
[Vercel Blob upload] (private scope, 5년 보관)
        │
        ▼
[fetch blob → base64] ── API 라우트 책임
        │
        ▼
[AiJob create + dispatch] ── type: "OCR", input: { imageBase64, mimeType, mode: "receipt" }
        │
        ▼
[ocrHandler 분기] ── mode==="receipt" → @axle/ocr.parseReceipt (신규)
        │
        ▼
[Claude Vision (sonnet-4-6)] → 구조화 JSON
        │
        ▼
[Product/Client fuzzy match] → top-3 추천 per item (정규화 Levenshtein)
        │
        ▼
[IntakeDraft record] (status: PENDING, orgId 스코프)
        │
        ▼
[UI: /erp/intake/[draftId]] ── 사용자가 모든 필드 검토/수정
        │  "등록"
        ▼
[Atomic commit Tx] = IntakeDraft.update(where status:PENDING) → Order + OrderItem[] + InventoryMovement[] + (필요 시 Product upsert)
```

### 3.1 핵심 결정

| 결정 | 이유 |
|---|---|
| 기존 `@axle/ai` dispatcher의 `OCR` AiJobType을 확장 (신규 type 추가 X) | business-card OCR 패턴 재사용. `OcrInput`에 선택적 `mode` 필드 추가, 기존 `parseBusinessCard` 호출 경로는 무변경. |
| API 라우트가 Blob fetch + base64 인코딩, handler는 `imageBase64` 입력 유지 | handler 입력 contract 안정성. 재시도/transient error 책임은 API 계층. |
| AI 결과는 항상 IntakeDraft로 들어가고, 사용자가 명시적 "등록" 후에만 Order/Inventory 반영 | 환영(hallucination) 위험을 사용자 게이트로 차단. confirm-everything은 MVP 단계의 안전 원칙. |
| Pack F 8개 중 **4개만 라이브** (products / inventory / orders / intake), 나머지 4개는 메타데이터만 | 4주 MVP 안에서 가치 검증 가능한 최소 범위. erp-customers/shipping/purchase/erp-reports는 사양만 등록. |
| Vision provider는 Claude Sonnet 4.6 | 한국어 영수증·상호 인식 정확도 + 기존 ANTHROPIC_API_KEY 재사용. (GPT-4V/Upstage 비교는 follow-up.) |
| OCR confidence는 **차단 기준 아님**, 사용자 안내 표시용 | 사용자가 모든 필드 검토하므로 신뢰도가 낮아도 폐기 결정은 사람이 한다. |
| Product fuzzy match는 in-memory 정규화 Levenshtein + 한국어 normalization (NFC + 공백/단위/숫자 strip) | Product 1만 개 미만에선 충분. 단순 Levenshtein은 "콜라"vs"코카콜라" 같은 부분일치 fail — normalization 필수. |
| `Order.counterpartyId`는 free-form `String?` (FK 없음), `counterpartyName: String` snapshot | CRM `Client`와 의미 충돌 방지. Phase 21 ErpCounterparty 도입 시 깨끗한 마이그레이션. |
| `module-catalog.ts`는 UI display catalog로 유지, registry runtime handoff만 swap | 옵션 (a). icon/accentColor/audience/description/pricingNote는 settings UI 전용 메타로 잔존. 두 source — 다른 책임. |
| Pack F live 모듈 4개(products/inventory/orders/intake) 모두 `multiOrg: true` | 컨설팅 펌이 위탁 운영하는 5개 managed org의 ERP를 각각 관리하는 시나리오 필수. |

## 4. Data Model

5개 신규 model + 5개 신규 enum. 기존 Phase 19까지의 스키마는 변경 없음.

```prisma
model Product {
  id         String   @id @default(cuid())
  orgId      String                          // Multi-org: managed org id로도 사용
  sku        String?
  name       String
  unit       String                          // 개, 박스, kg
  unitPrice  Decimal  @default(0)            // KRW
  category   String?
  archived   Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  movements   InventoryMovement[]
  orderItems  OrderItem[]

  @@unique([orgId, sku])                     // sku 부재 시 nullable이라 collision 없음
  @@index([orgId, name])
  @@index([orgId, archived])
}

model InventoryMovement {
  id          String         @id @default(cuid())
  orgId       String
  productId   String
  type        MovementType   // IN | OUT | ADJUST
  qty         Int            // unsigned (양수). 방향은 type이 결정.
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
  counterpartyId    String?       // free-form snapshot (FK 없음, Phase 21에 ErpCounterparty FK 도입)
  counterpartyName  String        // 표시용 snapshot
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
  productId   String?           // null = ad-hoc item (사전등록 안 된 품목, InventoryMovement 미생성)
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
  userId            String                  // FK (User onDelete:SetNull)
  blobUrl           String                  // 영수증 이미지 (Vercel Blob, private scope)
  ocrJson           Json                    // raw OCR 결과
  parsedJson        Json                    // 구조화된 추출 결과
  matchSuggestions  Json                    // product/client 매칭 후보
  status            DraftStatus             // PENDING | CONFIRMED | DISCARDED
  confirmedOrderId  String?                 // unique (한 draft → 한 Order)
  errorMsg          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([confirmedOrderId])              // 멱등성 1차 방어
  @@index([orgId, status, createdAt])
  @@index([orgId, userId, status])
}

enum MovementType  { IN OUT ADJUST }
enum ReferenceType { RECEIPT_INTAKE ORDER MANUAL INITIAL }
enum OrderType     { SALE PURCHASE }
enum OrderStatus   { DRAFT CONFIRMED CANCELLED }
enum DraftStatus   { PENDING CONFIRMED DISCARDED }
```

### 4.1 모델 결정 노트 (revision)

- `Order.counterpartyId`는 **FK 없음**, free-form `String?`. CRM `Client.id`를 넣을 수도 있고 외부 거래처 식별자(사업자번호 등)를 넣을 수도 있음. 일관성은 Phase 21 ErpCounterparty 분리 시 정리.
- `InventoryMovement.qty`는 **unsigned (양수)**, 방향은 `type` enum이 결정. 이전 spec의 "signed qty" 결정은 OUT-with-positive-qty 같은 footgun을 만들기에 철회.
- `OrderItem.productId nullable` — OCR이 매칭 못 한 ad-hoc 품목도 저장. 단, **ad-hoc OrderItem(productId=null)은 InventoryMovement를 만들지 않음** — 사용자가 confirm 시 "신규 상품 자동 등록" 토글로 명시적 선택해야 Product 생성 + Movement 발생.
- `IntakeDraft.confirmedOrderId @@unique` — 같은 draft를 두 번 confirm 시도해도 두 번째는 unique violation으로 실패. C5 멱등성 1차 방어.
- `IntakeDraft.userId`는 `User` FK, `onDelete: SetNull` — 사용자 삭제 시 draft는 보존(고아).

## 5. OCR Pipeline (Claude Vision 확장)

### 5.1 Job spec — 실제 코드 매칭 (revision)

기존 `packages/ai/src/dispatcher/handlers/ocr.ts`와 `packages/ai/src/types.ts`의 실제 contract:

```ts
// 기존 (변경 없음)
type AiJobType = "OCR"  // 대문자
interface OcrInput { imageBase64: string; mimeType: string }
ocrHandler.run(input) → @axle/ocr.parseBusinessCard(buffer, mimeType)
```

확장 (Phase 20 WI-708):

```ts
// OcrInput에 선택적 mode 필드 추가
interface OcrInput {
  imageBase64: string
  mimeType: string
  mode?: "business-card" | "receipt"  // default: "business-card" (회귀 안전)
}

// ocrHandler.run 분기
if (mode === "receipt") {
  return mod.parseReceipt(buffer, mimeType)  // 신규 export
}
return mod.parseBusinessCard(buffer, mimeType)  // 기존
```

`@axle/ocr` 신규 export (WI-708 일부):
```ts
// packages/ocr/src/receipt.ts
export async function parseReceipt(buf: Buffer, mimeType: string): Promise<ReceiptData>
// packages/ocr/src/index.ts
export { parseReceipt } from "./receipt.js"
export type { ReceiptData } from "./types.js"
```

API 라우트(`POST /api/erp/intake`)는 Vercel Blob에 업로드 후 base64로 fetch하여 `OcrInput`에 담아 dispatch — handler는 blobUrl을 모름. 책임 분리.

### 5.2 Receipt extraction prompt (Claude Vision)

영수증 이미지를 분석해 다음 JSON 스키마로만 응답하세요. 추측 금지 — 읽을 수 없는 필드는 null로.

```json
{
  "vendor":     "string",
  "date":       "YYYY-MM-DD | null",
  "type":       "purchase | sale | unknown",
  "items":      [{ "name": "string", "qty": "number", "unitPrice": "number", "unit": "string | null" }],
  "subtotal":   "number | null",
  "tax":        "number | null",
  "total":      "number | null",
  "currency":   "KRW",
  "confidence": "0.0~1.0"
}
```

### 5.3 Pipeline steps

1. **OCR call** — Anthropic Claude (sonnet-4-6, vision) + image_base64 + JSON schema prompt. JSON.parse 실패 시 1회 **feedback retry** (이전 응답과 파싱 에러를 함께 보내 "valid JSON only" 재요청). 두 번 실패 시 raw text를 `ocrJson`에 저장 + UI 수동 입력 fallback.
2. **Product fuzzy match (in-memory)** — `Product.findMany({ orgId, archived: false })`로 후보군 로드. 각 item.name과 product.name에 대해:
   - Normalize: `s.normalize("NFC").toLowerCase().replace(/[\s\-_,.]/g, "").replace(/\d+(ml|l|kg|g|개|박스|포대)/gi, "")`
   - 정규화 Levenshtein 유사도 `1 - dist / max(len(a), len(b))` 계산 → top-3 + 점수.
   - score < 0.6 → "신규 등록 권장" 플래그.
3. **Counterparty 후보 (정보 표시용만)** — vendor 문자열 × `Client.findMany({ orgId })` (name + businessName) → top-3 후보 (사용자 안내용). **주의**: 자동 매칭/저장 X — counterpartyId는 free-form snapshot이므로 사용자가 직접 입력/선택. CRM Client와 ERP 거래처 의미 충돌 방지(C2).
4. **IntakeDraft.create** — blobUrl, ocrJson(raw), parsedJson(스키마), matchSuggestions, status: PENDING, orgId(active tenant 스코프 — §6.3 참조).

### 5.4 에러 처리

- 이미지 업로드 실패 → 4xx, IntakeDraft 안 만듦.
- OCR provider 호출 실패 → IntakeDraft.status = PENDING + errorMsg 기록 + UI "재시도" 버튼.
- JSON 파싱 실패 → feedback retry 1회, 실패 시 raw text 저장 + 수동 입력 fallback.

## 6. UI Flow

### 6.1 페이지 목록

| Route | 목적 |
|---|---|
| `/erp/intake` | 영수증 목록 + 상태 필터 + "+ 새 영수증" CTA |
| `/erp/intake/new` | 이미지 업로드 (드래그-드롭 + `<input capture>` + 파일 선택) → OCR 처리 스피너 → draft 페이지로 redirect |
| `/erp/intake/[draftId]` | **검토 페이지** — 이미지 미리보기(좌) + 편집 폼(우): 유형/일자/거래처/품목 표/총액. 모든 필드 인라인 편집. 등록·폐기·초안저장 액션. |
| `/erp/products` | Product CRUD 테이블 + 신규 모달 |
| `/erp/products/[productId]` | Product 상세/편집 |
| `/erp/inventory` | 상품 선택 → InventoryMovement timeline + 현재 재고 (SUM(qty IN) - SUM(qty OUT) - SUM(qty ADJUST)). 기간/유형 필터. |
| `/erp/orders` | Order 목록 (구매/판매 탭) + 상세 |
| `/erp/orders/[orderId]` | Order 상세 + 출처(IntakeDraft) 링크 + 취소 액션 (CANCELLED + 역방향 InventoryMovement) |

### 6.2 검토 페이지 confirm flow (멱등성 + Product upsert) — revision

**필수 트랜잭션 패턴**:

```ts
await prisma.$transaction(async (tx) => {
  // C5 멱등성: PENDING → CONFIRMED 원자적 전환. 이미 CONFIRMED면 throw.
  const locked = await tx.intakeDraft.update({
    where: { id: draftId, status: "PENDING" },  // 부분 where: not-found 시 throw
    data:  { status: "CONFIRMED" },
  })

  // M3 Product 업서트 (sku 있으면 upsert, 없으면 name+orgId 기반 in-tx 캐시로 dedup)
  const productByKey = new Map<string, Product>()
  for (const item of items) {
    if (!item.shouldRegister) continue   // ad-hoc 유지 (productId=null)
    const key = item.sku ?? `name:${item.normalizedName}`
    if (productByKey.has(key)) { item.productId = productByKey.get(key)!.id; continue }
    let p = item.sku
      ? await tx.product.upsert({
          where:  { orgId_sku: { orgId, sku: item.sku } },
          update: { archived: false },              // 기존 archived면 살림
          create: { orgId, sku: item.sku, name: item.name, unit: item.unit, unitPrice: item.unitPrice },
        })
      : await tx.product.findFirst({ where: { orgId, name: item.name, archived: false } })
        ?? await tx.product.create({
              data: { orgId, name: item.name, unit: item.unit, unitPrice: item.unitPrice },
            })
    productByKey.set(key, p)
    item.productId = p.id
  }

  const order = await tx.order.create({
    data: {
      orgId, type, counterpartyName, counterpartyId, status: "CONFIRMED",
      total, tax, occurredAt, source: "RECEIPT_INTAKE", sourceId: draftId,
      items: { create: items.map(toOrderItemCreate) },
    },
  })

  // InventoryMovement: productId 있는 line만
  for (const item of items.filter(i => i.productId)) {
    await tx.inventoryMovement.create({
      data: {
        orgId, productId: item.productId!,
        type: type === "SALE" ? "OUT" : "IN",
        qty: item.qty, unitCost: item.unitPrice,
        source: "ORDER", sourceId: order.id, occurredAt,
      },
    })
  }

  await tx.intakeDraft.update({ where: { id: draftId }, data: { confirmedOrderId: order.id } })
  return order
})
```

**부수 효과**:
- 트랜잭션 롤백 시 Vercel Blob의 영수증 이미지는 그대로 남음(orphan blob OK — 별도 cron으로 cleanup).
- 동시에 두 confirm 요청 → 첫 번째는 status update 성공, 두 번째는 `RecordNotFound` throw → API에서 409로 응답.

### 6.3 Auth + Multi-org 스코프 강제 — revision

**모든 `/api/erp/*` 라우트 표준 패턴**:

```ts
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/rebac"   // 또는 packages/auth surface

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return new Response(null, { status: 401 })

  const orgId = session.activeTenantId ?? session.orgId   // active tenant 우선 (Multi-org)
  await requirePermission(session.user.id, orgId, "erp:write")  // throw → 403

  // ... orgId로 모든 쿼리 스코프
}
```

- `orgId`는 **세션에서만** 도출 — 요청 본문에서 받지 않음 (cross-tenant 공격 차단).
- Pack F live 모듈은 모두 `multiOrg: true` (active tenant 컨텍스트 필수).
- ⚠️ Phase 19 sidebar-builder.ts:94의 `loadUserPermissions`가 grant-all mock이면 ReBAC 통과가 아무 의미 없음. WI-701에서 **현재 상태 확인 + 필요 시 별도 WI 추가** (WI-619 후속).

## 7. Module Metadata + 사양 마무리

### 7.1 Pack F 8개 module (`apps/web/src/modules/pack-f-erp/`)

| Module id | route | permission | multiOrg | 페이지 | Phase 20 라이브? |
|---|---|---|---|---|---|
| products | `/erp/products` | `erp:read` | true | ✅ 신규 | Yes |
| inventory | `/erp/inventory` | `erp:read` | true | ✅ 신규 | Yes |
| orders | `/erp/orders` | `erp:read` | true | ✅ 신규 | Yes |
| intake | `/erp/intake` | `erp:write` | true | ✅ 신규 (OCR intake) | Yes |
| erp-customers | `/erp/counterparties` | `erp:read` | true | placeholder | No (Phase 21) |
| shipping | `/erp/shipping` | `erp:read` | true | placeholder | No (Phase 21) |
| purchase | `/erp/purchase` | `erp:read` | true | placeholder | No (Phase 21) |
| erp-reports | `/erp/reports` | `erp:read` | true | placeholder | No (Phase 21) |

**Note**: module-catalog.ts는 Pack F가 7 모듈 → **intake 신규 추가하여 8 모듈, 35→36 모듈 카탈로그**. Pack F는 Phase 19 catalog-vs-registry 통일에서 빠져 있었으므로 WI-701에서 **module-catalog.ts와 registry.ts 둘 다에 등록**.

Pack config: `{ id: "F", label: "Pack F. ERP", modules: [...8 ids...], pricing: { monthly: 89_000 }, recommended: false }`.

테스트: `apps/web/__tests__/modules/pack-f.test.ts` (WI-622~626 패턴 — 모듈 수 8, deps 일관성, scope 검증, multiOrg=true 검증).

### 7.2 사양 마무리 (Phase 19 잔여) — revision

1. **sidebar-builder unify (옵션 a — 최소 변경)**: 
   - `apps/web/src/lib/sidebar-builder.ts`의 `bootstrapPlatformRegistry()`를 **registry.ts의 `registerAllPacks()` 호출로 위임**.
   - `module-catalog.ts`는 **삭제 X** — `apps/web/src/components/settings/pack-card.tsx` 등 UI display(아이콘/색상/오디언스/설명/pricingNote)에 그대로 사용. catalog는 "표시 메타", registry는 "런타임 메타" 두 source 분리.
   - **Pack F 추가**가 prerequisite — `registry.ts`의 `registerAllPacks()`에 `packF + packFModules` 추가 + `ALL_PACKS` / `ALL_MODULES` 갱신 + 테스트 36 modules로 갱신.
   - 회귀 테스트: 사이드바 sections/items snapshot 비교 (WI-702에서 작성).

2. **flowset.sh 병렬 모드 게이트**: worktree 경로(`mark_wi_done` 호출 line ~1563, ~1614)에도 `verify_wi_actually_merged` 게이트 적용. 글로벌 템플릿(`~/.claude/templates/flowset/flowset.sh`) 동기화 + smoke test 추가.

## 8. WI 분할 (총 18건 — 사양 마무리 4 + ERP 14)

```
A. Pack F + 사양 마무리 (1주)
  WI-701-feat  Pack F 8 modules — module-catalog.ts(intake 추가) + per-module configs +
               registry registerAllPacks 갱신 + tests (36 modules)
  WI-702-refactor sidebar-builder bootstrap → registry.ts handoff (옵션 a) + snapshot 회귀 테스트
  WI-703-fix   flowset.sh 병렬 모드 mark_wi_done 게이트 + 글로벌 템플릿 동기화 + smoke test
  WI-704-chore loadUserPermissions 실 ReBAC loader 확인 (WI-619 후속) — mock 잔존 시 별도 fix WI 등록

B. Data layer (1주)
  WI-705-feat  Prisma: Product/InventoryMovement/Order/OrderItem/IntakeDraft + enums + User relation + migration
  WI-706-feat  Product CRUD API + /erp/products UI (orgId 스코프 + erp:* permission guard)
  WI-707-feat  /erp/inventory timeline + 현재 재고 view (집계 쿼리)
  WI-708-feat  /erp/orders 목록 + 상세 + 취소 흐름 (취소 시 역방향 InventoryMovement)

C. OCR intake (2주)
  WI-709a-feat @axle/ocr.parseReceipt 신규 export + Claude Vision 호출 + JSON schema + feedback retry
  WI-709b-feat ocrHandler `mode` 분기 (business-card 회귀 무영향) + OcrInput 타입 확장
  WI-710-feat  fuzzy match + 한국어 normalization + matchSuggestions 빌더
  WI-711-feat  IntakeDraft API: POST /upload (Blob+OCR dispatch), GET /list, GET /:id,
               POST /:id/confirm (멱등성 트랜잭션), POST /:id/discard
  WI-712-feat  /erp/intake 목록 + /erp/intake/new 업로드 페이지
  WI-713a-feat /erp/intake/[draftId] 검토 페이지 — 레이아웃 + 기본 인라인 편집
  WI-713b-feat /erp/intake/[draftId] autocomplete + matchSuggestions 와이어링 + 신규 등록 토글
  WI-714-feat  Vercel Blob 라이프사이클: 5년 보관 정책 + private scope + orphan cleanup cron 스텁

D. 테스트 + 문서 (C와 병행)
  WI-715-test  단위테스트: OCR parse + 한국어 fuzzy match (10+ 케이스) + atomic commit (멱등성/충돌)
  WI-716-test  E2E intake happy path (대화형 작성, page.goto + UI 인터랙션)
  WI-717-docs  PRD update + ERP intake 사용자 가이드 + 데이터 모델 다이어그램
```

순차 실행 4~5주, D는 C와 병행 가능. **WI-705는 B/C 모든 종속의 baseline**이라 가장 먼저. WI-701~704(사양 마무리)는 ERP work와 독립이라 worktree 병렬 가능.

## 9. Risks & Mitigations — revision

| Risk | 영향 | Mitigation |
|---|---|---|
| Claude Vision이 한국어 영수증·상호를 못 읽음 | 핵심 가치 무력화 | 베타 영수증 30+ 샘플(다양한 업종)로 사전 정확도 측정. 60% 미만이면 GPT-4V/Upstage 비교 follow-up. n=10은 신뢰구간 너무 넓어 채택 X. |
| 환영(hallucination) — 없는 품목/숫자 생성 | 잘못된 등록 | 사용자 confirm-everything 게이트가 1차 방어. 단위 테스트 환영 시나리오 포함. |
| OrderItem.productId nullable이 inventory 일관성 깨뜨림 | 재고 수치 오차 | InventoryMovement는 productId 필수. ad-hoc OrderItem(productId=null)은 InventoryMovement를 만들지 않음 — confirm 시 "신규 상품 자동 등록" 토글로 명시적 선택. 단위 테스트 invariant. |
| sidebar-builder 치환 시 회귀 (sidebar items 누락/순서 변경) | 사용자 navigation 깨짐 | snapshot 테스트로 sections/items 동일성 검증. WI-702 통과 게이트. |
| **C5: confirm 더블클릭 → 2x Order/Inventory** | 데이터 무결성 | §6.2 트랜잭션 패턴 (PENDING→CONFIRMED 원자적 전환) + IntakeDraft.confirmedOrderId @@unique. UI에선 버튼 disable + spinner도 추가. |
| **M2: ReBAC loader가 grant-all mock 잔존** | 모든 org 데이터 노출 | WI-704에서 현재 상태 확인. mock이면 별도 WI로 실 loader 구현(WI-619 후속). 실 loader 없으면 Phase 20 launch 보류. |
| **M3: Product (orgId, sku) collision** | 트랜잭션 실패 | sku 있으면 `upsert + un-archive`, sku 없으면 in-tx Map으로 dedup + name 기반 findFirst 후 create. 같은 line 중복도 방어. |
| **M4: 한국어 fuzzy match 부정확** | 매칭 후보가 쓸모없어짐 | NFC + 단위/공백/숫자 strip normalization 필수. 단위 테스트 10+ 한국어 케이스 (콜라/코카콜라, 오리지널/일반, 띄어쓰기 차이 등). 첫 버전 ~70% 매칭 목표 — 사용자가 항상 확정. |
| **M5: Vercel Blob 보관/PII** | 법규(세무 5년) + 비용 + PII 노출 | 5년 보관 정책 명시 (WI-714). Private scope + signed URL only. 볼륨 추정: 1000 receipts/월/org × 1MB × 100 orgs × 12개월 ≈ 1.2TB/년 → $28/년/100orgs. orphan(rolled-back draft) cleanup cron 스텁. PII는 정상 — 사용자 자신의 문서. |
| **M6: WI-621~626 fake completion 미복구** | fix_plan 신뢰성 | ✅ 해결 완료 — PR #167/#170/#171로 복구됨 (2026-05-12). 본 Phase에선 추가 작업 불필요. |

## 10. Definition of Done — revision

- [ ] Pack F 8 모듈 메타데이터 main에 머지 — `module-catalog.ts`(36 modules) + `registry.ts`(5→6 packs) 동시 갱신
- [ ] sidebar-builder가 `module-catalog.ts` 부트스트랩 대신 `registry.ts.registerAllPacks()`로 위임 (snapshot 회귀 없음)
- [ ] flowset.sh 병렬 모드 가짜 완료 게이트 동작 + smoke test 통과
- [ ] `loadUserPermissions` 실 ReBAC loader 동작 확인 (또는 별도 WI 등록 + 본 Phase deferred 명시)
- [ ] Prisma migration 적용 + 5 model + User relation prisma db push 통과
- [ ] `/erp/products`, `/erp/inventory`, `/erp/orders` 3 페이지 CRUD 동작 + auth/scope guard 적용
- [ ] `/erp/intake/new` 업로드 → OCR → draft 생성 happy path 성공
- [ ] `/erp/intake/[draftId]` 검토 + 등록 → Order/InventoryMovement 생성 happy path 성공
- [ ] **멱등성 검증**: confirm 더블클릭 → 두 번째 요청 409, Order 1건만 생성 (E2E 또는 단위)
- [ ] **OCR confidence < 0.6 케이스 UI affordance** (경고 배너 + 사용자 검토 강조)
- [ ] **Multi-org 스코프 검증**: active tenant 변경 시 `/erp/*` 데이터가 해당 org로만 필터됨 (E2E)
- [ ] Vercel Blob: private scope + 5년 보관 정책 명시 + orphan cleanup cron 스텁
- [ ] E2E 테스트 1건: 업로드 → 검토 → 등록 → 재고 반영 확인
- [ ] 단위 테스트: OCR parse / 한국어 fuzzy match (10+ 케이스) / atomic commit (멱등성/Product collision)
- [ ] PRD + 사용자 가이드 갱신
