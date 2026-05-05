# Changelog

All notable changes to `@axle/pbc-block-builder` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This package is internal to the AXLE monorepo and not yet semver-versioned; entries are grouped by Phase / WI batch.

## [Unreleased]

_No unreleased changes._

## [0.0.1] — 2026-05-05 — Phase 19 / WI-501 ~ WI-511

First complete release of the PBC. Generalizes FlowStudio v2's 23-block detail-page system into a render-target-agnostic engine for landing pages, e-commerce detail pages, SNS cards, and business documents.

### Added

- **Type contract** (WI-501): `BlockDefinition`, `BlockId`, `BlockCategory`, `RenderContext`, `RenderResult`, `RenderOutput`, `PageComposition`, `BlockBuilderEngine`, plus the `BLOCK_CATEGORIES`, `RENDER_OUTPUTS`, `LOCALES` constants.
- **23-block registry** (WI-502): `BLOCKS` registry keyed by `BlockId`, `getBlock`, `listBlockIds`, `listBlocksByCategory`, `BLOCK_CATEGORY_NAMES`, `getCategoryMeta`. Schemas come from FlowStudio v2's `block-system-design.md`. Per-block placeholder render emits a stable `[pbc-block-builder placeholder]` marker until each output adapter ships.
- **HTML renderer** (WI-503): `renderBlockHtml` for all 23 blocks. Schema-first validation, `escapeHtml` on every interpolated string, `pbc-block pbc-{id} pbc-{id}--{variant}` wrapper class with `data-block-id` attribute.
- **React renderer** (WI-504): `renderBlockReact` mirrors the HTML contract but returns `ReactNode`. Relies on React's automatic child escaping — no `dangerouslySetInnerHTML` anywhere. `react` and `@types/react` are optional peerDependencies so HTML / Markdown / DOCX consumers do not pay for the React runtime.
- **Markdown renderer** (WI-505): `renderBlockMarkdown` for all 23 blocks. Each block emits a `<!-- pbc:{id} variant=… -->` HTML comment marker. `escapeMarkdown` covers control chars (`*`, `_`, `[`, `]`, `\``, `|`, `<`, `>`, `\\`); URL fields encode parentheses to keep `[label](url)` parsing intact.
- **DOCX-element renderer** (WI-506): `renderBlockDocxElement` returns a library-free `DocxElement[]` tree using a v1 vocabulary of `paragraph` / `heading` / `list` / `image`. Tables (D1 / D4) and complex layouts (B2 / B4 / F3) degrade to heading + bullet lists of `Label: Value` rows. Apps walk the array and call into `docx`, `officegen`, etc.
- **Top-level dispatcher** (WI-503..WI-506): `renderBlock(blockId, data, context)` and `renderComposition(composition, context)` route to the appropriate adapter via `RenderContext.output`. Composition order is preserved across all four adapters; `metadata.blockId` stays stable.
- **AI copy pipeline** (WI-507): `generateCopy(request, options?)` runs a 5-stage pipeline (intake → analyze → anchor → block-copy → assemble) with an injectable `CopyProvider`. Default `createDeterministicCopyProvider()` produces zod-valid payloads for every supported block from the intent text — no LLM required for tests, demos, or offline builds. **C2 reviews are hard-refused** before any provider call (Korean fair-trade law). Schema-failing payloads are dropped with a recorded reason so a partially-bad LLM response still yields a usable page. `validateBlockData(blockId, data)` is exposed publicly per spec §3.2.
- **4 PRESETS** (WI-508): `PRESETS` map with `landing-saas`, `detail-ecommerce`, `sns-card`, `business-doc`. Every preset's payloads validate against the per-block zod schemas and render cleanly through all four output adapters.
- **FlowStudio v2 compat shim** (WI-509): `@axle/pbc-block-builder/compat/flowstudio-v2` preserves v2's `lib/detail-page/` API surface for a 1-line import migration. `format: "docx"` (v2 spelling) translates to `"docx-element"`. Playbook: `docs/specs/meta-platform/migrations/flowstudio-v2-to-pbc.md`.
- **Integration tests + demo** (WI-510): preset × output snapshots (12 files, committed) catch cross-format regressions; end-to-end pipeline test exercises `generateCopy → renderComposition` through all four adapters; `examples/landing-saas-demo.ts` is a runnable consumer wiring template.
- **README + CHANGELOG** (WI-511): 23-block catalog table, 4 output formats side-by-side comparison with a same-A1-in-all-four example, composition workflow, AI pipeline, FlowStudio v2 migration cross-link, and this changelog.

### Notable design decisions

- **Render-target agnostic.** Same composition / same data / four outputs. The renderer-level dispatcher keeps the per-adapter code isolated so a fifth output (PDF, slides) lands as one file plus a `case` in `renderBlock`.
- **Schema-first everywhere.** Every render call validates input through the block's zod schema before producing markup. Consumers see a descriptive error rather than partial output. The AI pipeline reuses the same schemas to constrain provider output.
- **XSS-safe by construction.** HTML/React adapters escape all user content; no `dangerouslySetInnerHTML` exists anywhere in the package. Markdown is XSS-passive (downstream HTML conversion owns the final escape policy) but Markdown's own syntax is protected.
- **Optional peerDependencies.** `react` and `@axle/pbc-image-engine` are optional peers — consumers using only HTML / Markdown / DOCX pay zero install cost for unused surfaces.
- **C2 refusal lives in the pipeline.** Per Korean fair-trade law, the AI cannot fabricate reviews. The refusal is enforced before the provider is ever called, so an over-eager LLM cannot bypass it.
- **Compat shim is non-breaking by construction.** A FlowStudio v2 consumer migrates by changing one import path; the response shape stays identical (`format` field, options object, return shape).

### Out of scope (intentionally not in this PBC)

Image generation (delegated to `@axle/pbc-image-engine` via optional `RenderContext.imageEngine`), drag-and-drop editor UI (consumer app), routing / auth / billing (consumer app), 100% DESIGN.md theme integration (`core-design-md` PBC), DOCX-element coverage of every block (v1 supports text/image/list/heading; tables degrade to lists).

### Migration links

- FlowStudio v2 → PBC: [`migrations/flowstudio-v2-to-pbc.md`](../../docs/specs/meta-platform/migrations/flowstudio-v2-to-pbc.md)
