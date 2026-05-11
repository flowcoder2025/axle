# Sprint Contract — WI-614-feat apps/web에 pbc-block-builder 사용 데모 페이지

> **CANCELLED** (2026-05-11): v3 모듈 시스템 도입으로 의미 변경. "데모 페이지"가 아니라 모듈 시스템 자체를 구축하면 자연스럽게 PBC 사용 evidence가 생김. WI-622 (Pack A 모듈 메타데이터)와 WI-625 (Pack E 모듈)가 대체.

## 계약 상태
- [x] 리드 초안 작성
- [x] 자율 루프 진입 승인 (사용자, 2026-05-07)
- [x] **취소** (사용자, 2026-05-11) — v3 모듈 시스템으로 대체

## 배경
`grep -r "@axle/pbc-block-builder" apps/web/` → 0건. PBC가 추출됐지만 AXLE web 어디에서도 사용되지 않아 "메타플랫폼 위에서 도메인 앱이 PBC를 사용한다"는 핵심 검증 지표가 비어 있다. 사양 §5 Acceptance도 "FlowStudio v2가 PBC API로 동작"을 요구하나 cross-repo는 본 audit 범위 밖이라, AXLE web 자체에 데모 1건을 두어 PBC 사용 evidence를 확보한다.

## 수용 기준 (Acceptance Criteria)
- [ ] 1. `apps/web/package.json`에 `@axle/pbc-block-builder` workspace 의존성 추가 (`"workspace:*"`)
- [ ] 2. `apps/web/src/app/(marketing)/showcase/page.tsx` 신규 작성:
  - Server Component
  - `import { renderComposition, PRESETS } from "@axle/pbc-block-builder"` 사용
  - `landing-saas` PRESET 사용하여 정적 composition 정의 (4-6개 블록: A1-hero, B1, C2, D1, E1 등)
  - composition을 `renderComposition(composition, { format: "react", theme: defaultTheme })` 으로 렌더 → JSX 반환
  - 페이지에 `data-testid="block-builder-showcase"` 루트 div
- [ ] 3. `apps/web/src/app/(marketing)/showcase/composition.ts` 작성:
  - `export const showcaseComposition: BlockComposition` — 정적 데이터(한국어 카피)
- [ ] 4. AXLE web 사이드바/네비에 추가 항목 강제 금지 — 숨겨진 라우트로 두고 직접 URL로만 접근 (메타플랫폼 데모 목적)
- [ ] 5. 단위 테스트 `apps/web/__tests__/showcase-page.test.ts`:
  - showcaseComposition이 BlockComposition zod schema 검증 통과
  - 블록이 최소 4개 이상
  - vitest로 작성 (Playwright 금지 — E2E는 워커 작성 금지 룰 준수)
- [ ] 6. `apps/web` 빌드 시 `(marketing)/showcase` 라우트가 정적 생성되는지 확인 (Next.js 16 RSC):
  - `npx turbo build --filter=web` 통과
  - `.next` 출력에 `app/(marketing)/showcase/page` 청크 존재
- [ ] 7. **`packages/pbc-block-builder`가 `apps/web`에서 import 가능하도록 export 경로 검증**: `packages/pbc-block-builder/package.json`의 exports 필드가 RSC 환경(server component)에서 동작해야 함. import 실패 시 exports 필드 보정
- [ ] 8. `npx turbo lint build typecheck test --filter=web` 통과

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
2. `grep -r "@axle/pbc-block-builder" apps/web/` → 1건 이상
3. evaluator: page.tsx가 실제로 `renderComposition`을 호출하는지(import 후 미사용 아닌지) 확인
4. 사용자 수동 검증(범위 외): `npm run dev` → http://localhost:3000/showcase 접속 시 4-6개 블록 렌더링

## 산출물
| # | 파일 경로 | 설명 |
|---|---------|------|
| 1 | apps/web/package.json | @axle/pbc-block-builder 의존성 추가 |
| 2 | apps/web/src/app/(marketing)/showcase/page.tsx | 데모 페이지 (RSC) |
| 3 | apps/web/src/app/(marketing)/showcase/composition.ts | 정적 composition |
| 4 | apps/web/__tests__/showcase-page.test.ts | composition validation 테스트 |
| 5 | packages/pbc-block-builder/package.json | exports 필드 보정 (필요 시) |

## 제약
- E2E 테스트(Playwright) 작성 금지 — `wi-flowset.md` §7 준수
- DB 호출 금지 — 정적 composition만
- AI 호출 금지 — 카피는 정적 작성 (한국어)
- `(marketing)` 그룹 외부에 배치 금지 (사이드바 회피)
- 신규 컴포넌트(블록 외) 추가 금지 — PBC 블록만 사용
- 새로운 환경변수 도입 금지

## 평가 기준 유형
type: code
