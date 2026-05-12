/**
 * `tokensToCssVariables` / `tokensToTailwindConfig` — render
 * `DesignTokens` into the two consumer-facing shapes the WI-613 spec
 * calls out:
 *
 *   1. CSS variable declarations (`:root { --text-primary: #18181B; }`
 *      and `.dark { ... }`) — drop-in for any globals.css.
 *   2. A Tailwind v4 `@theme`-compatible plain object — the colors
 *      extension a consumer can spread into their config.
 *
 * Both renderers are deterministic and order tokens alphabetically by
 * key so two parses of the same DESIGN.md produce byte-identical
 * output. This keeps the rendered CSS friendly to git diffs and CDN
 * caching.
 */

import type { DesignTokens } from "./types.js";

/**
 * Sort entries by key — produces a stable, alphabetised output that
 * keeps the rendered CSS deterministic across runs.
 */
function sortedEntries(record: Record<string, string>): Array<[string, string]> {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function renderBlock(
  selector: string,
  prefix: string,
  records: Record<string, string>,
): string {
  const entries = sortedEntries(records);
  if (entries.length === 0) return `${selector} {\n}`;
  const lines = entries.map(
    ([key, value]) => `  --${prefix}${key}: ${value};`,
  );
  return `${selector} {\n${lines.join("\n")}\n}`;
}

export function tokensToCssVariables(tokens: DesignTokens): {
  light: string;
  dark: string;
} {
  // Sidebar tokens are namespaced (`--sidebar-*`) so they don't
  // collide with the neutral palette when both share a key (e.g.
  // both have a "border-default"-like role). The neutral palette
  // stays un-prefixed because it's the default surface contract.
  const lightSections = [
    renderBlock(":root", "", tokens.colors.light),
    renderBlock(":root", "sidebar-", tokens.sidebar.light),
  ];
  const darkSections = [
    renderBlock(".dark", "", tokens.colors.dark),
    renderBlock(".dark", "sidebar-", tokens.sidebar.dark),
  ];
  return {
    light: lightSections.join("\n\n"),
    dark: darkSections.join("\n\n"),
  };
}

/**
 * Tailwind v4-compatible theme extension. The shape mirrors the
 * structure the consumer would `@theme` in:
 *
 *   {
 *     colors: { 'text-primary': { DEFAULT: '#18181B', dark: '#FAFAFA' }, … },
 *     sidebar: { 'sidebar-bg': { DEFAULT: '#FAFAFA', dark: '#0F1115' }, … }
 *   }
 *
 * Per-token `{ DEFAULT, dark }` keeps both modes in the same object —
 * the consumer can then plug it into Tailwind's `theme.extend.colors`
 * with whatever dark-mode strategy they prefer.
 */
export function tokensToTailwindConfig(
  tokens: DesignTokens,
): Record<string, unknown> {
  const merge = (
    light: Record<string, string>,
    dark: Record<string, string>,
  ): Record<string, { DEFAULT?: string; dark?: string }> => {
    const out: Record<string, { DEFAULT?: string; dark?: string }> = {};
    const keys = new Set<string>([...Object.keys(light), ...Object.keys(dark)]);
    const ordered = [...keys].sort();
    for (const key of ordered) {
      const entry: { DEFAULT?: string; dark?: string } = {};
      if (light[key]) entry.DEFAULT = light[key];
      if (dark[key]) entry.dark = dark[key];
      out[key] = entry;
    }
    return out;
  };

  return {
    colors: merge(tokens.colors.light, tokens.colors.dark),
    sidebar: merge(tokens.sidebar.light, tokens.sidebar.dark),
    meta: {
      name: tokens.meta.name,
      ...(tokens.meta.category !== undefined && {
        category: tokens.meta.category,
      }),
    },
  };
}
