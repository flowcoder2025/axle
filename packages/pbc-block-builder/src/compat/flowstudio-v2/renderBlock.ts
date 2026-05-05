/**
 * FlowStudio v2 compat — `renderBlock` / `renderComposition` translators.
 *
 * Drop-in replacements for v2's `lib/detail-page/block-renderer.ts`. The
 * callsite migration is a single import swap:
 *
 *   - import { renderBlock } from "@/lib/detail-page/block-renderer";
 *   + import { renderBlock } from "@axle/pbc-block-builder/compat/flowstudio-v2";
 *
 * Behavioural notes:
 *   - `format: "docx"` (v2 spelling) is translated to PBC's
 *     `"docx-element"`. Result `metadata.output` reflects the PBC name.
 *   - `variant` and `theme` flow through as `RenderContext.metadata.variant`
 *     and `RenderContext.theme` respectively — same hooks the renderers
 *     already consume.
 *   - Schema validation, escape, and wrapper-class rules are inherited
 *     from the underlying PBC renderers (WI-503..506); the compat layer
 *     adds zero new behaviour beyond translation.
 */

import {
  renderBlock as pbcRenderBlock,
  renderComposition as pbcRenderComposition,
} from "../../render.js";
import type {
  BlockId,
  RenderContext,
  RenderOutput,
  RenderResult,
} from "../../types.js";
import type {
  V2Composition,
  V2Format,
  V2RenderOptions,
} from "./types.js";

const V2_FORMATS: ReadonlySet<V2Format> = new Set(["html", "markdown", "react", "docx"]);

function toRenderOutput(format: V2Format): RenderOutput {
  switch (format) {
    case "html":
    case "markdown":
    case "react":
      return format;
    case "docx":
      return "docx-element";
    default:
      // Defence in depth — TypeScript narrows V2Format to exactly the four
      // entries above, but a v2 callsite passing an arbitrary string would
      // bypass the type-checker.
      throw new Error(`renderBlock(compat/v2): unsupported format '${format as string}'`);
  }
}

function toRenderContext(options: V2RenderOptions): RenderContext {
  if (!V2_FORMATS.has(options.format)) {
    throw new Error(
      `renderBlock(compat/v2): unsupported format '${options.format as string}'`,
    );
  }
  const metadata: Record<string, unknown> = { ...(options.metadata ?? {}) };
  if (options.variant) metadata.variant = options.variant;

  const ctx: RenderContext = { output: toRenderOutput(options.format) };
  if (options.theme) ctx.theme = options.theme;
  if (options.locale) ctx.locale = options.locale;
  if (Object.keys(metadata).length) ctx.metadata = metadata;
  return ctx;
}

export function renderBlock(
  blockId: BlockId,
  data: unknown,
  options: V2RenderOptions,
): RenderResult {
  return pbcRenderBlock(blockId, data, toRenderContext(options));
}

export async function renderComposition(
  composition: V2Composition,
  options: V2RenderOptions,
): Promise<RenderResult[]> {
  return pbcRenderComposition(composition, toRenderContext(options));
}
