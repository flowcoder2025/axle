# Sprint Contract: pbc-block-builder

> **위치**: `packages/pbc-block-builder/`
> **부모 PRD**: [`./PRD.md`](./PRD.md)
> **활성화 게이트**: AXLE Phase 17/18 완료
> **기간 추정**: 4주
> **선행 PBC**: 없음 (image-engine과 1주 겹침 가능)

---

## 1. Goal

FlowStudio v2의 21블록 시스템(6 카테고리, A1~F3)을 일반화하여 **랜딩페이지·상세페이지·SNS 카드·문서 등 어디서든 재사용**할 수 있는 PBC로 추출한다.

---

## 2. 현황

- **기존 명세**: `FlowStudio_v2/docs/specs/detail-page-builder/block-system-design.md`
- **기존 구현**:
  - `lib/detail-page/blocks/` — 블록 정의
  - `lib/detail-page/block-renderer.ts` — 렌더러
  - `app/api/templates/blocks/` — API
- **AI 파이프라인**: `docs/specs/detail-page-builder/ai-pipeline-design.md` (인테이크→분석→생성→조립→출력 5단계, 2단계 카피 생성: 앵커→블록 병렬)

---

## 3. 인터페이스 명세

### 3.1 타입

```typescript
// packages/pbc-block-builder/src/types.ts

export type BlockCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
// A=Hero, B=Feature, C=Social, D=Story, E=Spec, F=CTA
// (실제 카테고리명은 FlowStudio v2 명세 확인 후 확정)

export type BlockId = `${BlockCategory}${number}`;  // A1, A2, ..., F3

export type RenderOutput = 'html' | 'markdown' | 'react' | 'docx-element';

export interface BlockDefinition<TData = unknown> {
  id: BlockId;
  category: BlockCategory;
  name: string;
  description: string;
  schema: import('zod').ZodSchema<TData>;
  variants?: string[];           // 'minimal' | 'rich' | 'compact' 등
  render: (data: TData, context: RenderContext) => RenderResult;
}

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
  // DESIGN.md 포맷 호환
}

export interface RenderContext {
  output: RenderOutput;
  theme?: DesignTokens;          // core-design-md에서 주입
  locale?: 'ko' | 'en';
  imageEngine?: import('@axle/pbc-image-engine').ImageEngine;  // 선택적 의존
}

export interface RenderResult {
  content: string | React.ReactNode | DocxElement;
  assets?: Array<{ type: 'image' | 'font' | 'video'; src: string }>;
}

export interface PageComposition {
  blocks: Array<{ id: BlockId; data: unknown; variant?: string }>;
  theme?: string;                // DESIGN.md theme name
  metadata?: Record<string, unknown>;
}

// AI 카피 생성 파이프라인
export interface CopyGenerationRequest {
  intent: string;                // 사용자 의도 자연어
  industry?: string;
  targetBlocks: BlockId[];
  brandTone?: string;
  language?: 'ko' | 'en';
}

export interface CopyGenerationResult {
  blocks: Array<{ id: BlockId; data: unknown }>;
  rationale: string;             // AI가 왜 이 카피를 선택했는지
  generationTime: number;
}
```

### 3.2 Public API

```typescript
// packages/pbc-block-builder/src/index.ts

export const BLOCKS: Record<BlockId, BlockDefinition>;

export function renderComposition(
  composition: PageComposition,
  context: RenderContext,
): Promise<RenderResult[]>;

export function renderBlock(
  blockId: BlockId,
  data: unknown,
  context: RenderContext,
): RenderResult;

export function generateCopy(
  request: CopyGenerationRequest,
): Promise<CopyGenerationResult>;

export function validateBlockData(blockId: BlockId, data: unknown): { ok: boolean; errors?: string[] };

export const PRESETS: {
  'landing-saas': PageComposition;
  'detail-ecommerce': PageComposition;
  'sns-card': PageComposition;
  'business-doc': PageComposition;
};
```

---

## 4. 패키지 구조

```
packages/pbc-block-builder/
├── src/
│   ├── types.ts
│   ├── index.ts
│   ├── blocks/
│   │   ├── A1-hero-fullscreen.ts
│   │   ├── A2-hero-split.ts
│   │   ├── B1-feature-grid.ts
│   │   ├── ...                    (총 21블록)
│   ├── renderers/
│   │   ├── html.ts
│   │   ├── markdown.ts
│   │   ├── react.ts
│   │   └── docx-element.ts
│   ├── ai/
│   │   ├── generateCopy.ts        (5단계 파이프라인)
│   │   ├── intentAnalyzer.ts
│   │   └── blockComposer.ts
│   └── presets/
│       └── (랜딩/상세/SNS/문서)
├── __tests__/
└── package.json
```

