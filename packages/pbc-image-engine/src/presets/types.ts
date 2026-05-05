/**
 * Preset = a partial `GenerationRequest` that callers select via `style` or
 * via the explicit `applyPreset()` helper. Presets are pure values — no
 * side effects, no env reads — so they're safe to import in workers,
 * RSC, edge runtimes alike.
 */

import type { GenerationRequest } from "../types.js";

/**
 * A preset never sets `prompt` (the user's intent is always theirs); it can
 * however inject `mode`, `negativePrompt`, `style`, `aspectRatio`, default
 * `metadata` (e.g. `systemPrompt`), and reasonable provider hints.
 */
export type Preset = Omit<Partial<GenerationRequest>, "prompt">;
