# PBC Block Builder — 23블록 시각 가이드

> 위치: `~/AX/기획/research/modular-platform/pbc-block-builder-visuals.md`
> 정합 산출물 (AXLE 안): `/Volumes/포터블/AXLE/docs/specs/meta-platform/pbc-block-builder.md`
> 참조: [`themes/flowcoder-default.design.md`](./themes/flowcoder-default.design.md), [`app-shell-ux.md`](./app-shell-ux.md)
> 출처: FlowStudio v2 `docs/specs/detail-page-builder/block-system-design.md`
> 작성일: 2026-05-04
> 핵심: **23블록 × 4 출력 포맷 (HTML / Markdown / React / DOCX) × N theme** — 콘텐츠는 한 번 정의, 어디서든 렌더.

---

## 0. 원칙

### 0.1 한 줄 정의
> **블록은 콘텐츠의 원자 단위. 같은 블록은 4가지 출력 포맷에서 같은 메시지를 전달한다.**

### 0.2 5가지 비협상 룰

1. **블록 독립성**: 각 블록은 단독 렌더 가능. 이전/다음 블록에 의존 금지.
2. **순서 자유**: 블록 배치 순서 자유롭게 변경 가능.
3. **DESIGN.md 토큰만 사용**: 색/타이포/spacing은 모두 active theme의 토큰. 새 토큰 발명 금지.
4. **데이터-스타일 분리**: `data` (콘텐츠) ↔ `style?` (override) 명확 분리. AI 카피는 data만 생성.
5. **AI 후기 금지**: C2 후기 블록의 데이터는 항상 `reviews_raw` (실제 고객) 필수. 가짜 후기는 공정거래법 위반.

---

## 1. 23블록 카탈로그 (정합본)

### Category A: 도입부 (Opening)

| ID | 이름 | 역할 | Variants | 우선순위 |
|---|---|---|---|---|
| **A1** | 히어로 비주얼 | 첫 화면, 제품 메인 이미지 + 한줄 카피 | `full-bleed`, `split-half`, `overlay-text` | 필수 |
| **A2** | 원라인 후킹 | 강렬한 한 줄 카피 (배경색/그라디언트) | `bold-center`, `handwriting`, `highlight-box` | 권장 |
| **A3** | 문제 제기 | 고객 페인포인트 공감 | `question-list`, `before-scene`, `chat-bubble` | 옵션 |

### Category B: 핵심 소구 (Core Value)

| ID | 이름 | 역할 | Variants | 우선순위 |
|---|---|---|---|---|
| **B1** | 특장점 카드 | 3-4개 핵심 장점 나열 | `icon-grid`, `number-list`, `photo-card` | 필수 |
| **B2** | 비포/애프터 | 사용 전후 비교 | `side-by-side`, `slider`, `timeline` | 권장 |
| **B3** | 핵심 성분/기술 | 원료/기술/소재 강조 | `ingredient-spotlight`, `tech-diagram`, `material-closeup` | 권장 |
| **B4** | USP 풀샷 | 한 장에 USP 집약 (이미지 중심) | `infographic`, `feature-callout`, `comparison-table` | 옵션 |

### Category C: 신뢰 구축 (Trust)

| ID | 이름 | 역할 | Variants | 우선순위 |
|---|---|---|---|---|
| **C1** | 인증/수상 | 인증서, 수상 내역, 특허 | `badge-row`, `certificate-gallery`, `award-timeline` | 권장 |
| **C2** | 리뷰/후기 | 고객 후기 발췌 (★실데이터 필수★) | `review-card`, `screenshot-stack`, `star-summary` | 필수 |
| **C3** | 미디어 노출 | 언론/방송/SNS 소개 | `press-logo-bar`, `article-card`, `sns-embed` | 옵션 |
| **C4** | 브랜드 스토리 | 브랜드 철학, 대표 소개 | `founder-letter`, `brand-timeline`, `mission-statement` | 옵션 |
| **C5** | 숫자로 보기 | 판매량, 만족도 등 수치 | `counter-row`, `stat-card`, `progress-bar` | 권장 |

### Category D: 상세 정보 (Detail)

