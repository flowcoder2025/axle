# `@axle/core-design-md`

DESIGN.md → design tokens loader for the AXLE meta-platform's
`core-design-md` PBC slot (PRD §4 L2-B1).

The package converts a Markdown design spec (the §2 Color Palette
tables) into a structured `DesignTokens` record and renders it as
CSS variables or a Tailwind v4 `@theme` extension.

**Scope (WI-613, minimal-viable):** Neutral Scale + Sidebar tables
only. Typography / spacing / motion / radius / shadow tokens are
follow-up WIs.

## Public API

- `parseDesignMd(source: string): DesignTokens` — extract tokens from a Markdown string.
- `loadDesignTokens(filePath: string): Promise<DesignTokens>` — Node fs-backed wrapper.
- `tokensToCssVariables(tokens): { light: string; dark: string }` — `:root` + `.dark` CSS blocks.
- `tokensToTailwindConfig(tokens): Record<string, unknown>` — Tailwind v4 theme extension.
- `DesignTokens` — public type.

## Usage

### 1. Load tokens + render CSS variables

```ts
import {
  loadDesignTokens,
  tokensToCssVariables,
} from "@axle/core-design-md";

const tokens = await loadDesignTokens(
  "docs/specs/meta-platform/themes/flowcoder-default.design.md",
);
const css = tokensToCssVariables(tokens);

// css.light:
// :root {
//   --background-base: #FFFFFF;
//   --border-default:  #E4E4E7;
//   --text-primary:    #18181B;
//   ...
// }
//
// css.dark:
// .dark {
//   --background-base: #0C0E12;
//   ...
// }

// Drop into globals.css at build time:
// import { css } from './path/to/loader';
// await writeFile('app/globals.css', `${css.light}\n\n${css.dark}\n`);
```

### 2. Use as a Tailwind v4 theme extension

```ts
import { loadDesignTokens, tokensToTailwindConfig } from "@axle/core-design-md";

const tokens = await loadDesignTokens(
  "docs/specs/meta-platform/themes/flowcoder-default.design.md",
);
const theme = tokensToTailwindConfig(tokens);

// theme.colors:
// {
//   'text-primary':   { DEFAULT: '#18181B', dark: '#FAFAFA' },
//   'border-default': { DEFAULT: '#E4E4E7', dark: '#373B43' },
//   ...
// }

export default {
  theme: { extend: theme },
};
```

## Design decisions

- **No markdown library dependency.** Regex-only table parsing keeps
  the package zero-runtime-dependency and Edge-runtime-safe. Trade-off:
  only the Neutral Scale + Sidebar table groups are read; everything
  else is silently ignored.
- **Robustness first.** Empty input → empty tokens (no throw).
  Malformed table → skip the row (no throw). The loader is meant to run
  unattended during Pack install, so a typo in one row must not break
  every other token.
- **Deterministic output.** Both renderers sort keys alphabetically so
  two parses produce byte-identical output (git-friendly).
- **Token key convention.** Role labels are normalised to kebab-case
  (`"Text Primary"` → `text-primary`, `"Sidebar Active BG"` →
  `sidebar-active-bg`).
- **Sidebar prefix.** CSS variables for sidebar tokens are namespaced
  with `--sidebar-` so they coexist with the neutral palette without
  collision.

## Skipped rows

Rows whose Light / Dark column doesn't contain a hex literal are
silently skipped. That includes:

- `rgba(accent, 0.1) | rgba(accent, 0.15)` — alpha overlays
- `accent | accent` — references to another role
- Plain prose / blank cells

Consumers that need these computed values must resolve them
themselves (the accent base lives outside the parsed surface).
