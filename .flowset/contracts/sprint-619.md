# Sprint Contract — WI-619-feat 모듈 ReBAC (scope permissions)

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
35개 모듈마다 scope permission 필요. 기존 `packages/auth/` ReBAC을 확장해 모듈 scope 추가.
예: `customers:read`, `customers:write`, `payroll:write`, `hr:admin`, `tenant:<managedOrgId>`.

## 수용 기준
- [ ] 1. `packages/auth/src/rebac/scopes.ts` (또는 동등 위치):
  - 35 모듈 scope 상수 export: customers:* / projects:* / estimates:* / contracts:* / documents:* / portal:* / calendar:* / meetings:* / finance:* / analytics:* / programs:* / matching:* / journals:* / platform:admin (B admin들) / hr:read,write,admin / content:read,write,admin / erp:read,write / automation:* / certs:* / recording:*
  - `MODULE_SCOPES` 배열
- [ ] 2. `packages/auth/src/rebac/check.ts`:
  - `checkModulePermission(userId, orgId, scope: string): Promise<boolean>`
  - `getUserModuleScopes(userId, orgId): Promise<string[]>`
  - 기존 RelationTuple 패턴 활용
- [ ] 3. **Tenant scope** (Multi-org 대비, WI-620과 협력):
  - `tenant:*` (모든 ManagedOrg) / `tenant:<managedOrgId>` (특정)
  - `checkTenantScope(userId, activeTenantId): Promise<boolean>`
- [ ] 4. middleware/server action 사용 예제 5개를 README에 추가
- [ ] 5. 기존 권한 체크 호출(`getCurrentUser`, `requirePlatformAdmin`)과 호환 유지
- [ ] 6. 단위 테스트 `packages/auth/__tests__/module-rebac.test.ts`:
  - 7개 시나리오: 권한 없음 / 정확한 scope / 상위 scope / multi-org tenant 통과/거부
- [ ] 7. `apps/web` 안에 시범 적용: 1개 페이지(e.g., /payroll)에 module permission middleware 적용
- [ ] 8. `npx turbo lint build typecheck test --filter=@axle/auth --filter=web` 통과

## 검증 방법
1. `npm run test --workspace=@axle/auth -- module-rebac`
2. `apps/web` 빌드 통과 + middleware 동작 확인
3. evaluator: ReBAC RelationTuple 기존 형식과 일관성 유지

## 산출물
| # | 파일 |
|---|---|
| 1 | packages/auth/src/rebac/scopes.ts |
| 2 | packages/auth/src/rebac/check.ts (or 기존 확장) |
| 3 | packages/auth/__tests__/module-rebac.test.ts |
| 4 | apps/web/src/middleware.ts (or page) 시범 |
| 5 | packages/auth/README.md (scope 섹션 추가) |

## 제약
- 기존 packages/auth ReBAC 동작 회귀 금지
- 새 prisma model 추가 금지 (기존 RelationTuple 재사용)
- 시범 적용은 1개 페이지만 (전 페이지 적용은 후속 WI)

## 평가 기준 유형
type: code
