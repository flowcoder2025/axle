# PBC × 모듈 매핑 (v3)

> v3 = Pack × Module × PBC 3-tier 매핑.

---

## pbc-image-engine

**Public API**:
```typescript
generate(req): Promise<GenerationResult>          ★ WI-611
selectProvider(req): ImageProvider                구현됨
getEstimatedCost(req): { credits; usd }           ★ WI-611
PRESETS: Record<string, ...>                      구현됨
```

**모듈 사용처**:

| Pack | 모듈 | 호출 패턴 |
|---|---|---|
| E | E.01 이미지 생성 (7 모드) | `generate({mode: ...})` |
| E | E.03 프리셋 | `PRESETS[name]` + `generate(preset+req)` |
| E | E.04 ComfyUI 워크플로우 | `registerWorkflow` + `generate({provider: "comfyui-..."})` |
| F (1년 후) | F.01 상품 (자동 이미지) | `generate({mode:"RETOUCH"})` |
| B (cross-pack) | B.03 연구일지 도해 | `generate({mode:"CREATE", prompt:"figure of ..."})` |

**현재 결손**: orchestrator 미구현 → E 모듈이 PBC API 못 씀. **WI-611로 해결**.

---

## pbc-block-builder

**Public API**:
```typescript
renderComposition(composition, ctx): string | ReactNode | DocxElement
PRESETS: { "landing-saas" | "detail-ecommerce" | "sns-card" | "business-doc" }
generateCopy(intent, blocks)
validateBlockData(block, data)
```

**모듈 사용처**:

| Pack | 모듈 | 호출 패턴 |
|---|---|---|
| E | E.02 빌더 | 23 블록 빌더 본체 |
| A (cross-pack) | A.05 서류 | `renderComposition` for HWPX/PDF |
| F (cross-pack, 1년 후) | F.01 상품 상세 | `renderComposition({preset:"detail-ecommerce"})` |
| B (cross-pack) | B.03 연구일지 | 일지에 23블록 활용 (도해/표/이미지) |

---

## pbc-hr-payroll

**Public API**:
```typescript
createPayrollService(deps): PayrollService                 ★ WI-612
  .calculate(input): PayrollResult
  .generateStatement(input): PayrollStatement              ★ WI-612

createAttendanceService(deps): AttendanceService            구현됨
createLeaveService(deps): LeaveService                       구현됨
createNomuConsultationService(deps): NomuConsultationService 구현됨
```

**모듈 사용처**:

| Pack | 모듈 | 호출 패턴 |
|---|---|---|
| D | D.02 급여 | `createPayrollService({prisma, tenantOrgId}).calculate(input)` ★ |
| D | D.02 (명세서) | `.generateStatement(period)` → markdown/HTML ★ |
| D | D.03 근태 | `createAttendanceService({prisma, tenantOrgId})` |
| D | D.04 연차 | `createLeaveService({prisma, tenantOrgId})` |
| D | D.05 노무 | `createNomuConsultationService({prisma, ai, tenantOrgId})` |

★ Multi-org: 모든 service factory deps에 `tenantOrgId` 추가 — 데이터 query에 자동 적용.

---

## core-design-md (★ WI-613)

**Public API**:
```typescript
parseDesignMd(source): DesignTokens
loadDesignTokens(filePath): Promise<DesignTokens>
tokensToCssVariables(tokens): { light; dark }
tokensToTailwindConfig(tokens): Record<string, unknown>
```

**모듈 사용처**: 모든 모듈이 동일 토큰 사용. Pack별 theme 옵션 — 추후 Pack E 어두운 캔버스 모드 등.

---

## core-module-system (★ WI-616 신규)

**Public API**:
```typescript
interface ModuleConfig { id, packId, label, route, permission, multiOrg, pbc, deps, prismaModels, widgets?, onInstall? }
interface PackConfig { id, label, modules, pricing, recommended? }

registerModule(config: ModuleConfig): void
registerPack(config: PackConfig): void
getInstalledModules(orgId): Promise<string[]>
installModule(orgId, moduleId): Promise<void>
installPack(orgId, packId): Promise<void>
uninstallModule(orgId, moduleId): Promise<void>
checkDependencies(orgId, moduleId): Promise<{ ok, missing }>
isMultiOrgActive(orgId): Promise<boolean>
buildSidebar(orgId, userId, activeTenant): Promise<SidebarSection[]>
```

**모듈 사용처**: 모든 35개 모듈이 자기 module.config.ts에서 registerModule. middleware가 install + permission + tenant scope 체크.

---

## 1년 후 도입 PBC

| PBC | 출처 | 1차 소비 Pack |
|---|---|---|
| pbc-billing | Polar 래퍼 | 전 Pack (구독 결제) |
| pbc-consulting-crm | A.01~A.04 추출 | A |
| pbc-erp-inventory | F.02 | F |
| pbc-erp-orders | F.04 | F |
| pbc-file-manager | AXLE storage 추출 | A.05, E.01, F.01 |
| pbc-messaging | AXLE notification | 전체 알림 |
| pbc-scheduler | AXLE calendar | A.07 |

---

## 의존성 방향 (DAG)

```
apps/web (Layer 4)
   ↓
src/modules/* (Pack/Module 메타데이터)
   ↓
core-module-system (★)
   ↓
pbc-* + 횡단 packages
   ↓
@axle/db · @axle/auth · ...
```

**금지**:
- PBC 간 순환 의존
- Pack 간 직접 import (cross-pack은 PBC 또는 공통 contract 경유)
- PBC가 인증/결제/큐/스토리지 직접 의존
