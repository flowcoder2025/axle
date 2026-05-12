/**
 * `apps/web` design-token helper — WI-613 시범 적용.
 *
 * Wraps `@axle/core-design-md` so a Server Component (or a build-time
 * script) can resolve the FlowCoder default theme without dragging
 * the loader call site into UI code. The actual globals.css injection
 * is a follow-up — this WI ships only the resolution path so the
 * loader is wired end-to-end.
 *
 * Usage:
 *   import { resolveDefaultDesignTokens } from '@/src/lib/design-tokens';
 *   const tokens = await resolveDefaultDesignTokens();
 *   // tokens.colors.light['text-primary'] === '#18181B'
 */

import { resolve } from "node:path";
import {
  loadDesignTokens,
  tokensToCssVariables,
  tokensToTailwindConfig,
  type DesignTokens,
} from "@axle/core-design-md";

/** Default theme shipped with the meta-platform (PRD §4 L2-B1). */
export const DEFAULT_THEME_PATH =
  "docs/specs/meta-platform/themes/flowcoder-default.design.md";

/**
 * Resolve the default DESIGN.md relative to the monorepo root. The
 * web app is launched from `apps/web/` in `next dev` / `next build`,
 * so we walk up to the repo root before resolving the theme path.
 */
function resolveThemePath(themePath: string): string {
  // Monorepo layout: <root>/apps/web/<process.cwd>. Walking up two
  // levels lands at the workspace root regardless of where the
  // command was launched (turbo runs each workspace in its own cwd).
  return resolve(process.cwd(), "..", "..", themePath);
}

export async function resolveDefaultDesignTokens(): Promise<DesignTokens> {
  return loadDesignTokens(resolveThemePath(DEFAULT_THEME_PATH));
}

export async function resolveDefaultDesignTokensAsCss(): Promise<{
  light: string;
  dark: string;
}> {
  const tokens = await resolveDefaultDesignTokens();
  return tokensToCssVariables(tokens);
}

export async function resolveDefaultDesignTokensAsTailwind(): Promise<
  Record<string, unknown>
> {
  const tokens = await resolveDefaultDesignTokens();
  return tokensToTailwindConfig(tokens);
}
