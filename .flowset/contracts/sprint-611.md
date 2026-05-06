# Sprint Contract — WI-611-feat pbc-image-engine generate() + getEstimatedCost() orchestrator

## 계약 상태
- [x] 리드 초안 작성
- [x] 자율 루프 진입 승인 (사용자, 2026-05-07)

## 배경
`docs/specs/meta-platform/pbc-image-engine.md` §3.2 Public API가 명시한 3개 export 중
`generate()`와 `getEstimatedCost()`가 미구현이다. README는 우회로 "provider.generate()를 직접 호출"하라고 안내한다 (PBC 추상화 누수).
`PRESETS`은 이미 export되어 있다.

`packages/pbc-image-engine/src/index.ts:6` 주석이 "WI-403 lands the orchestrator"라고 적혀 있고
`src/types.ts:114`도 동일 미구현 기록을 담고 있다. WI-403은 fix_plan에 [x]로 마킹돼 있으나 사양 §3.2 핵심 Public API 3건 중 2건이 누락된 상태.

본 WI는 그 누락분을 메운다.

## 수용 기준 (Acceptance Criteria)
- [ ] 1. `packages/pbc-image-engine/src/generate.ts` 신규 작성:
  - `export async function generate(req: GenerationRequest): Promise<GenerationResult>` 시그니처
  - 내부에서 `selectProvider(req)` 호출 → 해당 `ImageProviderAdapter.generate()`로 위임
  - provider 선택 실패 / generation 실패 시 `ImageGenerationError`로 정규화
  - prompt 정규화는 별도 `promptBuilder.ts`로 분리 (사양 §4 패키지 구조)
- [ ] 2. `packages/pbc-image-engine/src/promptBuilder.ts` 신규 작성:
  - `export function buildPrompt(req: GenerationRequest): string` — preset/mode/aspect 반영
  - 7개 mode 모두 처리 (CREATE/EDIT/POSTER/DETAIL_EDIT/RETOUCH 외 사양 정의 모드)
- [ ] 3. `packages/pbc-image-engine/src/cost.ts` 신규 작성:
  - `export function getEstimatedCost(req: GenerationRequest): { credits: number; usd: number }`
  - provider × resolution × aspectRatio 기반 산정 (보수적 추정 OK, 단 0/NaN 금지)
  - 알 수 없는 조합은 기본값 + warning 로깅 없이 안전한 양수 반환
- [ ] 4. `src/index.ts`에 `generate`, `getEstimatedCost` export 추가, 주석의 "WI-403 lands" 문구 제거
- [ ] 5. `src/index.ts`의 `ImageEngine` 타입 export가 신규 함수와 호환됨을 컴파일러가 검증
- [ ] 6. **provider 의존성 주입 가능해야 함** — `generate(req, { providers? })` 옵션으로 테스트에서 mock 주입 가능 (실 네트워크 호출 회피)
- [ ] 7. 단위 테스트 `__tests__/generate.test.ts`:
  - mock provider로 5개 mode 호출 성공
  - provider 실패 시 `ImageGenerationError` throw
  - selectProvider가 명시 provider 옵션을 우선시함
  - 최소 5개 case
- [ ] 8. 단위 테스트 `__tests__/cost.test.ts`:
  - 5 provider × 2 resolution 매트릭스, 모두 양수 credits/usd
  - 동일 입력 idempotent
- [ ] 9. README의 "Direct provider call" 우회 안내 섹션을 "Use generate()" 정식 안내로 교체. 5개 사용 예제 중 최소 3개를 `generate()` 사용형으로 갱신
- [ ] 10. `npx turbo lint build typecheck test --filter=@axle/pbc-image-engine` 전체 통과

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=@axle/pbc-image-engine`
2. `node -e "const m=require('./packages/pbc-image-engine/dist/index.js'); console.log(typeof m.generate, typeof m.getEstimatedCost, typeof m.PRESETS)"` — 모두 `function` / `function` / `object`
3. evaluator: types.ts:114 주석과 index.ts 주석이 "lands"가 아닌 "shipped"로 갱신되었는지 확인
4. 기존 v1/re/v2 compat 모듈이 깨지지 않는지 빌드 확인

## 산출물
| # | 파일 경로 | 설명 |
|---|---------|------|
| 1 | packages/pbc-image-engine/src/generate.ts | orchestrator |
| 2 | packages/pbc-image-engine/src/promptBuilder.ts | prompt 정규화 |
| 3 | packages/pbc-image-engine/src/cost.ts | getEstimatedCost |
| 4 | packages/pbc-image-engine/src/index.ts | generate/getEstimatedCost export 추가 |
| 5 | packages/pbc-image-engine/__tests__/generate.test.ts | 단위 테스트 |
| 6 | packages/pbc-image-engine/__tests__/cost.test.ts | 단위 테스트 |
| 7 | packages/pbc-image-engine/README.md | 우회 안내 → 정식 안내 |
| 8 | packages/pbc-image-engine/CHANGELOG.md | "Add generate() + getEstimatedCost() orchestrators" 항목 |

## 제약
- 실제 외부 API(Google GenAI, OpenRouter 등) 호출 금지 — 테스트는 모두 mock provider
- compat/flowstudio-v1, compat/flowstudio-re, compat/flowstudio-v2의 기존 동작 변경 금지 (provider 직접 사용 유지 OK)
- credits/usd 산식이 매우 단순해도 OK — 단 0이거나 음수 금지
- API 키, 시크릿 코드/로그/테스트에 기록 금지

## 평가 기준 유형
type: code
