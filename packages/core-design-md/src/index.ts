/**
 * `@axle/core-design-md` — DESIGN.md token loader for the
 * meta-platform's `core-design-md` PBC slot (PRD §4 L2-B1).
 *
 * The package converts a DESIGN.md spec into a structured
 * `DesignTokens` record, then renders that record into the two
 * shapes the consumer needs:
 *
 *   - CSS variables (drop into globals.css)
 *   - Tailwind v4 `@theme` extension
 *
 * Minimal-viable scope (WI-613): the §2 Color Palette tables only
 * (Neutral Scale + Sidebar). Typography / spacing / motion sections
 * are reserved for follow-up WIs.
 */

export { parseDesignMd, labelToTokenKey } from "./parser.js";
export { loadDesignTokens } from "./loader.js";
export { tokensToCssVariables, tokensToTailwindConfig } from "./inject.js";
export type { DesignTokens } from "./types.js";
