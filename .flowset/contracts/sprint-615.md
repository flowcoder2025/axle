# Sprint Contract — WI-615-refactor apps/flowteams app-shell-ux 표준 sidebar+topbar 적용

> **CANCELLED** (2026-05-11): v3 모듈 시스템 도입으로 의미 변경. apps/flowteams 자체가 흡수 대상(WI-621). shell 적용은 무의미하므로 WI-621이 대체.

## 계약 상태
- [x] 리드 초안 작성
- [x] 자율 루프 진입 승인 (사용자, 2026-05-07)
- [x] **취소** (사용자, 2026-05-11) — WI-621로 대체

## 배경
`docs/specs/meta-platform/app-shell-ux.md`가 정의한 메타플랫폼 표준 shell(sidebar 1개 + topbar 1개)을 `apps/flowteams`가 따르지 않는다. 현재 flowteams의 `app/layout.tsx`는 metadata만 있고 sidebar/topbar 없음. AXLE web은 이미 sidebar+topbar 패턴이 있으므로, **flowteams가 동일 패턴을 공유하는지가 메타플랫폼의 핵심 검증 지표**.

`packages/ui/src/components/sidebar.tsx`가 이미 존재 — 이를 재사용한다.

## 수용 기준 (Acceptance Criteria)
- [ ] 1. `apps/flowteams/package.json`에 `@axle/ui` workspace 의존성 추가 (없으면)
- [ ] 2. `apps/flowteams/src/app/layout.tsx` 또는 `apps/flowteams/app/layout.tsx`(현재 위치 유지) 갱신:
  - SidebarProvider + AppSidebar(좌측) + TopBar(상단) + main 영역 구조
  - 하나의 페이지에 sidebar 1개 + topbar 1개 (사양 §"Sidebar는 한 개만, Topbar는 한 개만" 준수)
  - `data-testid="flowteams-shell"` 루트 div
- [ ] 3. `apps/flowteams/src/components/app-sidebar.tsx` 신규 작성 (또는 `components/` 디렉토리에):
  - 4개 메뉴 항목: Payroll(/payroll), Attendance(/attendance), Leave(/leave), Nomu(/nomu)
  - 각 항목 `data-testid="nav-{slug}"`
  - `@axle/ui`의 Sidebar 컴포넌트 사용 (직접 새로 만들지 말 것)
  - active 상태는 `usePathname` 기반
- [ ] 4. `apps/flowteams/src/components/top-bar.tsx` 신규 작성:
  - 좌측: SidebarTrigger (모바일 토글)
  - 우측: 사용자 영역 placeholder (이름 표시만, 인증 wiring은 본 WI 범위 외)
  - sticky top, border-bottom
- [ ] 5. 4개 페이지(payroll/attendance/leave/nomu) 모두 새 layout 안에서 정상 렌더 — 각 페이지의 기존 콘텐츠 변경 금지, layout만 감쌈
- [ ] 6. 4개 페이지 모두 4종 상태(Loading/Empty/Error/Success) 중 최소 Loading + Success 처리: Server Component면 Suspense + loading.tsx 활용 (기존 페이지가 이미 처리하면 추가 작업 불필요)
- [ ] 7. **DESIGN.md 토큰 정합**: globals.css 또는 layout 안의 inline style이 임의 색상 사용 금지. `@axle/ui`의 기존 Tailwind 토큰만 사용 (사양 "DESIGN.md 토큰 vs 새 토큰 발명 금지")
- [ ] 8. 단위 테스트 `apps/flowteams/__tests__/shell.test.tsx`:
  - layout 렌더 시 `flowteams-shell` testid 존재
  - sidebar에 4개 nav 항목 모두 존재
  - vitest + @testing-library/react 사용 (Playwright 금지)
- [ ] 9. `npx turbo lint build typecheck test --filter=flowteams` 전체 통과
- [ ] 10. **AXLE web의 sidebar/topbar 코드 변경 금지** — flowteams만 손댄다 (회귀 방지)

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=flowteams`
2. `grep -r "Sidebar" apps/flowteams/src/` 또는 `apps/flowteams/app/` → app-sidebar.tsx + layout.tsx 두 곳에서 import
3. evaluator: layout.tsx가 sidebar 1개 + topbar 1개만 가지는지(중복 sidebar 패턴 없는지) 확인
4. `git diff apps/web/` → 0 lines (회귀 없음)

## 산출물
| # | 파일 경로 | 설명 |
|---|---------|------|
| 1 | apps/flowteams/package.json | @axle/ui 의존성 |
| 2 | apps/flowteams/{src/}app/layout.tsx | sidebar+topbar shell |
| 3 | apps/flowteams/{src/}components/app-sidebar.tsx | 4 메뉴 sidebar |
| 4 | apps/flowteams/{src/}components/top-bar.tsx | sticky topbar |
| 5 | apps/flowteams/__tests__/shell.test.tsx | shell 렌더 테스트 |

> {src/}는 현재 flowteams 디렉토리 컨벤션을 따르라는 표시. 워커가 기존 구조를 확인 후 결정.

## 제약
- E2E 테스트(Playwright) 작성 금지
- AXLE web 코드 수정 금지
- 새로운 디자인 토큰 발명 금지 — `@axle/ui` Tailwind 토큰 사용
- 인증/권한 wiring 금지 (placeholder 사용자 표시만)
- DB 호출 추가 금지 (4 페이지 기존 동작 유지)
- 새 페이지 추가 금지 — 기존 4 페이지에 shell 적용만

## 평가 기준 유형
type: code
