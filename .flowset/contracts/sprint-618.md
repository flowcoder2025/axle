# Sprint Contract — WI-618-feat 동적 사이드바 빌더

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
WI-616의 `buildSidebar()`를 apps/web의 layout과 통합. 활성 Pack × 사용자 권한 × active tenant 교차로 사이드바 동적 렌더.

상세 UI: `wireframes/shared/shell.html`.

## 수용 기준
- [ ] 1. `apps/web/src/lib/sidebar-builder.ts`:
  - `export async function buildPlatformSidebar(orgId, userId, activeTenant?): Promise<SidebarSection[]>`
  - 내부: getInstalledModules(orgId) + getUserPermissions(userId) + `@axle/core-module-system`의 `buildSidebar`
- [ ] 2. `apps/web/src/app/(platform)/layout.tsx` 갱신:
  - 기존 정적 nav 제거
  - `buildPlatformSidebar` 호출 결과로 nav 동적 렌더
  - SidebarProvider + AppSidebar(공유 컴포넌트) 사용
- [ ] 3. `apps/web/src/components/app-sidebar.tsx` 갱신:
  - props로 `sections: SidebarSection[]` 받음
  - 각 섹션이 Pack 단위로 그룹화 (label + nav items)
  - 미설치 Pack은 회색 표시 + "(미설치)" + 클릭 시 /settings/modules로 안내
- [ ] 4. 기존 hard-coded 12 nav 항목은 Pack A 모듈로 마이그레이션:
  - 다만 본 WI에서는 module-registry 호출 부분만 추가 (실제 module.config.ts는 WI-622)
  - 본 WI는 mock registry로 동작 검증
- [ ] 5. `data-testid` 적용:
  - `sidebar-section-{packId}`
  - `sidebar-nav-{moduleId}`
- [ ] 6. 단위 테스트 `apps/web/__tests__/sidebar-builder.test.ts`:
  - mock module registry
  - 시나리오 5개: Pack A만 / A+B / 모두 미설치 / 권한 일부 / multi-org active tenant
- [ ] 7. `npx turbo lint build typecheck test --filter=web` 통과
- [ ] 8. 기존 사이드바 동작 회귀 없음 (Pack A 모듈만이라도 표시되어야)

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=web`
2. `grep "buildPlatformSidebar" apps/web/src/app/\(platform\)/layout.tsx` → 1건
3. dev server 띄워서 사이드바 렌더 확인 (사용자 수동 검증 가능)

## 산출물
| # | 파일 |
|---|---|
| 1 | apps/web/src/lib/sidebar-builder.ts |
| 2 | apps/web/src/app/(platform)/layout.tsx (수정) |
| 3 | apps/web/src/components/app-sidebar.tsx (수정) |
| 4 | apps/web/__tests__/sidebar-builder.test.ts |

## 제약
- 실제 module.config.ts 작성 금지 (WI-622~626에서)
- ReBAC 권한 체크는 WI-619의 함수 호출 (본 WI는 mock perm input 사용 가능)
- 시각적 회귀 방지 — 기존 12 nav 항목이 적어도 동일 위치에 표시되어야

## 평가 기준 유형
type: code
