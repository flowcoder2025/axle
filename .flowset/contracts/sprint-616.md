# Sprint Contract — WI-616-feat packages/core-module-system

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
v3 모듈 시스템 (단일 플랫폼 + 6 Pack × 35 모듈 + Multi-org tenancy)의 foundation 패키지.
모든 모듈이 이 패키지를 통해 register/install/sidebar 빌드.
WI-617~626이 본 패키지에 의존하므로 가장 먼저.

상세 사양: `wireframes/architecture.md` §4 + `wireframes/module-catalog.md`.

## 수용 기준
- [ ] 1. `packages/core-module-system/` 신규 패키지 생성:
  - `package.json` (name: `@axle/core-module-system`)
  - `tsconfig.json` (기존 packages 패턴)
  - `src/index.ts` (public API)
- [ ] 2. `src/types.ts`:
  - `ModuleConfig` 인터페이스 — id / packId / label / icon? / route / permission / multiOrg / pbc / deps:{hard?,soft?} / prismaModels / widgets? / onInstall? / onUninstall? / admin? / requiresDesktop?
  - `PackConfig` 인터페이스 — id / label / modules[] / pricing:{monthly,perUnit?} / recommended? / icon?
  - `SidebarSection`, `NavItem`, `WidgetDef` 타입
- [ ] 3. `src/registry.ts`:
  - `registerModule(config: ModuleConfig): void` — 내부 Map에 저장
  - `registerPack(config: PackConfig): void`
  - `getModule(id): ModuleConfig | undefined`
  - `getPack(id): PackConfig | undefined`
  - `listModules(): ModuleConfig[]` / `listPacks(): PackConfig[]`
  - `clearRegistry(): void` (테스트용)
- [ ] 4. `src/installer.ts`:
  - `installModule(orgId, moduleId, deps: {prisma}): Promise<void>` — prisma `OrgModuleInstall` 테이블에 (orgId, moduleId, installedAt) 기록 + onInstall hook 실행
  - `installPack(orgId, packId, deps): Promise<void>` — pack.modules 전체 install (dependency 순서대로)
  - `uninstallModule(orgId, moduleId, deps): Promise<void>` — 의존하는 모듈 cascade 확인 후 제거
  - `getInstalledModules(orgId, deps): Promise<string[]>`
  - `isModuleInstalled(orgId, moduleId, deps): Promise<boolean>`
- [ ] 5. `src/dependencies.ts`:
  - `checkDependencies(moduleId, installedSet: Set<string>): { ok; missing: string[] }` — hard deps만 검사
  - `topologicalSort(moduleIds: string[]): string[]` — install 순서 결정
  - `findDependents(moduleId): string[]` — uninstall 시 cascade 확인용
- [ ] 6. `src/sidebar.ts`:
  - `buildSidebar(input: { orgId; userId; activeTenant?; installedModules; userPermissions }): SidebarSection[]`
  - Pack 그룹별 정렬 (recommended 우선, 그 외 알파벳)
  - admin 모듈은 별도 섹션
  - multi-org 모듈은 active tenant에 따라 데이터 scope 표시 (UI 힌트)
- [ ] 7. `src/index.ts` 모든 public API export
- [ ] 8. 단위 테스트 `__tests__/`:
  - registry.test.ts (register/get/list)
  - installer.test.ts (mock prisma — install/uninstall/cascade)
  - dependencies.test.ts (위상정렬, missing 감지)
  - sidebar.test.ts (다양한 시나리오: Pack A만, A+D, admin 권한, multi-org 등)
  - 최소 20개 case, 커버리지 ≥ 80%
- [ ] 9. README.md — 사용 예제 3개 (registerModule / installPack / buildSidebar)
- [ ] 10. **`packages/db/prisma/schema.prisma`에 `OrgModuleInstall` model 추가**:
  ```prisma
  model OrgModuleInstall {
    id           String   @id @default(cuid())
    orgId        String
    moduleId     String   // e.g. "customers", "payroll"
    installedAt  DateTime @default(now())
    settings     Json?
    @@unique([orgId, moduleId])
    @@index([orgId])
  }
  ```
  - 마이그레이션 자동 생성 + 적용
- [ ] 11. `npx turbo lint build typecheck test --filter=@axle/core-module-system` 통과
- [ ] 12. root workspace에 패키지 등록 (npm workspaces 자동 인식)

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=@axle/core-module-system`
2. `node -e "const m=require('./packages/core-module-system/dist'); console.log(typeof m.registerModule, typeof m.buildSidebar)"` → 모두 `function`
3. evaluator: ModuleConfig 타입이 사양 §4 (PRD + wireframes/architecture.md)와 정합
4. Prisma migration 적용 검증: `npx prisma migrate dev`

## 산출물
| # | 파일 | 설명 |
|---|---|---|
| 1 | packages/core-module-system/package.json | 패키지 매니페스트 |
| 2 | packages/core-module-system/tsconfig.json | TS 설정 |
| 3 | packages/core-module-system/src/types.ts | ModuleConfig + PackConfig |
| 4 | packages/core-module-system/src/registry.ts | register/get/list |
| 5 | packages/core-module-system/src/installer.ts | install/uninstall (prisma 의존) |
| 6 | packages/core-module-system/src/dependencies.ts | 위상정렬 + cascade |
| 7 | packages/core-module-system/src/sidebar.ts | buildSidebar |
| 8 | packages/core-module-system/src/index.ts | public API export |
| 9 | packages/core-module-system/__tests__/* | 단위 테스트 |
| 10 | packages/core-module-system/README.md | 사용 예제 |
| 11 | packages/db/prisma/schema.prisma | OrgModuleInstall model |

## 제약
- Prisma 직접 의존 금지 — `deps.prisma` 주입 패턴 사용 (테스트 mock 가능)
- React/JSX 사용 금지 — 순수 TS 패키지 (sidebar는 데이터 구조만 반환, JSX는 소비처가 렌더)
- 결제/실제 ManagedOrg 모델은 본 WI 범위 외 (WI-620에서)
- ReBAC scope 검증은 본 WI 범위 외 (WI-619에서 — buildSidebar는 permission 결과를 input으로 받음)

## 평가 기준 유형
type: code
