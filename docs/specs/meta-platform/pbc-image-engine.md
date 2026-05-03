# Sprint Contract: pbc-image-engine

> **위치**: `packages/pbc-image-engine/`
> **부모 PRD**: [`./PRD.md`](./PRD.md)
> **활성화 게이트**: ✅ Phase 17/18 핵심부 완료 (2026-05-04 통과, 외부 의존 14건은 별도 트랙)
> **fix_plan 등록**: WI-401 ~ WI-410 (10건, Phase 19)
> **기간 추정**: 4주
> **선행 PBC**: 없음 (첫 추출 대상)

---

## 1. Goal

AX Studio + AX Studio Cloud + AX Studio YH + FlowStudio v1 + FlowStudio_re + FlowStudio v2 + FlowRetouch — **7개 프로젝트의 이미지 생성 호출을 단일 PBC로 통합**한다.

---

## 2. 현황 (Why this is the highest leverage)

| 프로젝트 | 현재 호출 방식 | 모델 |
|---|---|---|
| FlowStudio v1 | `lib/imageProvider/` (env: google\|openrouter) | gemini-3-pro-image-preview |
| FlowStudio v2 | `lib/imageProvider/` (provider abstraction 완성형) | googleGenAI / openRouter / vertexai |
| FlowStudio_re | (v1과 유사 추정 — 검증 필요) | — |
| FlowRetouch | `src/lib/gemini.ts` 직접 SDK | gemini-3-pro-image-preview |
| AX Studio | ComfyUI workflows (`comfyui-workflows/`) | Z-Image, FLUX.2 Klein |
| AX Studio Cloud | ViewComfy nodes | (동일 ComfyUI 모델) |
| AX Studio YH | (분기/실험 버전) | — |

**두 패러다임**: ① Direct API (Gemini/OpenRouter/Vertex) ② ComfyUI workflow.
FlowStudio v2의 `imageProvider/`가 ① 측 baseline. ComfyUI 어댑터는 신규.

---

## 3. 인터페이스 명세

### 3.1 타입

```typescript
// packages/pbc-image-engine/src/types.ts

export type ImageProvider =
  | 'google-genai'
  | 'vertex-ai'
  | 'openrouter'
  | 'comfyui-local'      // AX Studio 데스크톱
  | 'comfyui-cloud';     // AX Studio Cloud (ViewComfy)

export type GenerationMode =
  | 'CREATE'         // 텍스트만으로 신규 생성
  | 'EDIT'           // 기존 이미지 수정
  | 'COMPOSITE'      // 여러 이미지 합성
  | 'POSTER'         // 로고/텍스트 오버레이
  | 'DETAIL_EDIT'    // 마스크 영역 디테일 수정
  | 'DETAIL_PAGE'    // 상세페이지용 컴포지션
  | 'RETOUCH';       // 인물 사진 보정 (FlowRetouch)

export type ReferenceMode = 'style' | 'product' | 'composition' | 'full';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '2:3' | '3:2';

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  mode: GenerationMode;
  provider?: ImageProvider;       // 미지정 시 selectProvider() 자동
  model?: string;                 // 프로바이더별 모델명
  aspectRatio?: AspectRatio;
  count?: number;                 // 1-8
  refImages?: string[];           // base64 또는 URL
  referenceMode?: ReferenceMode;
  sourceImage?: string;           // EDIT/RETOUCH/DETAIL_EDIT용
  maskImage?: string;             // DETAIL_EDIT용
  logoImage?: string;             // POSTER용
  style?: string;                 // 스타일 프리셋 키 ('retouch-pro', 'wedding', ...)
  metadata?: Record<string, unknown>;
}

export interface GenerationResult {
  images: Array<{
    base64: string;
    mimeType: string;
    width?: number;
    height?: number;
  }>;
  provider: ImageProvider;
  model: string;
  cost?: { credits: number; usd: number };
  duration: number;               // ms
  metadata?: Record<string, unknown>;
}

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'QUOTA_EXCEEDED'
  | 'CONTENT_FILTERED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class ImageGenerationError extends Error {
  code: ErrorCode;
  retryable: boolean;
}
```

### 3.2 Public API

```typescript
// packages/pbc-image-engine/src/index.ts

export async function generate(req: GenerationRequest): Promise<GenerationResult>;
export function selectProvider(req: GenerationRequest): ImageProvider;
export function getEstimatedCost(req: GenerationRequest): { credits: number; usd: number };
export const PRESETS: Record<string, Partial<GenerationRequest>>;

/**
 * 다른 PBC가 의존성 주입을 위해 사용할 수 있는 interface 타입.
 * 예: pbc-block-builder의 RenderContext.imageEngine
 */
export interface ImageEngine {
  generate: typeof generate;
  selectProvider: typeof selectProvider;
  getEstimatedCost: typeof getEstimatedCost;
}
```

---

## 4. 패키지 구조

