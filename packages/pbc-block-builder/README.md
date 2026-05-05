# @axle/pbc-block-builder

Pre-Built Component (PBC): the **single block-based content surface** for landing pages, e-commerce detail pages, SNS cards, and business documents. Generalizes FlowStudio v2's 23-block catalog into a render-target-agnostic engine.

> Spec: [`docs/specs/meta-platform/pbc-block-builder.md`](../../docs/specs/meta-platform/pbc-block-builder.md)
> Visuals catalog: [`docs/specs/meta-platform/pbc-block-builder-visuals.md`](../../docs/specs/meta-platform/pbc-block-builder-visuals.md)

## Status

**Phase 19 complete** (WI-501 ~ WI-511). 23 blocks, 4 output adapters, AI copy pipeline, 4 PRESETS, FlowStudio v2 compat shim, snapshot regression. Changelog: [`CHANGELOG.md`](./CHANGELOG.md).

## What this package owns

| Surface | Items |
|---|---|
| Blocks | 23 definitions (A1–F3) across 6 categories — Opening / Core Value / Trust / Detail / Conversion / Mood |
| Outputs | `html` (string), `react` (ReactNode), `markdown` (string), `docx-element` (DocxElement[]) |
| Engine | `renderBlock`, `renderComposition`, `validateBlockData` |
| AI pipeline | `generateCopy` (5-stage intake → analyze → anchor → block-copy → assemble) with injectable `CopyProvider` |
| Presets | `landing-saas`, `detail-ecommerce`, `sns-card`, `business-doc` |
| Compat | `compat/flowstudio-v2` (1-line import migration) |

## Out of scope

Image generation (delegated to `@axle/pbc-image-engine` — optional peerDep), drag-and-drop editor UI (consumer app), routing / auth / billing (consumer app), real customer review fabrication (refused — Korean fair-trade law).

---

## 23-block catalog

Block ids stay stable; the human-readable category names below come from `pbc-block-builder-visuals.md` §1.

### A — Opening (도입부)

| Id | Name | Schema highlights |
|---|---|---|
| A1 | Hero Visual | `headline`, `tagline?`, `backgroundImage?`, CTA pair |
| A2 | One-line Hook | `line` |
| A3 | Problem Statement | `points[]`, `intro?` |

### B — Core Value (핵심 소구)

| Id | Name | Schema highlights |
|---|---|---|
| B1 | Feature Cards | `items[]` (title + description, 2..6) |
| B2 | Before / After | `before`, `after`, `caption?` |
| B3 | Key Ingredient / Tech | `name`, `description`, `properties?` |
| B4 | USP Full-shot | `imageSrc`, `callouts?`, `headline?` |

### C — Trust (신뢰 구축)

| Id | Name | Schema highlights |
|---|---|---|
| C1 | Certification / Awards | `items[]` (name + issuer? + year?) |
| C2 | Customer Reviews | `reviews[]` — **AI generation refused** (real reviews only) |
| C3 | Media Coverage | `items[]` (outlet + url?) |
| C4 | Brand Story | `headline`, `body`, `timeline?` |
| C5 | Numbers | `items[]` (label + value + unit?) |

### D — Detail (상세 정보)

| Id | Name | Schema highlights |
|---|---|---|
| D1 | Spec Table | `rows[]` (label + value), `title?` |
| D2 | Usage Guide | `steps[]` |
| D3 | Package Contents | `items[]` (name + quantity?) |
| D4 | Size Guide | `chart` (headers + rows) |

### E — Conversion (전환 유도)

| Id | Name | Schema highlights |
|---|---|---|
| E1 | CTA Banner | `price`, `ctaText`, `ctaHref`, `urgencyText?` |
| E2 | Promotion / Coupon | `title`, `discount?`, `code?`, `expiresAt?` |
| E3 | FAQ | `items[]` (question + answer) |
| E4 | Shipping & Returns | `shippingNote`, `returnNote`, `policies?` |

### F — Mood (감성 연출)

| Id | Name | Schema highlights |
|---|---|---|
| F1 | Lifestyle Shot | `images[]`, `aspectRatio?` |
| F2 | Color / Options | `options[]` (name + colorHex?) |
| F3 | Divider / Whitespace | `height?`, `label?` |

