# Sprint Contract — WI-617-feat Pack 카탈로그 UI (/settings/modules)

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
조직 관리자가 6 Pack × 35 모듈을 install/uninstall하는 카탈로그 페이지.
WI-616의 `installPack` / `installModule` API 호출.

상세 UI 사양: `wireframes/platform/pack-catalog.html`.

## 수용 기준
- [ ] 1. `apps/web/src/app/(platform)/settings/modules/page.tsx` — RSC, org-admin 권한 체크
- [ ] 2. 페이지 구조:
  - 상단 요약 카드 4-card (활성 Pack 수 / 활성 모듈 수 / 월 청구액 / 관리 조직 수)
  - "Tenancy Tier" 섹션 (Single-org / Multi-org 토글 — WI-620 통합 지점, 본 WI는 UI placeholder)
  - "Pack 카탈로그" 6개 카드 grid
  - 개별 모듈 install 섹션 (Pack 미사용 시)
- [ ] 3. 각 Pack 카드 표시 항목:
  - icon + 제목 + 설치 여부 배지
  - 설명 (1-2줄)
  - 포함 모듈 chip (multi-org 모듈은 ⊛ 표시)
  - 가격
  - 설치 시: [설정] [제거] / 미설치: [설치하기] [자세히]
- [ ] 4. 설치 액션 (Server Action):
  - `installPackAction(packId)` → `installPack(orgId, packId, {prisma})`
  - 결제 정보 없을 시 결제 모달 표시 (placeholder OK)
  - 성공 시 toast + 페이지 revalidate
- [ ] 5. 제거 액션 (Server Action):
  - `uninstallPackAction(packId)` → dependents 확인 → 사용자 confirm → uninstallModule cascade
  - 30일 보관 안내 표시
- [ ] 6. `apps/web/src/app/(platform)/settings/modules/loading.tsx` — Suspense skeleton
- [ ] 7. zod 스키마로 form 입력 검증
- [ ] 8. data-testid 적용:
  - `pack-catalog-page`
  - `pack-card-{packId}` (A, B, D, E, F, G)
  - `install-pack-button-{packId}`
  - `uninstall-pack-button-{packId}`
- [ ] 9. 단위 테스트 `__tests__/modules-catalog-page.test.tsx`:
  - vitest + @testing-library/react
  - 6 Pack 카드 모두 렌더
  - install 시 server action 호출 검증 (mock)
- [ ] 10. `npx turbo lint build typecheck test --filter=web` 통과

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=web`
2. `grep -c "pack-card-" apps/web/src/app/\(platform\)/settings/modules/page.tsx` → 6 이상
3. evaluator: 와이어프레임 platform/pack-catalog.html 구조 정합

## 산출물
| # | 파일 |
|---|---|
| 1 | apps/web/src/app/(platform)/settings/modules/page.tsx |
| 2 | apps/web/src/app/(platform)/settings/modules/loading.tsx |
| 3 | apps/web/src/app/(platform)/settings/modules/actions.ts (server actions) |
| 4 | apps/web/src/components/pack-card.tsx |
| 5 | apps/web/__tests__/modules-catalog-page.test.tsx |

## 제약
- Multi-org tier 토글은 placeholder만 (WI-620 합류 시 활성)
- 실제 결제 모달 구현 금지 (placeholder)
- E2E 테스트 작성 금지 (워커 룰 §7)
- 사이드바 갱신 로직은 WI-618에 위임

## 평가 기준 유형
type: code
