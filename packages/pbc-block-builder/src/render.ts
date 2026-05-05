/**
 * Top-level render dispatcher (WI-503).
 *
 * `renderBlock` and `renderComposition` are the public entrypoints listed in
 * `pbc-block-builder.md` §3.2. They route to the appropriate per-output
 * adapter based on `RenderContext.output`:
 *
 *   - `"html"`         → `renderBlockHtml` (this WI)
 *   - `"react"`        → placeholder until WI-504 ships
 *   - `"markdown"`     → placeholder until WI-505 ships
 *   - `"docx-element"` → placeholder until WI-506 ships
 *
 * The placeholder fallback delegates to the existing per-block `render`
 * function (WI-502 `_helpers.placeholderRender`) so consumers can wire the
 * pipeline end-to-end before every output adapter has shipped — they simply
 * see a self-describing marker for the not-yet-implemented outputs.
 *
 * `renderComposition` is async per the spec signature even though the HTML
 * path is synchronous; future renderers (e.g. DOCX with image fetching) may
 * need to await asset resolution.
 */

import { BLOCKS } from "./blocks/index.js";
import { renderBlockHtml } from "./renderers/html.js";
import type {
  BlockId,
  PageComposition,
  RenderContext,
  RenderResult,
} from "./types.js";

export function renderBlock(
  blockId: BlockId,
  data: unknown,
  context: RenderContext,
): RenderResult {
  if (context.output === "html") {
    return renderBlockHtml(blockId, data, context);
  }

  // Placeholder fallback — defers to the per-block `render` function the
  // WI-502 helper installed. Each sibling renderer (WI-504..506) will swap
  // its branch into this dispatcher at merge time.
  const def = BLOCKS[blockId];
  if (!def) {
    throw new Error(`renderBlock: unknown block id '${blockId}'`);
  }
  return def.render(data, context);
}

export async function renderComposition(
  composition: PageComposition,
  context: RenderContext,
): Promise<RenderResult[]> {
  const results: RenderResult[] = [];
  for (const entry of composition.blocks) {
    const entryContext: RenderContext = entry.variant
      ? {
          ...context,
          metadata: { ...(context.metadata ?? {}), variant: entry.variant },
        }
      : context;
    results.push(renderBlock(entry.id, entry.data, entryContext));
  }
  return results;
}
