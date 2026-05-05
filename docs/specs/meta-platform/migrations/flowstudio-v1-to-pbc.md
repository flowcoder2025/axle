# FlowStudio v1 → @axle/pbc-image-engine 마이그레이션 플레이북

> **WI-407**, Phase 19. 본 문서는 FlowStudio v1 레포에서 PBC를 채택하기 위한 단계별 절차를 정의합니다. v1 소스가 별도 레포에 있어 cross-repo 작업이 필요하므로, AXLE 측의 deliverable은 (1) v1-호환 facade, (2) 본 플레이북, (3) 자동 회귀 테스트입니다.

## 0. 사전 준비

- [ ] v1 레포에서 `lib/imageProvider/` 디렉토리의 모든 callsite를 파악 (`grep -rn "from .*lib/imageProvider"`).
- [ ] v1이 사용하는 환경변수 확인: `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `IMAGE_PROVIDER` (default `google`).
- [ ] v1 `package.json`에 `@axle/pbc-image-engine` 의존성 추가 — workspace 미포함 시 npm/yarn link 또는 publish 필요.

## 1. 1-line import 교체

PBC는 v1의 public 함수 시그니처를 보존하는 facade를 제공합니다.

```diff
- import { generateImage } from "@/lib/imageProvider";
+ import { generateImage } from "@axle/pbc-image-engine/compat/flowstudio-v1";
```

이외의 callsite는 변경 불필요. 동일한 옵션 객체(`{ prompt, env?, model?, sourceImage?, refImages?, negativePrompt?, aspectRatio?, count?, metadata?, signal? }`)와 결과 객체(`{ images, provider, model, durationMs, metadata? }`)가 보존됩니다.

## 2. 환경변수 매핑

| v1 변수 | PBC 변수 | 비고 |
|---|---|---|
| `GEMINI_API_KEY` | `GEMINI_API_KEY` (또는 `GOOGLE_GENAI_API_KEY`) | 변경 없음 |
| `OPENROUTER_API_KEY` | `OPENROUTER_API_KEY` | 변경 없음 |
| `IMAGE_PROVIDER` (`google` \| `openrouter`) | 동일 | 변경 없음. PBC compat가 동일 시맨틱 보존 |

기존 `.env`/Vercel env 그대로 사용 가능. 추가 액션 불필요.

## 3. 에러 처리 변경 (BREAKING — 1곳)

v1은 vendor 에러를 그대로 throw 했으나 PBC는 `ImageGenerationError`(code + retryable)로 정규화합니다.

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
import { generateImage, ImageGenerationError } from "@axle/pbc-image-engine/compat/flowstudio-v1";
```

| v1 에러 식별 | PBC code |
|---|---|
| `err.status === 400` | `INVALID_INPUT` |
| `err.status === 401 / 403` | `PROVIDER_UNAVAILABLE` |
| `err.status === 429` | `QUOTA_EXCEEDED` (`retryable: true`) |
| `err.status >= 500` | `PROVIDER_UNAVAILABLE` (`retryable: true`) |
| 네트워크 예외 | `PROVIDER_UNAVAILABLE` (`retryable: true`) |
| Safety filter 차단 | `CONTENT_FILTERED` |

## 4. 동작 보존 검증 (자동)

Compat 모듈에는 단위 테스트가 포함됩니다 — `packages/pbc-image-engine/__tests__/compat/flowstudio-v1.test.ts`. 회귀 발생 시 PBC CI가 차단합니다.

수동 검증 체크리스트 (마이그레이션 후 v1 레포에서 실행):

- [ ] `IMAGE_PROVIDER=google` + 텍스트만 → 정상 이미지 생성
- [ ] `IMAGE_PROVIDER=openrouter` + 텍스트만 → 정상 이미지 생성
- [ ] `sourceImage` 첨부 → EDIT 모드로 동작 (PBC가 mode를 자동 선택)
- [ ] `model: "openai/dall-e-3"` 같은 explicit override 동작
- [ ] 429 응답 → `ImageGenerationError(code="QUOTA_EXCEEDED", retryable=true)`

## 5. 점진 롤아웃 (권장)

1. **Day 1**: PR 1개 — feature flag(`USE_PBC_IMAGE_ENGINE`)로 토글, v1 레포의 `lib/imageProvider/index.ts`에서 두 import를 모두 export.
2. **Day 2-3**: staging에서 100% PBC로 트래픽, 에러율·지연시간 모니터링.
3. **Day 4**: production 10% → 50% → 100% canary.
4. **Day 5+**: feature flag 제거, v1의 `lib/imageProvider/` 디렉토리 삭제.

## 6. 검증 후 정리 (cleanup PR)

마이그레이션 안정화 후 v1 레포에서 다음을 삭제:

- `lib/imageProvider/google.ts`, `lib/imageProvider/openrouter.ts` (어댑터 중복)
- `lib/imageProvider/types.ts` (PBC 타입으로 대체됨)
- 관련 vendor SDK 의존성 (`@google/genai` 등) — PBC가 dep-free fetch 기반이라 v1 레포의 SDK 의존성은 모두 제거 가능

## 7. WI-408 (FlowStudio_re) 와의 관계

FlowStudio_re는 v1 fork 추정. WI-408은 본 플레이북을 그대로 적용합니다. 차이점이 발견되면 본 문서의 §3-§4를 분기로 보강하세요.

## 변경 이력

| 일자 | 항목 | 비고 |
|---|---|---|
| 2026-05-05 | 초안 작성 (WI-407) | compat facade + 플레이북 동시 도입 |