| ID | 이름 | 역할 | Variants | 우선순위 |
|---|---|---|---|---|
| **D1** | 스펙 테이블 | 제품 사양, 영양정보 | `simple-table`, `compare-table`, `tab-table` | 필수 |
| **D2** | 사용법/활용 | 사용 방법 단계별 안내 | `step-list`, `photo-step`, `video-embed` | 권장 |
| **D3** | 구성품/세트 | 박스 내용물, 세트 구성 | `grid-layout`, `exploded-view`, `bundle-card` | 옵션 |
| **D4** | 사이즈 가이드 | 치수, 착용샷, 비교 | `size-chart`, `body-overlay`, `real-wear` | 옵션 |

### Category E: 전환 유도 (Conversion)

| ID | 이름 | 역할 | Variants | 우선순위 |
|---|---|---|---|---|
| **E1** | CTA 배너 | 구매/장바구니 유도 | `sticky-bottom`, `inline-banner`, `urgency-timer` | 필수 |
| **E2** | 프로모/할인 | 할인, 쿠폰, 기간한정 | `coupon-card`, `price-compare`, `bundle-deal` | 옵션 |
| **E3** | FAQ | 자주 묻는 질문 | `accordion`, `chat-style`, `category-tab` | 권장 |
| **E4** | 배송/교환 | 배송 안내, 교환/반품 | `info-box`, `icon-list`, `policy-table` | 권장 |

### Category F: 감성 연출 (Mood)

| ID | 이름 | 역할 | Variants | 우선순위 |
|---|---|---|---|---|
| **F1** | 라이프스타일 컷 | 사용 장면, 분위기 연출 | `full-photo`, `photo-grid`, `carousel` | 권장 |
| **F2** | 컬러/옵션 | 컬러 변형, 옵션 소개 | `swatch-grid`, `option-card`, `color-lifestyle` | 옵션 |
| **F3** | 구분선/여백 | 섹션 전환, 시각적 휴식 | `gradient-divider`, `pattern-break`, `whitespace` | 자동 |

→ 총 **23블록 × 평균 3 variants = 63 시각 패턴**. 각 패턴이 4 출력 포맷 지원.

---

## 2. 카테고리별 시각 정의 (Mood Boards)

### A — 도입부 (Opening)
**감성 키워드**: 임팩트 / 호기심 / 강렬 / 첫인상

```
A1 히어로 비주얼 (full-bleed)
  ┌─────────────────────────────┐
  │  [큰 제품 이미지 — 60% area]   │
  │                             │
  │   [Display Hero Title]      │
  │   [Tagline body large]      │
  │                             │
  │   [Primary CTA →]           │
  └─────────────────────────────┘
  • 배경: 제품 사진 또는 그라디언트
  • 텍스트: 흰색 또는 black-overlay
  • 높이: 100vh (모바일) / 80vh (데스크톱)
  • 페이지 첫 블록 권장
```

**스타일 결정**:
- 폰트: Display Hero (56-72px / 700)
- Letter-spacing: -0.04em
- Line-height: 1.0–1.1
- 배경 처리: 어두운 이미지에 텍스트 = white + 8% opacity overlay

### B — 핵심 소구 (Core Value)
**감성 키워드**: 명료 / 비교 / 가치 / 객관

```
B1 특장점 카드 (icon-grid)
  ┌───────┬───────┬───────┐
  │ [icon]│ [icon]│ [icon]│
  │       │       │       │
  │ 제목  │ 제목  │ 제목  │
  │ 설명  │ 설명  │ 설명  │
  └───────┴───────┴───────┘
  • 3-4 카드 (모바일: 2 col, 데스크톱: 4 col)
  • 아이콘: 48px, accent 또는 muted
  • 제목: Card Title (18px / 600)
  • 설명: Body (14px / muted)
```

**스타일 결정**:
- Card padding: 24px
- Gap: 16px
- 아이콘: 단일 line-icon family (lucide-react 기본)
- Hover: 미세 elevation (no transform — calm)

### C — 신뢰 구축 (Trust)
**감성 키워드**: 객관 / 권위 / 사회적 증명 / 무게감

