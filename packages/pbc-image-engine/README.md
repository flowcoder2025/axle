# @axle/pbc-image-engine

Pre-Built Component (PBC): the **single image-generation surface** shared by FlowStudio v1, v2, _re, FlowRetouch, AX Studio, AX Studio Cloud, and AX Studio YH.

> Spec: [`docs/specs/meta-platform/pbc-image-engine.md`](../../docs/specs/meta-platform/pbc-image-engine.md)

## Status

**Phase 19 complete** (WI-401 ~ WI-410). All five providers, the seven generation modes, and the v1 / re compat shims are shipped. CHANGELOG: [`CHANGELOG.md`](./CHANGELOG.md).

## What this package owns

| Surface | Items |
|---|---|
| Providers | `google-genai`, `vertex-ai`, `openrouter`, `comfyui-local`, `comfyui-cloud` |
| Modes | `CREATE`, `EDIT`, `COMPOSITE`, `POSTER`, `DETAIL_EDIT`, `DETAIL_PAGE`, `RETOUCH` |
| Types | `GenerationRequest`, `GenerationResult`, `GeneratedImage`, `ImageGenerationError`, `GenerationCost` |
| Helpers | `selectProvider()`, `applyPreset()`, `getWorkflow()` |
| Presets | `RETOUCH_PRO`, `RETOUCH_FREE` (FlowRetouch system prompts, canonical) |
| Compat | `compat/flowstudio-v1`, `compat/flowstudio-re` (1-line import migrations) |

## Out of scope

Credit deduction, concurrency limits, watermarking, storage upload, subscription tier checks, billing — all handled by consumer apps or the cross-cutting packages (`@axle/storage`, `@axle/auth`, etc.). This PBC is **pure image transformation**.

## Configuration

Each provider reads its credentials from env vars; pass options to the constructor to override.

| Provider | Env vars | Notes |
|---|---|---|
| `GoogleGenAIProvider` | `GEMINI_API_KEY` (or `GOOGLE_GENAI_API_KEY`) | Default model: `gemini-3-pro-image-preview` |
| `VertexAIProvider` | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS` | Stronger inpaint via Imagen-class models |
| `OpenRouterImageProvider` | `OPENROUTER_API_KEY` | Routes to DALL-E 3, Flux, etc. |
| `ComfyUILocalProvider` | `COMFYUI_LOCAL_URL` (default `http://127.0.0.1:8188`) | AX Studio desktop bridge |
| `ComfyUICloudProvider` | `VIEWCOMFY_API_KEY`, `VIEWCOMFY_BASE_URL` | AX Studio Cloud (ViewComfy) |

---

## Usage examples

The five examples below cover the modes called out in the spec's acceptance criteria (`CREATE`, `EDIT`, `POSTER`, `DETAIL_EDIT`, `RETOUCH`). Adapt the `provider` pin to your runtime; omitting it lets `selectProvider()` choose using the per-mode default preference list.

### 1. CREATE — generate from a text prompt

```ts
import { GoogleGenAIProvider, type GenerationRequest } from "@axle/pbc-image-engine";

const provider = new GoogleGenAIProvider(); // reads GEMINI_API_KEY

const req: GenerationRequest = {
  prompt: "studio portrait of a calico cat, soft window light, shallow depth of field",
  mode: "CREATE",
  provider: "google-genai",
  aspectRatio: "3:4",
  count: 1,
};

const result = await provider.generate(req);
console.log(result.images[0]?.mimeType); // "image/png"
console.log(result.duration);            // wall-clock ms
```

### 2. EDIT — modify an existing image

`sourceImage` accepts a `data:image/png;base64,…` URI **or** raw base64 bytes. Vertex / Imagen handles inpaint quality best, but Gemini also accepts the input.

```ts
import { VertexAIProvider } from "@axle/pbc-image-engine";

const provider = new VertexAIProvider();

const result = await provider.generate({
  prompt: "Replace the background sky with a sunset, keep the subject untouched",
  mode: "EDIT",
  provider: "vertex-ai",
  sourceImage: "data:image/png;base64,iVBORw0KGgoAAAANS...", // your photo
  aspectRatio: "16:9",
});
```

### 3. POSTER — composite product + logo

`POSTER` is a layout-aware mode: pass the product photo via `sourceImage` and the brand mark via `logoImage`. The provider receives both and follows the prompt's layout instruction.

```ts
import { GoogleGenAIProvider } from "@axle/pbc-image-engine";

const provider = new GoogleGenAIProvider();

const result = await provider.generate({
  prompt:
    "Korean Black Friday sale poster. Place the product centered, " +
    "the logo in the top-left corner, headline '최대 70% 할인' across the top.",
  mode: "POSTER",
  provider: "google-genai",
  sourceImage: productBase64, // hero product cutout
  logoImage: logoBase64,      // brand mark, transparent PNG
  aspectRatio: "9:16",        // mobile-first
  metadata: {
    brand: "FlowCoder",
    campaign: "BF-2026",
  },
});
```

### 4. DETAIL_EDIT — masked inpaint on a specific region

`DETAIL_EDIT` is a region-targeted edit: pass the original via `sourceImage`, the mask (white = edit, black = keep) via `maskImage`. The mask must match the source's dimensions.

