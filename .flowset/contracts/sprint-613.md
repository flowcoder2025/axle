# Sprint Contract — WI-613-feat packages/core-design-md 신규 PBC

## 계약 상태
- [x] 리드 초안 작성
- [x] 자율 루프 진입 승인 (사용자, 2026-05-07)

## 배경
`docs/specs/meta-platform/PRD.md` §4 L2-B1이 명시한 `core-design-md` 패키지가 미존재.
`docs/specs/meta-platform/themes/flowcoder-default.design.md`는 작성됐으나 이를 실제 앱에 주입하는 로더가 없다. 메타플랫폼의 "DESIGN.md 1개 시범 앱 적용" 성공기준이 미충족.

본 WI는 **Minimal Viable Loader**를 구축한다 — 토큰 추출 + Tailwind/CSS var 주입 hook까지. 전체 DESIGN.md 모든 섹션 파싱은 후속 WI 범위.

## 수용 기준 (Acceptance Criteria)
- [ ] 1. `packages/core-design-md/` 신규 패키지 생성:
  - `package.json` (name: `@axle/core-design-md`, type: module, peerDeps: 없음)
  - `tsconfig.json` (extends 기존 packages tsconfig 패턴)
  - `src/index.ts` (public API)
- [ ] 2. `packages/core-design-md/src/parser.ts`:
  - `export function parseDesignMd(source: string): DesignTokens` — DESIGN.md 본문에서 토큰 추출
  - 최소 추출 대상: §2 Color Palette의 Neutral Scale 표(Light/Dark hex 컬럼) + Sidebar 표
  - markdown table 파싱: regex 기반으로 충분 (외부 markdown parser 의존 금지)
  - Hex 값이 아닌 row(rgba/calc 등)는 스킵하되 에러 throw 금지
- [ ] 3. `packages/core-design-md/src/types.ts`:
  - `export interface DesignTokens { colors: { light: Record<string, string>; dark: Record<string, string> }; sidebar: { light: Record<string, string>; dark: Record<string, string> }; meta: { name: string; category?: string } }`
  - 토큰 키는 kebab-case (예: `text-primary`, `border-default`, `surface-raised`)
- [ ] 4. `packages/core-design-md/src/loader.ts`:
  - `export async function loadDesignTokens(filePath: string): Promise<DesignTokens>` — Node fs로 파일 읽기 후 parseDesignMd 호출
  - 파일 미존재 시 `Error("Design file not found: <path>")` throw
- [ ] 5. `packages/core-design-md/src/inject.ts`:
  - `export function tokensToCssVariables(tokens: DesignTokens): { light: string; dark: string }` — `:root { --text-primary: #18181B; ... }` 형태의 CSS 문자열 생성
  - `export function tokensToTailwindConfig(tokens: DesignTokens): Record<string, unknown>` — Tailwind v4 `@theme` 호환 객체 (color extension)
- [ ] 6. `packages/core-design-md/src/index.ts`에 위 4개 함수와 `DesignTokens` 타입 export
- [ ] 7. 단위 테스트 `__tests__/parser.test.ts`:
  - flowcoder-default.design.md 파일을 fixture로 사용
  - `parseDesignMd` 결과 `colors.light["text-primary"] === "#18181B"`, `colors.dark["text-primary"] === "#FAFAFA"` 등 5개 이상 토큰 검증
  - 빈 문자열 → 빈 토큰 객체 반환 (throw 안 함)
  - 손상된 markdown table → 스킵 (throw 안 함)
- [ ] 8. 단위 테스트 `__tests__/inject.test.ts`:
  - `tokensToCssVariables` 출력에 `--text-primary: #18181B;` 포함
  - `tokensToTailwindConfig` 출력이 plain object (직렬화 가능)
- [ ] 9. README.md 작성: 사용 예제 2개 (loadDesignTokens + tokensToCssVariables, tokensToTailwindConfig)
- [ ] 10. **시범 적용**: `apps/web/src/lib/design-tokens.ts` 생성하여 `loadDesignTokens('docs/specs/meta-platform/themes/flowcoder-default.design.md')`을 build-time 또는 server component에서 호출하는 헬퍼 export. 실제 globals.css 교체는 본 WI 범위 외 (verification으로 충분)
- [ ] 11. `npx turbo lint build typecheck test --filter=@axle/core-design-md` 전체 통과
- [ ] 12. workspace 의존성 등록: root `package.json` workspaces에 추가 (이미 `packages/*` 패턴이면 자동 인식)

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=@axle/core-design-md`
2. `node -e "const m=require('./packages/core-design-md/dist/index.js'); m.loadDesignTokens('./docs/specs/meta-platform/themes/flowcoder-default.design.md').then(t=>console.log(t.colors.light['text-primary']))"` → `#18181B`
3. evaluator: parser가 외부 markdown library 의존성 없이 동작하는지 확인 (regex만 사용)
4. `apps/web/src/lib/design-tokens.ts`가 빌드되는지 확인

## 산출물
| # | 파일 경로 | 설명 |
|---|---------|------|
| 1 | packages/core-design-md/package.json | 패키지 매니페스트 |
| 2 | packages/core-design-md/tsconfig.json | TS 설정 |
| 3 | packages/core-design-md/src/index.ts | public API |
| 4 | packages/core-design-md/src/parser.ts | markdown table 파서 |
| 5 | packages/core-design-md/src/types.ts | DesignTokens 인터페이스 |
| 6 | packages/core-design-md/src/loader.ts | 파일 로더 |
| 7 | packages/core-design-md/src/inject.ts | CSS var/Tailwind 변환 |
| 8 | packages/core-design-md/__tests__/parser.test.ts | 파서 테스트 |
| 9 | packages/core-design-md/__tests__/inject.test.ts | inject 테스트 |
| 10 | packages/core-design-md/README.md | 사용 예제 |
| 11 | apps/web/src/lib/design-tokens.ts | 시범 헬퍼 |

## 제약
- markdown 파서 라이브러리(remark, marked, unified 등) 의존 금지 — regex로 표 파싱
- 본 WI에서 globals.css 변경 금지 — 헬퍼 export만
- DESIGN.md §1, §3 이후 섹션(타이포/spacing/component) 파싱은 본 WI 범위 외 (후속 WI)
- React 컴포넌트 생성 금지 — 순수 함수 패키지

## 평가 기준 유형
type: code