```
C2 리뷰/후기 (review-card)
  ┌─────────────────────────────┐
  │ ★★★★★  5.0                │
  │                             │
  │ "정말 좋아요. 다시 살게요."    │
  │                             │
  │ — 김** (실 사용자, 35세, 여성) │
  │   2026.04.12                │
  └─────────────────────────────┘
  • 별점: chart-3 (warning) 또는 accent
  • 인용문: Body Large (16px / 400 / 1.6)
  • 작성자: Caption (12px / muted)
```

**스타일 결정**:
- 인용문 들여쓰기: 좌측 4px accent border 또는 큰 따옴표 그래픽
- 별점: SVG inline (★ 5개)
- ⚠️ 후기 데이터는 `reviews_raw` 필수, AI 생성 금지

### D — 상세 정보 (Detail)
**감성 키워드**: 정확 / 객관 / 데이터 / 검증 가능

```
D1 스펙 테이블 (simple-table)
  ┌─────────────┬───────────────────┐
  │ 용량        │ 250ml             │
  │ 재질        │ 유리 (재활용 가능)  │
  │ 원산지      │ 대한민국 (서울)    │
  │ 보관 방법   │ 직사광선 피해...   │
  └─────────────┴───────────────────┘
  • 좌측 라벨: Caption Strong (12px / 500 / uppercase)
  • 우측 값: Body (14px / 400)
  • Row 높이: 36px (compact)
  • 짝수행 배경: surface-muted (선택)
```

### E — 전환 유도 (Conversion)
**감성 키워드**: 행동 / 임박 / 명확 / 단순

```
E1 CTA 배너 (sticky-bottom)
  ┌─────────────────────────────┐
  │ ₩39,000  [지금 구매하기 →]   │
  │ (10% 할인, 자정 종료)         │
  └─────────────────────────────┘
  • 페이지 하단 sticky
  • 가격: KPI 폰트 (32px / 700 / tnum)
  • CTA: Primary button (big, height 48-56px)
  • 긴박감: Caption (붉은 색 + 카운트다운)
```

**스타일 결정**:
- Sticky bottom: z-index 40
- 모바일 우선 (가장 큰 전환 지점)
- 배경: surface-raised + shadow-elevation-2

### F — 감성 연출 (Mood)
**감성 키워드**: 분위기 / 라이프스타일 / 휴식 / 여백

```
F1 라이프스타일 컷 (full-photo)
  ┌─────────────────────────────┐
  │                             │
  │                             │
  │    [큰 라이프스타일 사진]     │
  │    (full-bleed, no text)    │
  │                             │
  │                             │
  └─────────────────────────────┘
  • 텍스트 0
  • 비율: 16:9 (데스크톱) / 1:1 또는 4:5 (모바일)
  • 페이지 중간 호흡 지점에 배치
```

```
F3 구분선 (gradient-divider)
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  
  • 카테고리 전환 시 자동 삽입
  • 높이: 32-48px
  • 패턴: 그라디언트 / 점선 / 순수 여백
```

---

## 3. 4가지 출력 포맷 매핑

각 블록은 4가지 출력 포맷으로 렌더 가능. 같은 데이터 → 다른 표현.

### 3.1 Output Matrix (예: B1 icon-grid)

| 출력 | 형태 | 사용처 |
|---|---|---|
| **HTML** | `<section>` + `<style>` + 인라인 SVG | 정적 페이지, 이메일, 상세페이지 |
| **Markdown** | 표 또는 리스트로 변환 | 블로그, 문서, GitHub README |
| **React** | `<FeatureGrid>` 컴포넌트 | 메타플랫폼 앱 (`apps/*`) |
| **DOCX element** | `Table` + `Paragraph` | 사업계획서, 제안서 (mark-docx 통합) |

### 3.2 출력별 변환 규칙

#### HTML
- 단일 self-contained `<section>` 블록 (style inline 또는 scoped)
- shadow-as-border + DESIGN.md 토큰 직접 사용
- 외부 의존: 없음 (이미지 URL 제외)
- 사용처: `pbc-image-engine`이 생성한 이미지 + 텍스트 = 상세페이지 전체 HTML

#### Markdown
- 시각 요소(이미지, 차트)는 alt-text + 링크로 변환
- 표/리스트는 GFM (GitHub Flavored Markdown)
- 스타일 정보 손실 (의도된 lossy conversion)
- 사용처: 블로그, 문서, 텍스트 export

