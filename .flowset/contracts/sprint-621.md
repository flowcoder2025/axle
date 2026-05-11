# Sprint Contract — WI-621-refactor apps/flowteams → apps/web/src/modules/hr 마이그레이션

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
v3 단일 플랫폼 모델에서 apps/flowteams 별도 앱은 불필요. 4개 페이지 + services.ts를 apps/web에 흡수.

## 수용 기준
- [ ] 1. 페이지 마이그레이션:
  - apps/flowteams/app/payroll/page.tsx → apps/web/src/app/(platform)/payroll/page.tsx
  - apps/flowteams/app/attendance/page.tsx → apps/web/src/app/(platform)/attendance/page.tsx
  - apps/flowteams/app/leave/page.tsx → apps/web/src/app/(platform)/leave/page.tsx
  - apps/flowteams/app/nomu/page.tsx → apps/web/src/app/(platform)/nomu/page.tsx
- [ ] 2. services 이전:
  - apps/flowteams/lib/services.ts → apps/web/src/modules/hr/services.ts
  - 호출자(위 4 페이지)의 import 경로 갱신
- [ ] 3. `apps/web/package.json`에 `@axle/pbc-hr-payroll` workspace dep 추가 (없으면)
- [ ] 4. **WI-612의 createPayrollService 활용**: payroll 페이지가 stateless `calculatePayroll` 직접 호출이 아니라 `createPayrollService({prisma}).calculate()` 사용
- [ ] 5. `apps/flowteams/` **디렉토리 통째로 제거**:
  - `git rm -r apps/flowteams/`
  - `package.json` workspaces에서 `apps/flowteams` 제거 (있다면)
  - turbo.json에 flowteams 관련 task가 있다면 제거
  - `.github/workflows/` 안 flowteams 관련 step 제거
- [ ] 6. 기존 페이지 동작 유지 검증:
  - 4 페이지 모두 build 성공
  - 페이지 렌더 시 같은 출력 (서버 사이드 계산 결과 JSON)
- [ ] 7. 단위 테스트 이전:
  - apps/flowteams/__tests__/* (있다면) → apps/web/__tests__/modules/hr/
- [ ] 8. **WI-624 (Pack D 모듈 메타데이터) 연계**: 본 WI는 페이지/서비스 이전만, module.config.ts 작성은 WI-624. 단 본 WI 페이지가 향후 module-aware middleware 통합되어야 하므로 라우트 경로는 module.config의 `route` 필드와 일치해야 함
- [ ] 9. `npx turbo lint build typecheck test` 전체 통과 (flowteams 빠진 후 회귀 없음)
- [ ] 10. `git mv` 사용해서 git 이력 보존

## 검증 방법
1. `cd /Volumes/포터블/AXLE && ls apps/` → flowteams 없음
2. `npx turbo build` 전체 통과
3. `grep -r "@axle/flowteams" .` → 0건 (참조 없음)
4. dev server 띄워서 /payroll /attendance /leave /nomu 접근 → 렌더 검증

## 산출물
| # | 파일 |
|---|---|
| 1 | apps/web/src/app/(platform)/payroll/page.tsx (이전) |
| 2 | apps/web/src/app/(platform)/attendance/page.tsx (이전) |
| 3 | apps/web/src/app/(platform)/leave/page.tsx (이전) |
| 4 | apps/web/src/app/(platform)/nomu/page.tsx (이전) |
| 5 | apps/web/src/modules/hr/services.ts (이전) |
| 6 | apps/web/package.json (dep 추가) |
| 7 | apps/flowteams/ 디렉토리 제거 |
| 8 | package.json / turbo.json / .github/workflows/* (정리) |

## 제약
- prisma schema 변경 금지 (HR 모델은 이미 존재)
- E2E 테스트 작성 금지
- module.config.ts 작성 금지 (WI-624)
- 4 페이지의 비즈니스 로직 변경 금지 — 위치만 이동

## 평가 기준 유형
type: code
