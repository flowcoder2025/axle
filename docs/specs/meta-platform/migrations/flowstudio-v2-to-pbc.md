# FlowStudio v2 → @axle/pbc-block-builder 마이그레이션 플레이북

> **WI-509**, Phase 19. 본 문서는 FlowStudio v2 레포(`FlowStudio_v2/`)에서
> `@axle/pbc-block-builder`를 채택하기 위한 단계별 절차를 정의합니다. v2 소스가
> 별도 레포에 있어 cross-repo 작업이 필요하므로, AXLE 측의 deliverable은
> (1) v2-호환 facade, (2) 본 플레이북, (3) 자동 회귀 테스트입니다 (WI-407 / WI-408
> 패턴과 동일).

---

## 0. 사전 준비

- [ ] v2 레포에서 `lib/detail-page/` 디렉토리의 모든 callsite를 파악:
  ```bash
  grep -rn "from .*lib/detail-page" .
  ```
- [ ] `app/api/templates/blocks/` 라우트에서 `block-renderer`를 사용하는 핸들러 위치 확인.
- [ ] v2 `package.json`에 `@axle/pbc-block-builder` 의존성 추가 — workspace 미포함 시
  npm/yarn link 또는 publish 필요.
- [ ] 23 블록 ID 매핑 확인: A1..F3는 PBC와 동일. 카테고리명(영/한 표기)은
  `pbc-block-builder-visuals.md` §1과 일치.

---

## 1. 1-line import 교체

PBC는 v2의 public 함수 시그니처를 보존하는 facade를 제공합니다.

### 1.1 블록 정의 / 레지스트리

```diff
- import { BLOCKS, getBlock, listBlockIds } from "@/lib/detail-page/blocks";
+ import { BLOCKS, getBlock, listBlockIds } from "@axle/pbc-block-builder/compat/flowstudio-v2";
```

### 1.2 렌더러

```diff
- import { renderBlock, renderComposition } from "@/lib/detail-page/block-renderer";
+ import { renderBlock, renderComposition } from "@axle/pbc-block-builder/compat/flowstudio-v2";
```

옵션 객체(`{ format, variant?, theme?, locale?, metadata? }`)와 결과
(`RenderResult`) 모양은 보존됩니다.

### 1.3 검증 / 유틸

```diff
- import { validateBlockData } from "@/lib/detail-page/validate";
+ import { validateBlockData } from "@axle/pbc-block-builder/compat/flowstudio-v2";
```

---

## 2. `format` 값 매핑

| v2 `format` | PBC `RenderOutput` | 비고 |
|---|---|---|
| `html` | `html` | 변경 없음 |
| `markdown` | `markdown` | 변경 없음 |
| `react` | `react` | 변경 없음 |
| `docx` | `docx-element` | **이름 변경** — facade가 자동 변환. 결과 `metadata.output`은 PBC 이름(`docx-element`)을 반환합니다. |

`format: "docx"` 호출은 v2 callsite를 그대로 두고도 동작하지만, 결과 객체에서
`output` 필드를 검사하는 코드가 있다면 새 이름을 처리해야 합니다.

```diff
  const result = renderBlock(id, data, { format: "docx" });
- if (result.metadata?.output === "docx") { ... }
+ if (result.metadata?.output === "docx-element") { ... }
```

---

## 3. 새로운 동작 — XSS escape (BREAKING — HTML/React 모드)

v2의 HTML/React 렌더러는 사용자 입력을 그대로 출력해 XSS 위험이 있었습니다.
PBC는 모든 사용자 텍스트를 자동 escape합니다.

이미 escape된 HTML 문자열을 v2에 주입하던 코드(드물지만 존재)는 출력이
`&lt;...&gt;`로 표시되므로 평문으로 변경해야 합니다.

```diff
- renderBlock("A1", { headline: "&amp;abc" }, { format: "html" });  // expected literal "&abc"
+ renderBlock("A1", { headline: "&abc" }, { format: "html" });
```

PBC에는 `dangerouslySetInnerHTML`이나 raw HTML pass-through가 없습니다 — 이는
설계상 선택입니다.

---

## 4. 스키마 검증 — 더 엄격해짐

v2의 `validateBlockData`는 일부 블록에서 빈 페이로드를 통과시켰지만, PBC는
zod 스키마를 통해 모든 블록의 입력을 강하게 검증합니다.

마이그레이션 후 다음과 같은 호출이 실패할 수 있습니다:

| 블록 | v2에서 통과했지만 PBC에서 실패 | 해결 |
|---|---|---|
| A1 | `{}` (headline 누락) | `{ headline: "..." }` |
| B1 | `{ items: [] }` 또는 1개 | items ≥ 2 (스키마는 2..6) |
| C2 | 0개 리뷰 | reviews ≥ 1 |
| D4 | headers/rows 없음 | 둘 다 ≥ 1 |
| E1 | price/ctaText/ctaHref 일부 누락 | 셋 다 필수 |

기존 데이터가 부분 누락이면 마이그레이션 전에 백필 또는 `validateBlockData`
결과 사용 패턴을 도입하세요.

---

## 5. C2 reviews — AI 생성 거부

v2는 `generateCopy`로 C2 review 데이터까지 생성할 수 있었습니다 (한국 공정거래법
위반 위험). PBC의 `generateCopy`는 C2를 자동 skip하고 rationale에 거부 사유를
기록합니다.

```ts
const result = await generateCopy({
  intent: "...",
  targetBlocks: ["A1", "C2", "B1"],
});
// result.blocks → [{ id: "A1", ... }, { id: "B1", ... }]
// result.rationale → "skipped C2: real customer reviews only — refused to fabricate"
```

C2를 채우려면 실제 `reviews_raw` 테이블 데이터를 직접 주입해야 합니다.

---

## 6. AI 카피 파이프라인 — Provider 추상화

v2는 OpenAI 호출을 `lib/detail-page/ai/`에 직접 임베드했습니다. PBC는
`CopyProvider` 인터페이스를 통해 LLM을 외부 주입합니다:

```diff
- import { generateCopy } from "@/lib/detail-page/ai/generateCopy";
- const result = await generateCopy(request);  // OpenAI 직접 호출
+ import { generateCopy } from "@axle/pbc-block-builder";
+ import { createOpenAICopyProvider } from "@axle/ai/copy-provider";
+ const result = await generateCopy(request, {
+   provider: createOpenAICopyProvider({ apiKey: process.env.OPENAI_API_KEY }),
+ });
```

기본값(`createDeterministicCopyProvider()`)은 LLM을 호출하지 않고 intent에서
직접 zod-valid payload를 생성합니다. 테스트/오프라인 빌드에서 그대로 사용하세요.

---

## 7. PRESETS — 새 기능

PBC는 v2에 없던 4개 시작 템플릿을 제공합니다:

```ts
import { PRESETS } from "@axle/pbc-block-builder/compat/flowstudio-v2";
// 또는 원본 모듈에서:
// import { PRESETS } from "@axle/pbc-block-builder";

const composition = PRESETS["landing-saas"]; // PageComposition
```

사용 가능한 키: `landing-saas`, `detail-ecommerce`, `sns-card`, `business-doc`.

---

## 8. 회귀 테스트 체크리스트

마이그레이션 PR에 포함:

- [ ] 모든 callsite가 `@axle/pbc-block-builder/compat/flowstudio-v2`로 import 변경
- [ ] `npm run typecheck` 통과 (PBC가 stricter한 zod 타입을 export)
- [ ] 기존 e2e 시나리오 — 23 블록 각각이 v2와 동일한 시각적 출력 (HTML diff snapshot)
- [ ] `format: "docx"` 호출이 `metadata.output === "docx-element"`을 처리
- [ ] AI 파이프라인 호출에 `provider` 주입 (기본값 OK이면 생략 가능)
- [ ] C2 블록에 의존하던 코드가 거부 케이스를 처리

---

## 9. 롤백 전략

`compat/flowstudio-v2`는 facade일 뿐이므로, 이슈 발생 시 import 경로만 되돌리면
원본 v2 코드로 즉시 복귀 가능합니다. 데이터 마이그레이션이나 DB 스키마 변경은
없습니다.

```diff
- import { renderBlock } from "@axle/pbc-block-builder/compat/flowstudio-v2";
+ import { renderBlock } from "@/lib/detail-page/block-renderer";
```

PBC 채택의 진짜 가치는 `compat/`을 거치지 않고 `@axle/pbc-block-builder` 메인
export를 직접 사용하는 단계(2단계 마이그레이션)에서 나옵니다 — 이 경우
`format` → `output` 이름 변경, `RenderContext` 객체 사용, 새 PRESETS / AI
provider 활용이 가능합니다. 단, 본 플레이북은 1단계(facade 채택)만 다룹니다.