#### React
- shadcn/ui 컴포넌트 호출 (`<Card>`, `<Badge>`, ...)
- props 타입 안전 (zod schema 검증)
- DESIGN.md theme은 `RenderContext`로 주입
- 사용처: 메타플랫폼 앱 안에서 라이브 렌더 (예: FlowStudio v2 빌더)

#### DOCX Element
- `mark-docx` skill의 element 형태로 출력
- 텍스트/표/이미지/리스트 변환 (1차 한정)
- 차트/SVG는 PNG로 미리 렌더 (이미지로 임베드)
- 사용처: 사업계획서 (AXLE 컨설팅), 제안서

### 3.3 출력 변환 예시 (B1 특장점 카드)

**입력 데이터** (공통):
```typescript
{
  id: "B1",
  variant: "icon-grid",
  data: {
    title: "왜 우리 제품인가",
    items: [
      { icon: "leaf", title: "100% 천연", desc: "유기농 인증" },
      { icon: "truck", title: "당일배송", desc: "오후 2시 주문 시" },
      { icon: "shield", title: "30일 환불", desc: "조건없는 교환" },
    ]
  }
}
```

**HTML 출력**:
```html
<section class="b1-icon-grid" style="padding: 64px 24px; max-width: 1200px; margin: 0 auto;">
  <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 32px;">왜 우리 제품인가</h2>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
    <div style="padding: 24px; ...">
      <svg>...</svg>
      <h3>100% 천연</h3>
      <p>유기농 인증</p>
    </div>
    ...
  </div>
</section>
```

**Markdown 출력**:
```markdown
## 왜 우리 제품인가

| 특징 | 설명 |
|---|---|
| 🌿 100% 천연 | 유기농 인증 |
| 🚚 당일배송 | 오후 2시 주문 시 |
| 🛡 30일 환불 | 조건없는 교환 |
```

**React 출력**:
```tsx
<FeatureGrid title="왜 우리 제품인가">
  {items.map(item => (
    <FeatureCard key={item.title} icon={item.icon} title={item.title}>
      {item.desc}
    </FeatureCard>
  ))}
</FeatureGrid>
```

**DOCX Element 출력**:
```typescript
[
  new Paragraph({ heading: HeadingLevel.HEADING_2, text: "왜 우리 제품인가" }),
  new Table({
    rows: items.map(item => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(item.title)] }),
        new TableCell({ children: [new Paragraph(item.desc)] }),
      ]
    }))
  })
]
```

---

## 4. Composition Presets (4종)

### 4.1 `landing-saas` (랜딩페이지 SaaS)
**용도**: 메타플랫폼 위 SaaS 마케팅 랜딩

```
A1 (full-bleed)        ← Hero
A2 (bold-center)       ← One-liner
B1 (icon-grid)         ← Features
C5 (counter-row)       ← Stats
C2 (review-card)       ← Testimonials
B2 (side-by-side)      ← Before/After
E1 (sticky-bottom)     ← CTA
F3 (whitespace)        ← Divider
E3 (accordion)         ← FAQ
```

총 9블록, 권장 범위 (10-14)에 가까움.

### 4.2 `detail-ecommerce` (이커머스 상세페이지)
**용도**: 스마트스토어/쿠팡/자사몰 제품 상세

```
A1 (full-bleed)        ← 제품 메인 이미지
A2 (highlight-box)     ← 후킹 카피
B1 (icon-grid)         ← 핵심 장점 4개
B3 (ingredient-spotlight) ← 핵심 성분
F1 (full-photo)        ← 라이프스타일 컷
B2 (side-by-side)      ← 비포/애프터
C5 (stat-card)         ← 만족도/판매량
C2 (review-card)       ← 후기 (실데이터)
C1 (badge-row)         ← 인증
D1 (simple-table)      ← 스펙
D2 (step-list)         ← 사용법
F2 (swatch-grid)       ← 옵션
E2 (price-compare)     ← 할인
E4 (icon-list)         ← 배송/교환
E3 (accordion)         ← FAQ
E1 (sticky-bottom)     ← CTA
```

총 16블록, 모바일 스크롤 4-5분 분량.