```ts
import { VertexAIProvider } from "@axle/pbc-image-engine";

const provider = new VertexAIProvider();

const result = await provider.generate({
  prompt: "Replace the necklace with a thin gold chain, keep skin tone identical",
  mode: "DETAIL_EDIT",
  provider: "vertex-ai",
  sourceImage: portraitBase64,
  maskImage: necklaceMaskBase64, // white over the necklace, black elsewhere
  aspectRatio: "1:1",
});

// result.images[0] is the original with only the masked region regenerated
```

### 5. RETOUCH — apply the FlowRetouch PRO preset

The `RETOUCH_PRO` / `RETOUCH_FREE` presets carry the canonical FlowRetouch system prompt. Use `applyPreset()` to merge the preset's defaults under your request, or spread the preset directly.

```ts
import {
  GoogleGenAIProvider,
  RETOUCH_PRO,
  applyPreset,
  type GenerationRequest,
} from "@axle/pbc-image-engine";

const provider = new GoogleGenAIProvider();

// Option A: declare the preset id, let applyPreset() merge it.
const req: GenerationRequest = applyPreset({
  prompt: "Even out skin tone, soften under-eye shadows, keep natural texture",
  mode: "RETOUCH",
  provider: "google-genai",
  sourceImage: portraitBase64,
  style: "retouch-pro", // looked up in PRESETS
});

// Option B: spread the preset for explicit control.
// const req = { ...RETOUCH_PRO, prompt, sourceImage, mode: "RETOUCH", provider: "google-genai" };

const result = await provider.generate(req);
// PRO_MODE_SYSTEM_PROMPT enforces identity preservation + editorial-grade output
```

---

## Auto provider selection

Omit `request.provider` and call `selectProvider()` to pick from the per-mode default preference list. Pass an `available` map derived from `process.env` so the picker never returns a provider whose API key is missing.

```ts
import { selectProvider } from "@axle/pbc-image-engine";

const provider = selectProvider(req, {
  available: {
    "google-genai": Boolean(process.env.GEMINI_API_KEY),
    "vertex-ai": Boolean(process.env.GOOGLE_VERTEX_PROJECT),
    "openrouter": Boolean(process.env.OPENROUTER_API_KEY),
  },
});
// → instantiate the matching provider class and call .generate()
```

ComfyUI providers are excluded from auto-selection by design: a stray `selectProvider()` call should never push a generic CREATE prompt to a ComfyUI graph the caller didn't ask for. Pin `provider: "comfyui-local"` (or `"comfyui-cloud"`) explicitly when you need them.

## Errors

All providers throw `ImageGenerationError(code, retryable)`. Catch by `instanceof` + `code`:

```ts
import { ImageGenerationError } from "@axle/pbc-image-engine";

try {
  await provider.generate(req);
} catch (err) {
  if (err instanceof ImageGenerationError) {
    if (err.code === "QUOTA_EXCEEDED" && err.retryable) {
      // back off and retry
    } else if (err.code === "CONTENT_FILTERED") {
      // surface a "rephrase" affordance to the user
    }
  }
}
```

| Code | Retryable | Cause |
|---|---|---|
| `INVALID_INPUT` | no | Empty prompt, bad mask shape, unknown style id |
| `PROVIDER_UNAVAILABLE` | sometimes | Missing API key, 401/403, network error (retryable) |
| `QUOTA_EXCEEDED` | yes | HTTP 429 |
| `CONTENT_FILTERED` | no | Safety filter blocked the prompt or output |
| `TIMEOUT` | yes | ComfyUI workflow exceeded `timeoutMs` |
| `UNKNOWN` | varies | Unexpected response shape, no images returned |

## Compat shims (cross-repo migration)

| App | Import path | Playbook |
|---|---|---|
| FlowStudio v1 | `@axle/pbc-image-engine/compat/flowstudio-v1` | [`migrations/flowstudio-v1-to-pbc.md`](../../docs/specs/meta-platform/migrations/flowstudio-v1-to-pbc.md) |
| FlowStudio_re | `@axle/pbc-image-engine/compat/flowstudio-re` | [`migrations/flowstudio-re-to-pbc.md`](../../docs/specs/meta-platform/migrations/flowstudio-re-to-pbc.md) |

Each shim preserves the original `generateImage()` signature so callsites migrate via a 1-line import swap; the playbooks document the breaking change in error handling (`err.status` → `err.code`).

## Testing

```bash
# Unit + fixture-mocked smoke tests (run on every CI push)
npm run test --workspace=@axle/pbc-image-engine

# Live integration tests (manual, secrets required)
GEMINI_API_KEY=…   npm run test:integration -w @axle/pbc-image-engine -- googleGenAI.live
COMFYUI_LIVE=1     npm run test:integration -w @axle/pbc-image-engine -- comfyuiLocal.live
```

Fixture refresh procedure: see [`__tests__/fixtures/README.md`](./__tests__/fixtures/README.md).

## Architecture notes

- **Dep-free at install time.** All providers use `globalThis.fetch`; no SDK is required. Tests inject a fake `fetch` via `ProviderRuntimeOptions.fetch`.
- **Adapter injection.** Constructors accept `fetch`, `signal`, and (ComfyUI only) `sleep`/`now` overrides so unit tests stay deterministic.
- **One canonical type per concept.** Apps depend on `GenerationRequest` / `GenerationResult`; provider-specific shapes never leak past the adapter boundary.
- **Errors are normalized.** Vendor error codes map to the PBC's `ErrorCode` set (see table above). The compat shims preserve this normalization.
