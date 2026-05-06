# PBC × 소비처 매핑 (상세)

> 각 PBC의 public API와 어느 앱이 어떤 메서드를 호출하는지 매핑.
> WI-611~615로 채워질 부분에 ★ 표시.

---

## pbc-image-engine

**Public API** (`docs/specs/meta-platform/pbc-image-engine.md` §3.2):

```typescript
generate(req: GenerationRequest): Promise<GenerationResult>     ← ★ WI-611
selectProvider(req): ImageProvider                               ← 구현됨
getEstimatedCost(req): { credits; usd }                          ← ★ WI-611
PRESETS: Record<string, Partial<GenerationRequest>>              ← 구현됨
```

**소비처**:

| 앱 / 컴포넌트 | 호출 패턴 | 시점 |
|---|---|---|
| apps/flowstudio /create | `generate({mode:"CREATE", prompt, aspectRatio})` | 1년 후 |
| apps/flowstudio /edit | `generate({mode:"EDIT", reference})` | 1년 후 |
| apps/flowstudio /poster | `generate({mode:"POSTER", layout})` | 1년 후 |
| apps/flowstudio /retouch | `generate({mode:"RETOUCH", preset:"retouch-pro"})` | 1년 후 |
| apps/flowretouch /editor | `generate({mode:"RETOUCH"})` 단일 모드 깊게 | 1년 후 |
| compat/flowstudio-v1 (이미 추출) | `provider.generate(...)` 직접 (legacy) | 현재 |
| compat/flowstudio-v2 (이미 추출) | `provider.generate(...)` 직접 (legacy) | 현재 |

**현재 결손**: orchestrator 자체가 없어 위 신규 앱이 PBC API를 사용할 수 없음. WI-611로 해결.

---

## pbc-block-builder

**Public API**:

```typescript
renderComposition(composition, ctx: RenderContext): string | ReactNode | DocxElement
PRESETS: { "landing-saas" | "detail-ecommerce" | "sns-card" | "business-doc" }
generateCopy(intent, blocks)            ← AI 카피 파이프라인
validateBlockData(block, data): boolean
```

**소비처**:

| 앱 / 컴포넌트 | 호출 패턴 | 상태 |
|---|---|---|
| apps/web/(marketing)/showcase ★ | `renderComposition(composition, {format:"react", theme})` | ★ WI-614 |
| apps/flowstudio /builder/[docId] | 빌더 내부에서 23블록 → 4 포맷 출력 | 1년 후 |
| apps/flowvue /products/[id] | 상품 상세페이지를 블록으로 구성 | 1년 후 |
| compat/flowstudio-v2 (이미 추출) | `renderComposition` facade | 현재 사용 가능 |

**현재 결손**: AXLE web 안에서 PBC 사용 evidence 0건. WI-614로 시범 도입.

---

## pbc-hr-payroll

**Public API** (`docs/specs/meta-platform/pbc-hr-payroll.md` §3.2):

```typescript
createPayrollService(deps): PayrollService                 ← ★ WI-612
  PayrollService.calculate(input): PayrollResult
  PayrollService.generateStatement(input): PayrollStatement ← ★ WI-612

createAttendanceService(deps): AttendanceService            ← 구현됨
  recordCheckIn / recordCheckOut / summarize

createLeaveService(deps): LeaveService                       ← 구현됨
  request / approve / reject / balance

createNomuConsultationService(deps): NomuConsultationService ← 구현됨
  ask / validate

calculatePayroll(input)                                      ← 구현됨 (legacy, stateless)
```

**소비처**:

| 앱 / 컴포넌트 | 호출 패턴 | 상태 |
|---|---|---|
| apps/flowteams /payroll ★ | `createPayrollService({prisma}).calculate(input)` + `generateStatement(period)` | ★ WI-612 (현재는 `calculatePayroll` 직접 호출) |
| apps/flowteams /attendance | `createAttendanceService({prisma}).recordCheckIn(...)` | 사용 가능 |
| apps/flowteams /leave | `createLeaveService({prisma, notification}).request(...)` | 사용 가능 |
| apps/flowteams /nomu | `createNomuConsultationService({prisma, ai}).ask(...)` | 사용 가능 (placeholder AI) |

**현재 결손**: PayrollService 팩토리 + generateStatement. WI-612로 해결.

---

## core-design-md ★ (WI-613 신규)

**Public API** (예정):

```typescript
parseDesignMd(source: string): DesignTokens                  ← ★ WI-613
loadDesignTokens(filePath): Promise<DesignTokens>            ← ★ WI-613
tokensToCssVariables(tokens): { light: string; dark: string }← ★ WI-613
tokensToTailwindConfig(tokens): Record<string, unknown>      ← ★ WI-613
```

**소비처**:

| 앱 | DESIGN.md 파일 | 사용 |
|---|---|---|
| apps/web | `themes/flowcoder-default.design.md` (기본) | globals.css에 주입 (1년 후) |
| apps/flowstudio | `themes/flowstudio.design.md` (1년 후) | 콘텐츠 작업 친화적 theme |
| apps/flowvue | `themes/flowvue.design.md` (1년 후) | 데이터 표 친화적 theme |
| apps/flowretouch | `themes/flowretouch.design.md` (1년 후) | 어두운 캔버스 친화적 theme |

**WI-613 산출물**: 패키지 + `apps/web/src/lib/design-tokens.ts` 시범 헬퍼 (실 globals.css 교체는 후속 WI).

---

## core-rebac (미시작)

**의도**: 현 `packages/auth/` 안의 ReBAC 로직(RelationTuple, Google Zanzibar)을 분리해 다른 PBC가 import할 수 있게 함.

**소비처**:

| 앱 / PBC | 호출 패턴 |
|---|---|
| apps/web | 현재 직접 사용 → 분리 후 import 경로만 변경 |
| apps/flowteams | 권한 결정 로직만 import |
| pbc-billing (1년 후) | 결제 권한 검증 |
| pbc-erp-* (1년 후) | 재고/주문 권한 |

**상태**: 미시작 (audit P2 항목, 본 라운드 외).

---

## 1년 후 도입 PBC (Top 10 채우기)

| PBC | 출처 | 1차 소비처 |
|---|---|---|
| pbc-billing | Polar 래퍼 | flowstudio · flowvue · flowretouch · web (구독) |
| pbc-consulting-crm | apps/web의 clients/contracts/programs 추출 | apps/web (자기 자신) + 외부 SaaS |
| pbc-erp-inventory | FlowVue 재고 | apps/flowvue |
| pbc-erp-orders | FlowVue 주문 | apps/flowvue |
| pbc-file-manager | AXLE storage + AX Studio uploads | 모든 앱 |
| pbc-messaging | AXLE notification + Solapi/Resend | 모든 앱 |
| pbc-scheduler | AXLE calendar | apps/web · 미래 예약 SaaS |

---

## 의존성 방향 (DAG, 단방향만 — PRD §5)

```
apps/* (Layer 4)
   ↓ depends on
pbc-* + core-* + 횡단 packages (Layer 3)
   ↓ depends on
@axle/db · @axle/auth · @axle/ai · @axle/storage · ... (횡단)
   ↓ depends on
Layer 2 FDP Core
```

**금지**: PBC 간 순환 의존, PBC가 인증/결제/큐/스토리지를 직접 의존하는 것 (반드시 횡단 packages 경유).