### 4.3 `sns-card` (SNS 카드형)
**용도**: 인스타그램, 페이스북 단일 이미지/영상

```
[outputSize: 1080x1080 또는 1080x1920]

A1 (full-bleed) → 전체 프레임 안에 압축
A2 (handwriting) → 하단 텍스트 오버레이
E1 (urgency-timer) → 작은 CTA
```

총 1-3블록만 사용. 단일 이미지 출력.

### 4.4 `business-doc` (비즈니스 문서, 사업계획서·제안서)
**용도**: AXLE 컨설팅에서 자동 생성하는 문서

```
A2 (bold-center)       ← 제목 페이지
C4 (mission-statement) ← 회사 소개
B1 (number-list)       ← 핵심 가치/제품
B4 (comparison-table)  ← 경쟁 분석
C5 (stat-card)         ← 시장 규모
D1 (compare-table)     ← 재무 추정
B2 (timeline)          ← 일정 (Gantt-like)
E4 (policy-table)      ← 부록 (인증/특허)
```

총 8블록. **출력 포맷: DOCX element 우선** (mark-docx로 자동 생성).

---

## 5. DESIGN.md Theme 통합

### 5.1 RenderContext 구조

```typescript
interface RenderContext {
  output: 'html' | 'markdown' | 'react' | 'docx-element';
  theme?: DesignTokens;          // active theme의 토큰
  locale?: 'ko' | 'en';
  imageEngine?: ImageEngine;     // pbc-image-engine 의존성 주입
}
```

### 5.2 토큰 사용 규칙

블록 렌더링 시 **모든 색/타이포/spacing은 theme 토큰으로** 해결:

```typescript
// ❌ 금지
const style = { color: '#3CA2F6', padding: '24px' };

// ✅ 권장 (theme 주입)
const style = {
  color: ctx.theme.colors.accent,
  padding: ctx.theme.spacing[5],
};

// React에서는 CSS variable 직접 사용
<div style={{ color: 'hsl(var(--primary))', padding: 'var(--space-5)' }} />
```

### 5.3 Theme 갈아끼움 시나리오

같은 composition 데이터 + 다른 theme = 다른 시각:

```
Composition: detail-ecommerce
  ↓
Theme: flowcoder-default     → 깊은 블루, Pretendard, 모던
Theme: cosmetics-warm        → 따뜻한 베이지, serif, 럭셔리
Theme: tech-utility          → 모노톤, monospace, 미니멀
```

→ 콘텐츠 변경 0, 시각 차별화 100%.

---

## 6. 블록 간 Spacing & Transition

### 6.1 블록 간 수직 spacing

| 카테고리 전환 | 기본 spacing | F3 자동 삽입 |
|---|---|---|
| A → B (Opening → Core) | 64px | 옵션 |
| B → C (Core → Trust) | 80px | **자동** |
| C → D (Trust → Detail) | 64px | 옵션 |
| D → E (Detail → Conversion) | 80px | **자동** |
| E → F (Conversion → Mood) | 48px | 옵션 |

### 6.2 블록 내부 padding

> ⚠️ **이 값은 블록 단위의 `padding` variant 선택지** (`Block.style.padding`)이며, `app-shell-ux.md`의 앱 단위 density (`comfortable` / `compact`)와는 **별개**다. 같은 단어를 쓰지 않도록 주의 — 블록은 `compact / normal / spacious`, 앱은 `comfortable / compact`.

| Padding variant | 블록 내부 vertical padding |
|---|---|
| compact | 32px |
| normal | 48px |
| spacious | 64-96px |

### 6.3 Transition (스크롤 인터랙션)

- **fade-up on scroll**: 블록이 viewport 진입 시 opacity 0→1, translateY(20px)→(0)
- **duration**: 400ms (한 번만, 재진입 시 재실행 안 함)
- **easing**: `cubic-bezier(0, 0, 0.2, 1)` (enter, decelerate)
- **모바일에서는 disable** (성능 + reduced-motion 존중)

---

## 7. AI 카피 생성 파이프라인

### 7.1 입력 → 출력

