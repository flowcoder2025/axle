/**
 * FlowStudio v2 compat — type aliases for the v2 callsite shape.
 *
 * V2's `lib/detail-page/block-renderer.ts` exposed a single flat options
 * object with `format` instead of the PBC's `RenderContext.output`. The
 * compat shim translates between the two; consumers migrating their v2
 * code keep using the v2 names while the shim does the translation.
 */

import type { BlockId } from "../../types.js";

/**
 * v2's `format` enum. Note `docx` (v2) → `docx-element` (PBC). The shim
 * normalizes this difference.
 */
export type V2Format = "html" | "markdown" | "react" | "docx";

/** v2's render options — flat object, no nested `output` field. */
export interface V2RenderOptions {
  format: V2Format;
  /** Block variant id forwarded as `RenderContext.metadata.variant`. */
  variant?: string;
  /** Theme tokens forwarded as `RenderContext.theme`. */
  theme?: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    spacing: Record<string, string>;
    extras?: Record<string, unknown>;
  };
  /** Locale hint, forwarded as `RenderContext.locale`. */
  locale?: "ko" | "en";
  /** Free-form metadata forwarded into `RenderContext.metadata`. */
  metadata?: Record<string, unknown>;
}

export interface V2CompositionEntry {
  id: BlockId;
  data: unknown;
  variant?: string;
}

export interface V2Composition {
  blocks: V2CompositionEntry[];
  theme?: string;
  metadata?: Record<string, unknown>;
}