```
packages/pbc-image-engine/
├── src/
│   ├── types.ts
│   ├── index.ts                  (public API)
│   ├── generate.ts               (orchestrator)
│   ├── selectProvider.ts         (provider 자동 선택)
│   ├── promptBuilder.ts          (prompt 정규화)
│   ├── providers/
│   │   ├── googleGenAI.ts        (FlowStudio v2에서 이전)
│   │   ├── vertexai.ts           (FlowStudio v2에서 이전)
│   │   ├── openRouter.ts         (FlowStudio v2에서 이전)
│   │   ├── comfyuiLocal.ts       (신규 — AX Studio 어댑터)
│   │   └── comfyuiCloud.ts       (신규 — ViewComfy 어댑터)
│   └── presets/
│       ├── retouch-pro.ts        (FlowRetouch PRO_MODE_SYSTEM_PROMPT 보존)
│       ├── retouch-free.ts
│       └── ecommerce.ts          (FlowStudio 스타일)
├── __tests__/
│   ├── generate.test.ts
│   ├── selectProvider.test.ts
│   └── providers/
│       └── *.test.ts             (각 provider 모킹 테스트)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 5. Acceptance Criteria

- [ ] FlowStudio v2의 `lib/imageProvider/`를 PBC로 이전, 기존 v2 앱이 `import { generate } from '@axle/pbc-image-engine'`로 동작
- [ ] FlowStudio v1 / FlowStudio_re / FlowRetouch가 동일 PBC API로 마이그레이션 (각각 1 PR)
- [ ] ComfyUI provider 어댑터가 AX Studio 워크플로우 1개 이상에서 정상 작동 (Z-Image 또는 FLUX.2)
- [ ] 단위 테스트: 각 provider 모킹, 모드별 인터페이스 검증, 커버리지 ≥ 80%
- [ ] 통합 테스트: 실제 Google GenAI 호출 1회 + ComfyUI 호출 1회 (cost ≤ $0.5)
- [ ] FlowRetouch의 `PRO_MODE_SYSTEM_PROMPT`가 `presets/retouch-pro.ts`로 보존
- [ ] FlowRetouch의 `RETOUCH` 모드가 PBC API로 동작 (input: image+prompt+pro/free)
- [ ] 문서: `packages/pbc-image-engine/README.md` (사용 예제 5개 — CREATE/EDIT/POSTER/DETAIL_EDIT/RETOUCH)
- [ ] CHANGELOG.md 작성

---

## 6. Out of Scope (PBC에 넣지 않음)

- ❌ Credit deduction / 결제 (각 앱 책임)
- ❌ Concurrency limit / queue (`packages/ai/` 또는 앱별)
- ❌ Watermark (앱별 정책)
- ❌ Storage 업로드 (`packages/storage/`)
- ❌ Subscription tier 체크 (앱별)
- ❌ 사용자 인증 (앱별, `packages/auth/`)
- ❌ 비용 청구 (앱이 `getEstimatedCost()` 호출 후 처리)

→ **PBC = 순수 이미지 변환 동작.** 그 외는 횡단 패키지가 처리.

---

## 7. Verification

```bash
cd /Volumes/포터블/AXLE
npm run test --workspace=@axle/pbc-image-engine
npm run lint --workspace=@axle/pbc-image-engine
npm run typecheck --workspace=@axle/pbc-image-engine

# 통합 테스트 (수동, secrets 필요)
npm run test:integration --workspace=@axle/pbc-image-engine

# 회귀 검증 — 기존 앱이 PBC로 마이그레이션 후 동일 결과 생성
npm run test:e2e -- --filter=apps/flowstudio
```

---

## 8. WI 분해 (Phase 19 활성화 시 fix_plan.md에 추가될 항목)

| WI 번호(예시) | 작업 | 추정 |
|---|---|---|
| WI-401-feat | pbc-image-engine 패키지 스켈레톤 + types.ts | 0.5d |
| WI-402-feat | FlowStudio v2 imageProvider/ 이전 | 1d |
| WI-403-feat | provider 자동 선택 로직 + 단위 테스트 | 0.5d |
| WI-404-feat | ComfyUI Local 어댑터 + AX Studio 1개 워크플로우 검증 | 2d |
| WI-405-feat | ComfyUI Cloud 어댑터 (ViewComfy) | 1d |
| WI-406-feat | FlowRetouch RETOUCH 모드 + retouch-pro/free 프리셋 | 1d |
| WI-407-refactor | FlowStudio v1을 PBC로 마이그레이션 | 1d |
| WI-408-refactor | FlowStudio_re 마이그레이션 | 1d |
| WI-409-test | 통합 테스트 + E2E fixture | 1d |
| WI-410-docs | README + CHANGELOG | 0.5d |

총 ~10일 (4주 일정 안에서 PR 머지 대기 시간 포함)

---

## 9. 리스크

| 리스크 | 확률 | 영향 | 대응 |
|---|---|---|---|
| ComfyUI 워크플로우 JSON 동적 주입이 까다로움 | 高 | 高 | WI-404를 먼저 해서 어댑터 패턴 검증 |
| 각 앱의 credit/concurrency와 섞여 있어 분리 시 회귀 | 中 | 中 | 통합 테스트 우선, 마이그레이션은 1앱씩 |
| FlowStudio_re가 v1 fork인지 별도 코드인지 불확실 | 中 | 低 | 활성화 시점에 코드 비교 |
| FlowRetouch PRO 프롬프트가 모델 버전 변경에 종속 | 低 | 中 | 프리셋 버전 관리 (`retouch-pro-v1.ts`) |

---

## 10. 결정 로그

| 일자 | 결정 | 근거 |
|---|---|---|
| 2026-05-03 | FlowStudio v2를 baseline으로 채택 | imageProvider/ 추상화가 가장 완성형 |
| 2026-05-03 | ComfyUI 어댑터를 PBC 안에 포함 | 별도 패키지 분리 시 추상화 누수 |
| 2026-05-03 | Credit/concurrency를 PBC 외부로 분리 | PBC = 순수 동작 원칙 |
| 2026-05-03 | RETOUCH를 GenerationMode 일종으로 처리 | FlowRetouch의 별도 API 합치기 위함 |