```
사용자 의도 (자연어)
  ↓
Step 1: Intent Analyzer
  - 의도 분류 (랜딩/상세/SNS/문서)
  - 산업 추출 (cosmetics/tech/B2B/...)
  - Tone 결정 (formal/casual/luxury/...)
  ↓
Step 2: Block Composer
  - composition preset 선택 (4종 중)
  - 또는 customize (블록 추가/제거/재배치)
  ↓
Step 3: Copy Generator (per block)
  - 각 블록의 data.title/items/etc 채움
  - 도메인 특화 prompt 사용
  ↓
Step 4: Composition Validator
  - 최소/최대 블록 수 체크
  - C2 후기 블록 = reviews_raw 있는지 확인
  ↓
Step 5: Renderer
  - 4 출력 포맷 중 사용자 요청 형식으로
```

### 7.2 Block-level 카피 생성 prompt 템플릿

```
당신은 이커머스 상세페이지 카피라이터입니다.

[블록 정보]
ID: B1 특장점 카드
Variant: icon-grid
필요 항목: 3-4개 특장점 (icon name + title + 1-line description)

[제품 정보]
이름: ${productName}        // PageComposition.productName (저장됨)
산업: ${industry}           // PageComposition.category (저장됨)
타겟: ${target}             // AI 입력 전용 (PageComposition에 저장 안 됨)
USP: ${uspText}             // AI 입력 전용
브랜드 톤: ${brandTone}     // AI 입력 전용 (또는 theme name으로 추정)

> AI 입력 전용 필드는 카피 생성 시점에만 사용. 저장하지 않으며, 동일 composition 재생성 시 다시 입력해야 함.

생성 규칙:
- 각 title은 8자 이내
- 각 description은 30자 이내
- icon은 lucide-react에 존재하는 이름 (leaf/shield/heart/...)
- 한국어 우선, 영어 표현은 카테고리 명만 OK

JSON 형식으로 응답:
{
  "title": "...",
  "items": [
    { "icon": "...", "title": "...", "desc": "..." }
  ]
}
```

### 7.3 AI 생성 금지 영역

- **C2 후기**: 항상 `reviews_raw` 실데이터. 가짜 후기 → 공정거래법 위반.
- **C1 인증**: 실제 인증 정보만 (data fixture 또는 API 검증).
- **D1 스펙**: 제품 실제 사양만 (carbon copy from product DB).

---

## 8. Variant 결정 휴리스틱

같은 블록도 variant에 따라 다른 시각:

### A1 히어로 비주얼
| Variant | 사용 컨텍스트 |
|---|---|
| `full-bleed` | 임팩트 우선, B2C 화장품/패션 |
| `split-half` | 정보 + 이미지 균형, B2B |
| `overlay-text` | 라이프스타일 강조, 럭셔리 |

### B1 특장점 카드
| Variant | 사용 컨텍스트 |
|---|---|
| `icon-grid` | 기능 위주, 명확한 가치 (SaaS/IT) |
| `number-list` | 단계별 강점 (절차 중요) |
| `photo-card` | 시각적 강점 (먹거리/패션) |

### C2 리뷰/후기
| Variant | 사용 컨텍스트 |
|---|---|
| `review-card` | 정제된 인용 (브랜드 통제) |
| `screenshot-stack` | 진정성 (SNS 캡쳐) |
| `star-summary` | 양적 강조 (다수 리뷰) |

→ Variant 선택은 AI가 산업/톤/제품 종류로 자동 추론. 사용자가 override 가능.

---

## 9. Anti-Patterns (NEVER)

### 데이터
- ❌ AI가 만든 가짜 후기 (C2)
- ❌ 검증 안 된 통계 (C5 — 출처 불명 숫자)
- ❌ 실제 보유하지 않은 인증 (C1)
- ❌ 다른 제품 사진 도용 (B3, F1)

### 시각
- ❌ 화면당 accent 3회 이상
- ❌ 한 페이지에 3개 이상 다른 폰트
- ❌ 블록 간 inline padding 직접 지정 (spacing scale 위반)
- ❌ 블록 내부 새로운 색 발명 (theme 토큰만 사용)

### 컴포지션
- ❌ A1 없이 시작 (Hero 누락)
- ❌ E1 없이 종료 (CTA 누락 — 전환 0)
- ❌ 같은 variant 3회 반복 (예: B1 icon-grid 세 번)
- ❌ 18개 초과 블록 (이탈률 급증)

