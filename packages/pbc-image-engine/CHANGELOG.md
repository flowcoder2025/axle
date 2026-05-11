# Changelog

All notable changes to `@axle/pbc-image-engine` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This package is internal to the AXLE monorepo and not yet semver-versioned; entries are grouped by Phase / WI batch.

## [Unreleased]

### Added

- **`generate()` orchestrator** (WI-611): single entry point that runs `selectProvider()`, applies a registered preset, lazily instantiates the matching adapter (or uses one injected via `options.providers`), and normalises adapter errors into `ImageGenerationError`. Replaces the "instantiate a provider class directly" workaround the previous README documented.
- **`getEstimatedCost()`** (WI-611): deterministic `{ credits, usd }` preview for a request. Never throws, always returns positive numbers; safe default fallback for unknown combinations.
- **`buildPrompt()`** (WI-611): prompt normalisation helper used by `generate()` — applies preset, injects mode-aware system hint, appends negative prompt + aspect ratio tail.

### Changed

- README's five usage examples now lead with `generate()`; direct provider instantiation is documented as the adapter-level escape hatch rather than the recommended path.

## [0.0.1] — 2026-05-05 — Phase 19 / WI-401 ~ WI-410

First complete release of the PBC. The package now consolidates the image-generation surface that previously lived inside FlowStudio v1, v2, _re, FlowRetouch, AX Studio, AX Studio Cloud, and AX Studio YH.

### Added

- **Type contract** (WI-401): `GenerationRequest`, `GenerationResult`, `GeneratedImage`, `GenerationCost`, `ImageGenerationError`, `ImageEngine`, plus the `IMAGE_PROVIDERS`, `GENERATION_MODES`, `ASPECT_RATIOS`, `ERROR_CODES`, `REFERENCE_MODES` constants.
- **Direct API providers** (WI-402): `GoogleGenAIProvider`, `VertexAIProvider`, `OpenRouterImageProvider` ported from FlowStudio v2's `imageProvider/`. All three call `globalThis.fetch` directly — no SDK dependency.
- **Auto provider selection** (WI-403): `selectProvider()` with per-mode default preference lists. ComfyUI providers are excluded from auto-selection on purpose; pin `provider` explicitly to use them.
- **ComfyUI Local adapter** (WI-404): `ComfyUILocalProvider` with the Z-Image workflow registered (`Z_IMAGE_WORKFLOW`). Submit → poll `/history` → pull bytes via `/view`. Adapter injection (`sleep`, `now`, `fetch`) keeps unit tests deterministic.
- **ComfyUI Cloud adapter** (WI-405): `ComfyUICloudProvider` for ViewComfy / AX Studio Cloud.
- **FlowRetouch RETOUCH mode + presets** (WI-406): `RETOUCH_PRO` and `RETOUCH_FREE` presets carry the canonical FlowRetouch system prompts (`PRO_MODE_SYSTEM_PROMPT`, `FREE_MODE_SYSTEM_PROMPT`). `applyPreset()` merges a preset under a request when `style` matches a registered id; new presets register via `registerPreset()`.
- **FlowStudio v1 compat shim** (WI-407): `@axle/pbc-image-engine/compat/flowstudio-v1` preserves v1's `generateImage()` signature for a 1-line import migration. Playbook: `docs/specs/meta-platform/migrations/flowstudio-v1-to-pbc.md`.
- **FlowStudio_re compat shim** (WI-408): `@axle/pbc-image-engine/compat/flowstudio-re` delegates to the v1 facade with RE-prefixed types (`Re*`). Playbook: `docs/specs/meta-platform/migrations/flowstudio-re-to-pbc.md`.
- **Integration test layer** (WI-409): split into two runners.
  - `npm test` runs fixture-mocked smoke tests for both Google GenAI and ComfyUI Local — exercises the response decoders against captured API shapes, no network calls. Always green in CI.
  - `npm run test:integration` runs `*.live.test.ts`. Self-skips when `GEMINI_API_KEY` / `COMFYUI_LIVE` is unset, so a secret-less invocation is a no-op rather than a failure. Spec budget: one call per provider per integration run.
  - Fixtures live in `__tests__/fixtures/` with a refresh playbook in the directory's `README.md`.
- **README + CHANGELOG** (WI-410): five usage examples (CREATE / EDIT / POSTER / DETAIL_EDIT / RETOUCH), provider configuration matrix, error code table, compat-shim cross-reference, and this changelog.

### Notable design decisions

- **Dep-free at install time.** Every provider uses `globalThis.fetch`. Adding the package to a consumer app introduces zero runtime SDK weight.
- **Errors are normalized at the adapter boundary.** Vendor error shapes (`err.status`, vendor-specific JSON) never reach the consumer; everything maps to `ImageGenerationError(code, retryable)` with a fixed `ErrorCode` enum.
- **Adapter injection over global mocks.** `fetch`, `signal`, `sleep`, and `now` are constructor options. Tests pass deterministic stubs; production code passes nothing and gets sensible defaults.
- **Compat shims are non-breaking by construction.** A FlowStudio v1 / _re consumer migrates by changing one import path; the response shape stays identical (`durationMs`, no `cost`).

### Out of scope (intentionally not in this PBC)

Credit deduction, concurrency limits, watermarking, storage uploads, subscription tier checks, billing — all owned by consumer apps or other PBCs (`@axle/storage`, `@axle/auth`).

### Migration links

- FlowStudio v1 → PBC: [`migrations/flowstudio-v1-to-pbc.md`](../../docs/specs/meta-platform/migrations/flowstudio-v1-to-pbc.md)
- FlowStudio_re → PBC: [`migrations/flowstudio-re-to-pbc.md`](../../docs/specs/meta-platform/migrations/flowstudio-re-to-pbc.md)
