/**
 * `@axle/core-design-md` — public type contract.
 *
 * `DesignTokens` is the structured projection of a DESIGN.md file. The
 * WI-613 minimal-viable scope covers two table groups under §2 Color
 * Palette:
 *
 *   - **Neutral Scale** (Zinc) — the `colors.{light,dark}` records
 *   - **Sidebar (Brand-Override Layer)** — the `sidebar.{light,dark}` records
 *
 * Typography / spacing / motion / radius / shadow tokens live under
 * later DESIGN.md sections (§3..§10) and are intentionally **out of
 * scope** for this WI (follow-up). The interface still ships room for
 * them via `meta` so the v1 cut doesn't have to break the type
 * contract when those sections get parsed.
 *
 * Token key convention: **kebab-case**, derived from the role label
 * in the markdown table (e.g. "Text Primary" → `text-primary`,
 * "Sidebar Active BG" → `sidebar-active-bg`). The parser owns the
 * normalisation rule.
 */

export interface DesignTokens {
  /** Neutral / role colors (light + dark variants). */
  colors: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  /** Sidebar brand-override layer (light + dark variants). */
  sidebar: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  /** Free-form metadata extracted from the DESIGN.md header. */
  meta: {
    /** First H1 title (e.g. "FlowCoder Default"). */
    name: string;
    /** Value of the "Category:" blockquote line, if present. */
    category?: string;
  };
}