### 출력
- ❌ HTML에서 외부 CDN 의존 (CSP 위반 가능)
- ❌ Markdown에서 inline HTML 남용 (gfm 호환 깨짐)
- ❌ React 컴포넌트가 zod schema 검증 안 함
- ❌ DOCX에서 색상 정보 손실 (warning 표시 없이)

---

## 10. 검증 체크리스트 (블록 빌더 PR 시)

### 데이터 무결성
- [ ] 모든 블록이 zod schema 검증 통과
- [ ] C2 후기 블록은 `reviews_raw` 키 필수
- [ ] 이미지 URL은 `safeUrl()` 통과
- [ ] 색상은 `safeColor()` 통과 (또는 theme 토큰)

### 4 출력 포맷
- [ ] HTML 출력: self-contained, esc() 적용
- [ ] Markdown 출력: GFM 표준
- [ ] React 출력: shadcn/ui 컴포넌트, type-safe props
- [ ] DOCX element 출력: 1차 텍스트/표/이미지/리스트

### Theme 호환
- [ ] flowcoder-default theme로 정상 렌더
- [ ] cosmetics-warm theme로 정상 렌더 (시범)
- [ ] tech-utility theme로 정상 렌더 (시범)

### Composition
- [ ] 4 PRESETS (landing-saas / detail-ecommerce / sns-card / business-doc) 모두 작동
- [ ] 최소/최대/권장 블록 수 검증
- [ ] F3 자동 삽입 (B→C, D→E)

### 접근성
- [ ] ARIA labels (icon, image)
- [ ] Color contrast WCAG AA
- [ ] Keyboard navigation (E3 accordion 등)
- [ ] Reduced motion 존중

---

## 11. 실제 적용 예시 (FlowStudio v2 → 메타플랫폼 PBC)

### 현재 (FlowStudio v2)
- `lib/detail-page/blocks/` — 23블록 정의
- `lib/detail-page/block-renderer.ts` — HTML 렌더러
- `app/api/templates/blocks/` — 블록 카탈로그 API
- 출력: HTML only

### 메타플랫폼 PBC (목표)
- `packages/pbc-block-builder/src/blocks/` — 23블록 정의 이전
- `packages/pbc-block-builder/src/renderers/` — 4 출력 포맷
- `packages/pbc-block-builder/src/ai/` — AI 카피 파이프라인
- `packages/pbc-block-builder/src/presets/` — 4 composition
- 출력: HTML / Markdown / React / DOCX 모두

### 마이그레이션 단계 (Phase 19, WI-501~511)
1. **WI-501**: 패키지 스켈레톤 + types.ts
2. **WI-502**: 23블록 정의 이전 (FlowStudio v2 코드 보존)
3. **WI-503-506**: 4 출력 포맷 어댑터
4. **WI-507**: AI 카피 파이프라인
5. **WI-508**: 4 PRESETS
6. **WI-509**: FlowStudio v2 빌더 마이그레이션
7. **WI-510-511**: 통합 테스트 + 문서

---

## 부록 A. 다른 표준과 정합

| 표준 | 본 문서와의 관계 |
|---|---|
| `themes/flowcoder-default.design.md` | 색/타이포/spacing 토큰 출처 |
| `app-shell-ux.md` | block-builder는 App Shell 안에 호스팅 가능 |
| FlowStudio v2 `block-system-design.md` | 출처 (23블록 명세 그대로 채용) |
| Shopify Theme Sections | 블록 컴포지션 영감 |
| Notion Blocks | 데이터-스타일 분리 영감 |
| open-design `saas-landing` skill | preset 'landing-saas' 정합 |

## 부록 B. 향후 확장 (옵션)

- **Block 신규 추가** (RFC 필요): 22번째 블록은 Architectural Review 통과 시
- **Custom variant**: 외부 개발자가 etwa B1 `industrial-strict` variant 추가 (마켓플레이스 단계)
- **Block templates** (3년 후): 자주 쓰는 composition을 사용자 저장 가능
- **A/B testing**: 같은 콘텐츠 다른 composition으로 전환율 비교 (5년 후)
