# PBC × 모듈 매핑 (v2)

> v1은 PBC × 앱 매핑이었으나, v2는 **PBC × 모듈** 매핑. 앱은 1개라서 무의미.

---

## pbc-image-engine

**Public API**:

```typescript
generate(req: GenerationRequest): Promise<GenerationResult>     ← ★ WI-611
selectProvider(req): ImageProvider                               ← 구현됨
getEstimatedCost(req): { credits; usd }                          ← ★ WI-611
PRESETS: Record<string, Partial<GenerationRequest>>              ← 구현됨
```

**모듈 사용처**:

| 모듈 | 어떤 페이지에서 | 호출 패턴 |
|---|---|---|
| M3 콘텐츠 | /create | `generate({mode:"CREATE", prompt})` |
| M3 콘텐츠 | /edit | `generate({mode:"EDIT", reference})` |
| M3 콘텐츠 | /poster | `generate({mode:"POSTER", layout})` |
| M3 콘텐츠 | /retouch | `generate({mode:"RETOUCH", preset:"retouch-pro"})` |
| M5 리터치 | /retouch/editor | `generate({mode:"RETOUCH"})` 단일 모드 깊게 |
| M4 ERP | /products 이미지 보정 | `generate({mode:"RETOUCH"})` 자동 |

**현재 결손**: orchestrator 미구현 → M3/M5 페이지가 PBC API를 사용할 수 없음. **WI-611로 해결**.

---

## pbc-block-builder

**Public API**:

```typescript
renderComposition(composition, ctx: RenderContext): string | ReactNode | DocxElement
PRESETS: { "landing-saas" | "detail-ecommerce" | "sns-card" | "business-doc" }
generateCopy(intent, blocks): Composition
validateBlockData(block, data): boolean
```

**모듈 사용처**:

| 모듈 | 어떤 페이지에서 | 호출 패턴 |
|---|---|---|
| M1 컨설팅 | /documents (서류 작성) | `renderComposition` for HWPX/PDF |
| M3 콘텐츠 | /builder | 23 블록 빌더 본체 |
| M4 ERP | /products/[id] (상품 상세) | `renderComposition({preset:"detail-ecommerce"})` |
| 공통 | /settings (도움말 페이지 등) | static landing-saas |

**현재 결손**: M1 서류 작성에 block-builder 연동 미완. 모듈 시스템 구축 후 자동으로 연결될 가능성.

---

## pbc-hr-payroll

**Public API**:

```typescript
createPayrollService(deps): PayrollService                 ← ★ WI-612
  .calculate(input): PayrollResult
  .generateStatement(input): PayrollStatement ← ★ WI-612

createAttendanceService(deps): AttendanceService            ← 구현됨
createLeaveService(deps): LeaveService                       ← 구현됨
createNomuConsultationService(deps): NomuConsultationService ← 구현됨
calculatePayroll(input)                                      ← legacy stateless
```

**모듈 사용처**:

| 모듈 | 어떤 페이지에서 | 호출 패턴 |
|---|---|---|
| M2 HR | /payroll | `createPayrollService({prisma}).calculate(input)` ★ |
| M2 HR | /payroll/[id]/statement | `.generateStatement(period)` → markdown/HTML ★ |
| M2 HR | /attendance | `createAttendanceService({prisma}).recordCheckIn(...)` |
| M2 HR | /leave | `createLeaveService({prisma}).request(...)` |
| M2 HR | /nomu | `createNomuConsultationService({prisma, ai}).ask(...)` |

**현재 결손**: PayrollService 팩토리 + generateStatement → **WI-612**.

---

## core-design-md ★ (WI-613)

**Public API** (예정):

```typescript
parseDesignMd(source): DesignTokens
loadDesignTokens(filePath): Promise<DesignTokens>
tokensToCssVariables(tokens): { light; dark }
tokensToTailwindConfig(tokens): Record<string, unknown>
```

**모듈 사용처**:

| 모듈 | DESIGN.md | 용도 |
|---|---|---|
| 공통 (기본) | `themes/flowcoder-default.design.md` | 플랫폼 기본 |
| M3 콘텐츠 | (옵션) `themes/content.design.md` | 어두운 캔버스 |
| M5 리터치 | (옵션) `themes/retouch.design.md` | 더 어두운 + 캔버스 확대 |
| 파트너 white-label | `themes/partner-X.design.md` | 브랜드 갈아끼움 |

**시범**: WI-613에서 apps/web/src/lib/design-tokens.ts에 시범 헬퍼 추가.

---

## core-module-system ★ (WI-616 신규)

**Public API** (예정):

```typescript
interface ModuleConfig {
  id: string;
  label: string;
  icon?: string;
  pbc: string[];
  nav: NavItem[];
  widgets?: WidgetDef[];
  prismaModels: string[];
  permissions: { [scope: string]: string };
  onInstall?: (deps: { prisma, orgId, ai? }) => Promise<void>;
  onUninstall?: (deps) => Promise<void>;
}

registerModule(config: ModuleConfig): void
getInstalledModules(orgId): Promise<ModuleConfig[]>
installModule(orgId, moduleId): Promise<void>
uninstallModule(orgId, moduleId): Promise<void>
isModuleInstalled(orgId, moduleId): Promise<boolean>
buildSidebar(orgId, userId): Promise<SidebarSection[]>
```

**모듈 사용처**: 모든 모듈이 자기 module.config.ts에서 registerModule 호출. middleware가 install + permission 체크.

---

## core-rebac (미시작)

**현 상태**: `packages/auth/` 안에 ReBAC RelationTuple 구현 존재. 추출만 하면 됨.

**모듈 사용처**: 모든 모듈이 권한 결정 시 사용. PBC도 selective하게 import.

```typescript
checkPermission(userId, orgId, scope: "consulting:write"): Promise<boolean>
addPermission(userId, orgId, scope): Promise<void>
removePermission(userId, orgId, scope): Promise<void>
```

---

## 1년 후 도입 PBC

| PBC | 출처 | 1차 소비 모듈 |
|---|---|---|
| pbc-billing | Polar 래퍼 | 모든 모듈 (구독 결제 단위) |
| pbc-consulting-crm | M1의 clients/contracts/programs 추출 | M1 (자기 자신) + 외부 |
| pbc-erp-inventory | FlowVue 재고 → M4로 | M4 |
| pbc-erp-orders | FlowVue 주문 → M4로 | M4 |
| pbc-file-manager | AXLE storage + AX Studio uploads | 모든 모듈 |
| pbc-messaging | AXLE notification + Solapi/Resend | 모든 모듈 |
| pbc-scheduler | AXLE calendar | M1 일정 |

---

## 의존성 방향 (단방향 DAG, PRD §5)

```
apps/web (Layer 4)
   ↓ depends on
src/modules/* (모듈 메타데이터, 페이지)
   ↓ depends on
pbc-* + core-* + 횡단 packages (Layer 3)
   ↓ depends on
@axle/db · @axle/auth · @axle/ai · ...
```

**금지**:
- PBC 간 순환 의존
- 모듈 간 직접 import (cross-module은 PBC 또는 공통 contract 경유)
- PBC가 인증/결제/큐/스토리지 직접 의존