Programmatic access:

```ts
import { BLOCKS, getBlock, listBlockIds, listBlocksByCategory } from "@axle/pbc-block-builder";

listBlockIds();              // ["A1", "A2", ..., "F3"]
listBlocksByCategory("D");   // 4 blocks (D1..D4)
getBlock("A1")?.schema;      // zod schema
```

---

## 4 output formats — side-by-side comparison

Same composition, four adapters. The table below summarises the structural differences; full examples follow.

| Adapter | `RenderResult.content` type | Wrapper | Escape policy | Best for |
|---|---|---|---|---|
| `html` | `string` | `<section class="pbc-block pbc-{id} pbc-{id}--{variant}" data-block-id>` | `escapeHtml` on every interpolated string | Server-rendered pages, static-site exports |
| `react` | `ReactNode` | `<section className="pbc-block pbc-{id} ..." data-block-id>` | React's automatic child escaping (no `dangerouslySetInnerHTML`) | Next.js / SPA components |
| `markdown` | `string` | `<!-- pbc:{id} variant=… -->` HTML comment marker | Markdown control chars escaped (`* _ [ ] \` `\|` etc.); URLs encode `(`/`)` | Docs, READMEs, CMS exports |
| `docx-element` | `DocxElement[]` | metadata-only (`metadata.blockId`) | Library-free element tree (paragraph / heading / list / image) | Word / Pages export via `docx`, `officegen`, … |

### Same A1 hero in all four

```ts
import {
  renderBlock,
  type RenderContext,
  type DocxElement,
} from "@axle/pbc-block-builder";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const data = {
  headline: "Ship faster. Stress less.",
  tagline: "Opinionated platform for engineering teams.",
  ctaText: "Start free trial",
  ctaHref: "/signup",
};

// HTML ----------------------------------------------------------------
const html = renderBlock("A1", data, { output: "html" }).content as string;
// → <section class="pbc-block pbc-A1" data-block-id="A1">
//     <div class="pbc-A1__inner">
//       <h1 class="pbc-A1__headline">Ship faster. Stress less.</h1>
//       <p class="pbc-A1__tagline">Opinionated platform for engineering teams.</p>
//       <a class="pbc-A1__cta" href="/signup">Start free trial</a>
//     </div>
//   </section>

// React ---------------------------------------------------------------
const reactNode = renderBlock("A1", data, { output: "react" }).content as ReactNode;
const reactHtml = renderToStaticMarkup(reactNode);
// → identical structure to the HTML output, produced via JSX

// Markdown ------------------------------------------------------------
const md = renderBlock("A1", data, { output: "markdown" }).content as string;
// <!-- pbc:A1 -->
//
// # Ship faster\. Stress less\.
//
// Opinionated platform for engineering teams\.
//
// [Start free trial](/signup)

// DOCX-element --------------------------------------------------------
const docx = renderBlock("A1", data, { output: "docx-element" }).content as DocxElement[];
// [
//   { type: "heading", level: 1, runs: [{ text: "Ship faster. Stress less." }] },
//   { type: "paragraph", runs: [{ text: "Opinionated platform for engineering teams." }] },
//   { type: "paragraph", runs: [{ text: "Start free trial → /signup", bold: true }] }
// ]
```

### Variant + theme propagation

`RenderContext.metadata.variant` adds a `pbc-{id}--{variant}` modifier in HTML/React, a `variant=…` field in the Markdown marker, and lands in `RenderResult.metadata.variant` for DOCX consumers.

```ts
const ctx: RenderContext = { output: "html", metadata: { variant: "split-half" } };
const result = renderBlock("A1", data, ctx);
// content includes class="pbc-block pbc-A1 pbc-A1--split-half"
```

---

## Composition workflow

```ts
import {
  renderComposition,
  PRESETS,
  type PageComposition,
} from "@axle/pbc-block-builder";

// Drop-in starter — every preset's payloads validate against zod schemas.
const composition: PageComposition = PRESETS["landing-saas"];

const htmlResults = await renderComposition(composition, { output: "html" });
const markdownResults = await renderComposition(composition, { output: "markdown" });
// renderResults preserve composition order; metadata.blockId is stable across adapters.
```

The four PRESETS are starting templates, not finished pages — fill in your real content over time:

| Preset | Block sequence (highlights) |
|---|---|
| `landing-saas` | A1 → A3 → B1 → C5 → C1 → E3 → E1 |
| `detail-ecommerce` | A1 → B2 → B1 → C2 → D1 → D3 → F2 → E2 → E4 → E1 |
| `sns-card` | A1 → A2 → F1 → E1 (≤ 5 blocks for a single card) |
| `business-doc` | A1 → C4 → A3 → B1 → C5 → D1 → D2 → E4 (D-heavy for DOCX export) |

---

## AI copy pipeline (`generateCopy`)

5-stage pipeline (intake → analyze → anchor → block-copy → assemble). Returns block-shaped payloads ready to feed into `renderComposition`.

```ts
import { generateCopy } from "@axle/pbc-block-builder";

const result = await generateCopy({
  intent: "Premium ergonomic chair for back pain. Lumbar support, breathable mesh, 5-year warranty.",
  industry: "office furniture",
  brandTone: "confident, technical",
  language: "en",
  targetBlocks: ["A1", "A3", "B1", "C5", "E1"],
});

result.blocks;          // [{ id: "A1", data: { headline: "...", ... } }, ...]
result.rationale;       // human-readable trail (skip / refuse / failed validation reasons)
result.generationTime;  // ms
```

The default provider is **deterministic** — no LLM call, payloads built directly from the intent text. Plug `@axle/ai` (or any other LLM-backed provider) by passing `{ provider }`:

```ts
import { generateCopy, type CopyProvider } from "@axle/pbc-block-builder";

const provider: CopyProvider = {
  async brief(req) { /* call your LLM */ },
  async blockCopy(req) { /* call your LLM constrained by req.blockSchema */ },
};

await generateCopy(request, { provider });
```

**C2 reviews are hard-refused.** Korean fair-trade law forbids fabricated customer reviews; the pipeline skips C2 before the provider is ever called and records the refusal in `rationale`. Populate C2 with real `reviews_raw` rows from your DB.

---

## FlowStudio v2 migration

Drop-in replacement at `@axle/pbc-block-builder/compat/flowstudio-v2`. Single-line import swap preserves v2's `format` enum and flat options shape:

```diff
- import { renderBlock } from "@/lib/detail-page/block-renderer";
+ import { renderBlock } from "@axle/pbc-block-builder/compat/flowstudio-v2";

  renderBlock("A1", data, { format: "html", variant: "split-half" });
```

`format: "docx"` (v2 spelling) translates to `"docx-element"`. Full playbook with breaking-change notes (XSS escape, stricter zod, AI provider injection): [`migrations/flowstudio-v2-to-pbc.md`](../../docs/specs/meta-platform/migrations/flowstudio-v2-to-pbc.md).

---

## Demo

Runnable starter:

```bash
npx tsx packages/pbc-block-builder/examples/landing-saas-demo.ts
```

Prints all four output adapters for a SaaS landing composition. Use it as a wiring template for your own app.

---

## Testing

```bash
npm run test --workspace=@axle/pbc-block-builder
```

179 unit + integration tests cover:
- per-block schema and registry shape (WI-501/502)
- 4 output adapters with XSS / escape regression (WI-503..506)
- `generateCopy` pipeline behaviours including C2 refusal and schema-failure recovery (WI-507)
- 4 PRESETS render cleanly through every adapter (WI-508)
- FlowStudio v2 compat surface (WI-509)
- snapshot regression for `preset × output` and end-to-end pipeline (WI-510)

The snapshot file is committed at `__tests__/integration/__snapshots__/preset-snapshots.test.ts.snap` — accidental renderer changes show up as a reviewable diff.

---

## See also

- [`@axle/pbc-image-engine`](../pbc-image-engine/README.md) — optional peerDep for image generation through `RenderContext.imageEngine`
- [`docs/specs/meta-platform/pbc-block-builder.md`](../../docs/specs/meta-platform/pbc-block-builder.md) — full spec
- [`docs/specs/meta-platform/pbc-block-builder-visuals.md`](../../docs/specs/meta-platform/pbc-block-builder-visuals.md) — block visuals / mood / category notes