---

## 5. Acceptance Criteria

- [ ] 21블록 정의가 `packages/pbc-block-builder/src/blocks/`로 이전 완료
- [ ] 4개 출력 포맷 어댑터 작동: HTML, Markdown, React component, DOCX element
- [ ] FlowStudio v2의 상세페이지 빌더가 PBC API로 마이그레이션
- [ ] 데모 앱(`apps/landing-demo/` 또는 `apps/axle/(marketing)`)에서 동일 PBC로 랜딩페이지 1개 생성 검증
- [ ] AI 카피 생성 파이프라인(`generateCopy`)이 `pbc-image-engine`과 독립적으로 작동 (의존성은 선택적)
- [ ] DESIGN.md theme 주입 hook 동작 (`RenderContext.theme`)
- [ ] 단위 테스트 ≥ 80% 커버리지
- [ ] 4가지 PRESETS 작동
- [ ] 문서: 21블록 카탈로그 README + 4 출력 포맷 비교 예제

---

## 6. Out of Scope

- ❌ 이미지 생성 (`pbc-image-engine` 호출만 — PBC 간 의존 OK)
- ❌ 앱별 라우팅 / 인증 / 결제
- ❌ Drag-and-drop 에디터 UI (앱 책임)
- ❌ 실제 DESIGN.md 100% 통합 (`core-design-md` 별도 PBC)
- ❌ DOCX element 어댑터의 모든 블록 지원 (1차는 텍스트/이미지/리스트만)

---

## 7. Verification

```bash
cd /Volumes/포터블/AXLE
npm run test --workspace=@axle/pbc-block-builder
npm run typecheck --workspace=@axle/pbc-block-builder

# 데모: 4가지 출력으로 같은 composition 렌더 비교
npm run demo:render-formats --workspace=@axle/pbc-block-builder

# 마이그레이션 회귀
npm run test:e2e -- --filter=apps/flowstudio
```

---

## 8. WI 분해 (예시)

| WI 번호 | 작업 | 추정 |
|---|---|---|
| WI-501-feat | pbc-block-builder 스켈레톤 + types.ts | 0.5d |
| WI-502-refactor | 21블록 정의 이전 | 2d |
| WI-503-feat | HTML 렌더러 | 1d |
| WI-504-feat | React 렌더러 | 1d |
| WI-505-feat | Markdown 렌더러 | 0.5d |
| WI-506-feat | DOCX element 렌더러 (텍스트/이미지/리스트) | 1.5d |
| WI-507-feat | AI 카피 파이프라인 (intent → blocks) | 2d |
| WI-508-feat | 4 PRESETS | 1d |
| WI-509-refactor | FlowStudio v2 빌더 마이그레이션 | 2d |
| WI-510-test | 통합 테스트 + 데모 | 1d |
| WI-511-docs | 카탈로그 README | 0.5d |

총 ~13일 (4주 일정 안)

---

## 9. 리스크

| 리스크 | 확률 | 영향 | 대응 |
|---|---|---|---|
| 21블록이 이커머스 상세페이지에 너무 특화 | 高 | 中 | 카테고리별 abstract 인터페이스 정의, variant로 분기 |
| DOCX element 어댑터 복잡 | 中 | 低 | 1차는 핵심 블록만 지원, 나머지는 marker |
| AI 카피 파이프라인이 OpenAI 의존 | 中 | 低 | `packages/ai/`를 통해서만 호출 (provider abstraction) |
| 4 출력 포맷 간 일관성 검증 어려움 | 中 | 中 | snapshot 테스트로 회귀 방지 |

---

## 10. 결정 로그

| 일자 | 결정 | 근거 |
|---|---|---|
| 2026-05-03 | 4 출력 포맷 동시 지원 | 단일 PBC로 모든 콘텐츠 채널 커버 |
| 2026-05-03 | DESIGN.md hook을 RenderContext로 전달 | core-design-md PBC와 분리 유지 |
| 2026-05-03 | image-engine 의존을 선택적(optional)으로 | block-builder가 image 없이도 작동 가능 |
| 2026-05-03 | 21블록 그대로 채택 | FlowStudio v2 명세 변경 비용 회피 |
