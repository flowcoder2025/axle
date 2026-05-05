# @axle/pbc-image-engine

Pre-Built Component (PBC): the **single image-generation surface** shared by FlowStudio v1, v2, _re, FlowRetouch, AX Studio, AX Studio Cloud, and AX Studio YH.

> Spec: [`docs/specs/meta-platform/pbc-image-engine.md`](../../docs/specs/meta-platform/pbc-image-engine.md)

## Status

Phase 19 / WI-401 — **type contract only**. Provider implementations and the public `generate()` orchestrator land in WI-402..WI-410.

## What this package owns

- `ImageProvider` — `google-genai` | `vertex-ai` | `openrouter` | `comfyui-local` | `comfyui-cloud`
- `GenerationMode` — `CREATE` | `EDIT` | `COMPOSITE` | `POSTER` | `DETAIL_EDIT` | `DETAIL_PAGE` | `RETOUCH`
- `GenerationRequest` / `GenerationResult` / `ImageGenerationError`
- `ImageEngine` interface — for dependency injection into other PBCs

## Out of scope

Credit deduction, concurrency limits, watermarking, storage upload, subscription tier checks, billing — all handled by consumer apps or the cross-cutting packages (`@axle/storage`, `@axle/auth`, etc.). This PBC is **pure image transformation**.

## Usage (after WI-402+)

```ts
import { generate, type GenerationRequest } from "@axle/pbc-image-engine";

const result = await generate({
  prompt: "studio portrait, soft light",
  mode: "CREATE",
  aspectRatio: "3:4",
});
```

For now, only the types are exported. Import `ImageEngine` to declare a dependency:

```ts
import type { ImageEngine } from "@axle/pbc-image-engine";

interface RenderContext {
  imageEngine: ImageEngine;
}
```
