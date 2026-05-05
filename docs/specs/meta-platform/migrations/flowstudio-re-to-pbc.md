# FlowStudio_re → @axle/pbc-image-engine 마이그레이션 플레이북

> **WI-408**, Phase 19. FlowStudio_re는 FlowStudio v1의 fork로 추정되며, `lib/imageProvider/`의 공개 형태를 그대로 사용합니다 (spec: `pbc-image-engine.md` §2). 본 문서는 v1 플레이북(`flowstudio-v1-to-pbc.md`)의 §0~§6를 그대로 적용하면서 RE 프로젝트의 import 경로 차이만을 명시합니다. 검증 단계에서 v1과 다른 동작이 발견되면 본 문서의 §3-§4를 분기로 보강하세요.

## 0. 사전 준비

- [ ] FlowStudio_re 레포에서 `lib/imageProvider/` 디렉토리의 모든 callsite 파악 (`grep -rn "from .*lib/imageProvider"`).
- [ ] FlowStudio_re가 사용하는 환경변수 확인: `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `IMAGE_PROVIDER` (default `google`).
- [ ] FlowStudio_re `package.json`에 `@axle/pbc-image-engine` 의존성 추가 — workspace 미포함 시 npm/yarn link 또는 publish 필요.
- [ ] **v1과의 diff 검증** — FlowStudio_re 코드베이스를 v1과 1회 비교하여 `lib/imageProvider/`에 추가 옵션·필드·기본값 변경이 있는지 확인. 동일하다면 본 문서를 그대로 진행. 다르다면 §3-§4에서 분기 추가.

## 1. 1-line import 교체

PBC는 FlowStudio_re의 public 함수 시그니처를 보존하는 facade를 제공합니다. v1 facade에 위임하므로 동작은 100% 동일합니다.

```diff
- import { generateImage } from "@/lib/imageProvider";
+ import { generateImage } from "@axle/pbc-image-engine/compat/flowstudio-re";
```

이외의 callsite는 변경 불필요. 동일한 옵션 객체(`{ prompt, env?, model?, sourceImage?, refImages?, negativePrompt?, aspectRatio?, count?, metadata?, signal? }`)와 결과 객체(`{ images, provider, model, durationMs, metadata? }`)가 보존됩니다.

> **메모:** 별도 `re` 경로를 둔 이유는 (1) RE 프로젝트의 grep / dependency 추적 일관성, (2) 향후 v1과 분기될 가능성에 대비한 격리, (3) RE-only PR 식별용입니다.

## 2. 환경변수 매핑

| FlowStudio_re 변수 | PBC 변수 | 비고 |
|---|---|---|
| `GEMINI_API_KEY` | `GEMINI_API_KEY` (또는 `GOOGLE_GENAI_API_KEY`) | 변경 없음 |
| `OPENROUTER_API_KEY` | `OPENROUTER_API_KEY` | 변경 없음 |
| `IMAGE_PROVIDER` (`google` \| `openrouter`) | 동일 | 변경 없음 |

기존 `.env`/Vercel env 그대로 사용 가능. 추가 액션 불필요.

## 3. 에러 처리 변경 (BREAKING — 1곳)

FlowStudio_re는 v1과 동일하게 vendor 에러를 그대로 throw 했으나 PBC는 `ImageGenerationError`(code + retryable)로 정규화합니다.

```diff
  try {
    const result = await generateImage({ prompt });
- } catch (err) {
-   if (err.status === 429) // rate limit
+ } catch (err) {
+   if (err instanceof ImageGenerationError && err.code === "QUOTA_EXCEEDED")
  }
```

`ImageGenerationError`는 compat 모듈이 함께 re-export하므로 import 경로는 그대로:

```ts
import {
  generateImage,
  ImageGenerationError,
} from "@axle/pbc-image-engine/compat/flowstudio-re";
```

| FlowStudio_re 에러 식별 | PBC code |
|---|---|
| `err.status === 400` | `INVALID_INPUT` |
| `err.status === 401 / 403` | `PROVIDER_UNAVAILABLE` |
| `err.status === 429` | `QUOTA_EXCEEDED` (`retryable: true`) |
| `err.status >= 500` | `PROVIDER_UNAVAILABLE` (`retryable: true`) |
| 네트워크 예외 | `PROVIDER_UNAVAILABLE` (`retryable: true`) |
| Safety filter 차단 | `CONTENT_FILTERED` |

## 4. 동작 보존 검증 (자동)

Compat 모듈에는 단위 테스트가 포함됩니다 — `packages/pbc-image-engine/__tests__/compat/flowstudio-re.test.ts`. 본 테스트는 v1 facade에 위임된 동작이 RE의 export 경로에서 동일하게 노출되는지 검증합니다. 회귀 발생 시 PBC CI가 차단합니다.

수동 검증 체크리스트 (마이그레이션 후 RE 레포에서 실행):

- [ ] `IMAGE_PROVIDER=google` + 텍스트만 → 정상 이미지 생성
- [ ] `IMAGE_PROVIDER=openrouter` + 텍스트만 → 정상 이미지 생성
- [ ] `sourceImage` 첨부 → EDIT 모드로 동작 (PBC가 mode를 자동 선택)
- [ ] `model: "openai/dall-e-3"` 같은 explicit override 동작
- [ ] 429 응답 → `ImageGenerationError(code="QUOTA_EXCEEDED", retryable=true)`
- [ ] **v1과의 호환:** RE 레포에서 두 facade를 한꺼번에 import 했을 때 type/symbol 충돌 없음 (`Re*` 접두로 분리됨)

## 5. 점진 롤아웃 (권장)

1. **Day 1**: PR 1개 — feature flag(`USE_PBC_IMAGE_ENGINE`)로 토글, RE 레포의 `lib/imageProvider/index.ts`에서 두 import를 모두 export.
2. **Day 2-3**: staging에서 100% PBC로 트래픽, 에러율·지연시간 모니터링.
3. **Day 4**: production 10% → 50% → 100% canary.
4. **Day 5+**: feature flag 제거, RE의 `lib/imageProvider/` 디렉토리 삭제.

## 6. 검증 후 정리 (cleanup PR)

마이그레이션 안정화 후 RE 레포에서 다음을 삭제:

- `lib/imageProvider/google.ts`, `lib/imageProvider/openrouter.ts` (어댑터 중복)
- `lib/imageProvider/types.ts` (PBC 타입으로 대체됨)
- 관련 vendor SDK 의존성 (`@google/genai` 등) — PBC가 dep-free fetch 기반이라 RE 레포의 SDK 의존성은 모두 제거 가능

## 7. v1과의 분기가 필요해질 경우 (향후 절차)

만약 §0의 diff 검증 또는 §4의 수동 검증에서 v1과 다른 동작이 발견되면:

1. `packages/pbc-image-engine/src/compat/flowstudio-re/types.ts` — type alias 대신 자체 타입 선언으로 전환.
2. `packages/pbc-image-engine/src/compat/flowstudio-re/generateImage.ts` — `v1GenerateImage` 위임 제거하고 자체 변환 로직 구현.
3. `packages/pbc-image-engine/__tests__/compat/flowstudio-re.test.ts` — 분기된 동작 케이스 추가.
4. 본 문서의 §3 / §4에 "v1과 다른 점" 표 추가.

위임 구조 덕분에 분기 시점에도 RE callsite는 import 경로를 변경하지 않아도 됩니다.

## 변경 이력

| 일자 | 항목 | 비고 |
|---|---|---|
| 2026-05-05 | 초안 작성 (WI-408) | v1 facade 위임 + RE 전용 import 경로 도입 |
