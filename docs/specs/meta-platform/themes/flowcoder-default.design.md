# Design System: FlowCoder Default

> Category: Meta-Platform Baseline
> Multi-domain SaaS canvas. Korean-first typography, dark-default with light mode, Zinc neutral with deep blue accent. Calm density, data-friendly, designed to host any domain (consulting / content / HR / ERP) without visual conflict.

---

## 1. Visual Theme & Atmosphere

FlowCoder's design language is the visual contract of a meta-platform: it must hold its breath while a dozen different SaaS products run on top of it. Where Vercel's identity is "code minified for production," FlowCoder's is "the canvas that disappears so the domain can speak." Surfaces are deliberately understated — Zinc-derived neutrals, soft elevation, and a single deep-blue accent that points without shouting. The system defaults to dark because most operators spend hours in the platform; light mode exists for marketing pages, daytime data review, and brand override scenarios.

The Korean-first typography sets FlowCoder apart from Western dev-tool inspirations. Pretendard Variable carries Korean text with the same geometric clarity as Geist gives Latin alphabets, and the two are paired without conflict — Pretendard for primary copy, Geist for English UI labels and code-adjacent moments. Numbers always use Geist's tabular figures so financial tables, KPI cards, and reports stay vertically aligned. The voice is professional but warm: this is the platform a consulting team uses every day, not a marketing landing page.

Spatial rhythm is built around an 8px grid with deliberate denser sub-grid (4px) for inline UI. Shadows are layered the Vercel way — `0 0 0 1px` border-shadow combined with soft elevation — so cards float without harsh outlines. Radius is a uniform 8px (`0.5rem`) at the component level; at the surface level (cards, modals) we lean slightly larger (12px) to feel more permissive. The accent blue appears at most twice per screen — once as the primary action, once as the active sidebar link — preserving its semantic weight.

**Key Characteristics:**
- **Dark-default + Light variant**: Two complete token sets. Dark is DeeVid-tinted (`#0C0E12`), light is cool Zinc (`#FAFAFA`). Apps choose per route group; users can override.
- **Pretendard Variable + Geist + Geist Mono**: Korean text first, Latin secondary, monospace for code/IDs/tabular numbers. `"liga"` and `"tnum"` opentype features enabled globally.
- **Single accent discipline**: Deep blue (`#2563EB` light / `#3CA2F6` dark). Used at most twice per screen — primary CTA + active nav state.
- **Surface tokens layered**: `--bg-base` < `--surface` < `--surface-raised`. Cards default to `--surface`, modals to `--surface-raised`, nothing flat-on-flat.
- **Shadow-as-border**: `box-shadow: 0 0 0 1px var(--border-default)` for borders, separate elevation shadow for lift. Two-layer composition.
- **8px grid + 4px sub-grid**: Spacing scale `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`. Sub-grid for inline icons and chip padding only.
- **Radius**: 8px (component) / 12px (surface) / 9999px (badge/pill). No mixing within a region.
- **Density profile**: `comfortable` default. `compact` density modifier available for data-heavy views (tables, journals, dashboards) — reduces vertical padding by 33%.
- **Korean-aware truncation**: Multi-byte text always wraps before truncating. `word-break: keep-all` for nav and titles, `ellipsis` only on single-line table cells.

---

## 2. Color Palette & Roles

### Primary (Brand)
- **FlowCoder Black** (`#18181B` — Zinc-950): Primary text in light mode, dark surface base. Slightly warm vs pure black.
- **Pure White** (`#FFFFFF`): Page background light, button text on dark surfaces.
- **Deep Black** (`#0C0E12`): Dark mode page base. DeeVid-inspired blue tint distinguishes from competitor dark canvases.

### Accent (used sparingly)
- **Accent Blue Light** (`#2563EB` — light mode): Primary action, active link, focus ring base.
- **Accent Blue Dark** (`#3CA2F6` — dark mode): Same role, brightened for dark-canvas legibility.
- **Accent Hover Light** (`#1D4ED8`): hover/active deepening.
- **Accent Hover Dark** (`#2B8DE0`): same role in dark mode.

### Neutral Scale (Zinc)
| Role | Light | Dark | Usage |
|---|---|---|---|
| Text Primary | `#18181B` | `#FAFAFA` | headings, body |
| Text Secondary | `#52525B` | `#A1A1AA` | descriptions, meta |
| Text Muted | `#71717A` | `#71717A` | captions, helper |
| Text Subtle | `#A1A1AA` | `#52525B` | disabled, placeholder |
| Border Default | `#E4E4E7` | `#373B43` | dividers, card edges |
| Border Subtle | `#F4F4F5` | `#1F1F23` | nested separators |
| Background Base | `#FFFFFF` | `#0C0E12` | page canvas |
| Surface | `#FFFFFF` | `#1A1D24` | cards, panels |
| Surface Raised | `#F8F9FA` | `#252830` | modals, popovers |
| Surface Muted | `#F4F4F5` | `#27272A` | inactive sections |

### Semantic
- **Destructive Light** (`#EF4444`): errors, destructive actions
- **Destructive Dark** (`#EF4444`): same (legibility on both)
- **Success Light** (`#16A34A`) / **Dark** (`#22C55E`)
- **Warning Light** (`#D97706`) / **Dark** (`#F59E0B`)
- **Info** (`#3B82F6` / `#60A5FA`): tips, neutral notifications

### Chart Palette (5-step, both modes)
For dashboards and analytics. Sequence prefers categorical perception, not gradient.
- `#3CA2F6` (Accent Blue) — Primary metric
- `#22C55E` (Green) — Success / growth
- `#F59E0B` (Amber) — Warning / midpoint
- `#A78BFA` (Violet) — Secondary metric
- `#F472B6` (Pink) — Tertiary / contrast

### Sidebar (Brand-Override Layer)
The sidebar can be brand-themed independently from main canvas (e.g., AXLE consulting brand uses navy+gold sidebar with default main).

| Role | Light Default | Dark Default | Notes |
|---|---|---|---|
| Sidebar BG | `#FAFAFA` | `#0F1115` | Slightly distinct from main bg |
| Sidebar Foreground | `#18181B` | `#FAFAFA` | Text |
| Sidebar Active BG | rgba(accent, 0.1) | rgba(accent, 0.15) | Active nav highlight |
| Sidebar Active Foreground | accent | accent | Active link text |
| Sidebar Border | `#E4E4E7` | `#1F2127` | Separator from main |

---

## 3. Typography Rules

### Font Family
- **Primary (UI / Body)**: `'Pretendard Variable', 'Geist', system-ui, -apple-system, sans-serif`
- **Latin / English Display**: `'Geist', 'Pretendard Variable', sans-serif`
- **Monospace (Code, IDs, Tabular)**: `'Geist Mono', 'SF Mono', 'JetBrains Mono', ui-monospace, monospace`
- **OpenType features**: `"liga"` enabled globally; `"tnum"` enabled for code, tables, KPI numbers, financial figures.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | Pretendard / Geist | 56px (3.5rem) | 700 | 1.05 | -0.04em | Marketing pages only |
| Page Title | Pretendard / Geist | 32px (2rem) | 700 | 1.2 | -0.025em | Page H1 in app routes |
| Section Heading | Pretendard / Geist | 24px (1.5rem) | 600 | 1.3 | -0.02em | Card group titles |
| Card Title | Pretendard / Geist | 18px (1.125rem) | 600 | 1.4 | -0.01em | Card / panel headings |
| Sub Title | Pretendard / Geist | 16px (1rem) | 600 | 1.5 | normal | Secondary headings |
| Body Large | Pretendard | 16px (1rem) | 400 | 1.6 | normal | Comfortable reading |
| Body | Pretendard | 14px (0.875rem) | 400 | 1.5 | normal | Default UI text |
| Body Strong | Pretendard | 14px (0.875rem) | 500 | 1.5 | normal | Labels, emphasized |
| Caption | Pretendard | 12px (0.75rem) | 400 | 1.4 | normal | Meta, hints |
| Caption Strong | Pretendard | 12px (0.75rem) | 500 | 1.4 | 0.02em | Section labels (uppercase) |
| Button | Pretendard | 14px (0.875rem) | 500 | 1.4 | normal | All button text |
| Button Small | Pretendard | 12px (0.75rem) | 500 | 1.3 | normal | Compact buttons |
| Mono Body | Geist Mono | 13px (0.8125rem) | 400 | 1.5 | normal | Code blocks |
| Mono Inline | Geist Mono | 0.875em | 500 | inherit | normal | Inline `code` |
| KPI Number | Geist | 32px (2rem) | 700 | 1.0 | -0.025em | Big number cards (tnum) |
| Tabular Number | Geist | inherit | 500 | inherit | normal | Tables, currency (tnum) |

### Principles
- **Korean takes priority**: Pretendard Variable comes first in font-stack. Geist is fallback for Latin; en/ko mixed text falls back gracefully.
- **No 800/900 weights**: Weight range is 400–700. Hierarchy comes from size + spacing + color, not weight gymnastics.
- **Letter-spacing tightens with size**: Display -0.04em → Page -0.025em → Card -0.01em → Body normal. No tight tracking on body text (Korean readability).
- **`word-break: keep-all`** on titles and nav; never break mid-word in Korean.
- **Tabular numbers everywhere data is**: KPI cards, tables, financial figures use `font-feature-settings: "tnum"` so columns align.
- **Line height**: Tight (1.0–1.3) for headings/numbers, comfortable (1.5–1.6) for body. Never below 1.0, never above 1.7.

---

## 4. Spacing & Sizing

### Scale (8px grid + 4px sub-grid)
```
0  : 0px        — none
1  : 4px        — sub-grid (icon padding, chip gap)
2  : 8px        — base unit (compact gaps)
3  : 12px       — small (form field gaps)
4  : 16px       — default (card padding inner)
5  : 24px       — medium (card padding outer, section gap)
6  : 32px       — large (page sections)
7  : 48px       — xl (hero spacing)
8  : 64px       — 2xl (marketing sections)
9  : 96px       — 3xl (marketing hero only)
```

### Density Modifier
- **Comfortable (default)**: Card padding 24px, row height 48px, button height 36px.
- **Compact**: Card padding 16px, row height 36px, button height 32px. Use for tables, journals, dashboards with high information density.

### Component Sizes
| Element | Comfortable | Compact |
|---|---|---|
| Button height | 36px | 32px |
| Input height | 40px | 32px |
| Row / list item | 48px | 36px |
| Sidebar width | 240px | 200px |
| Top bar height | 56px | 48px |
| Card padding | 24px | 16px |
| Modal max width | 560px | 480px |

### Container Widths
- **Narrow (forms)**: 480px max
- **Standard (app content)**: 1200px max
- **Wide (dashboards)**: 1440px max
- **Full**: 100% with 24px page gutter

---

## 5. Layout

### App Shell Pattern (CRITICAL — used by all domain apps)

```
┌──────────────────────────────────────────────────────────┐
│  Top Bar (56px)                                          │
│  [Brand] [Page Title]              [Search] [Bell] [Avatar] │
├─────────┬────────────────────────────────────────────────┤
│         │                                                │
│ Sidebar │                                                │
│  240px  │           Main Content                         │
│         │                                                │
│  Brand  │           (max-width 1440px)                   │
│  ─────  │                                                │
│  Nav 1  │                                                │
│  Nav 2  │                                                │
│  Nav 3  │                                                │
│         │                                                │
│  ─────  │                                                │
│  User   │                                                │
└─────────┴────────────────────────────────────────────────┘
```

- **Left sidebar**: 240px fixed (200px in compact). Brand mark + 6-12 nav items + user/settings at bottom. Sticky, scrolls only nav middle if overflow.
- **Top bar**: 56px sticky. Brand+page title left, global actions right (search → notifications → user avatar).
- **Main**: Scrolls independently. Page padding 24px (16px on mobile). Max-width by route type.

### Page Patterns
1. **Dashboard**: KPI row (3-4 cards) → primary chart → secondary chart/table. Density: compact.
2. **List/Index**: Filter bar + table or card grid. Pagination at bottom. Density: compact.
3. **Detail**: Header (entity name + status + actions) + tabs + content. Density: comfortable.
4. **Form**: Narrow container (480-720px), grouped sections, sticky save bar at bottom.
5. **Settings**: Two-column (nav left, content right) or single-column with section anchors.
6. **Marketing**: Full-width sections, generous spacing (Density: marketing — separate scale).

### Responsive Breakpoints
- `sm`: 640px — phones rotate / large mobile
- `md`: 768px — tablet
- `lg`: 1024px — laptop (sidebar always visible above this)
- `xl`: 1280px — desktop
- `2xl`: 1536px — wide desktop

Below `lg`: sidebar collapses to drawer (hamburger). Above: always visible.

### Z-Index Scale
- 0–10: Page content layers
- 20: Sticky elements (top bar, sticky save bar)
- 30: Sidebar drawer (mobile)
- 40: Dropdowns, popovers
- 50: Modals, dialogs
- 60: Toasts, notifications

---

## 6. Components

Built on **shadcn/ui New York style** with Zinc base. Customizations specific to FlowCoder default below.

### Buttons
- **Primary**: Solid accent fill, white text, no border. Hover deepens by one shade.
- **Secondary**: Surface bg, default border, text-primary. Hover surface-raised.
- **Ghost**: Transparent, text-primary. Hover: subtle bg (`rgba(text, 0.05)`).
- **Destructive**: Solid destructive fill, white text. Use sparingly.
- **Sizes**: sm (32px), default (36px), lg (40px). Padding `0.75rem` horizontal default.

### Inputs
- Height 40px (32px compact). Rounded 8px. Border-shadow `0 0 0 1px var(--border-default)`.
- Focus: ring 2px accent + outer ring 4px `rgba(accent, 0.15)`.
- Error: border-destructive, helper text below in destructive color.
- Label always above (never floating), 12px caption-strong.

### Cards
- Padding 24px (16px compact). Radius 12px.
- Border: `box-shadow 0 0 0 1px var(--border-default)`.
- Elevation (interactive): adds `0 2px 8px rgba(0,0,0,0.04)` on hover.
- Header / Body / Footer slots; footer has top divider.

### Tables
- Compact density default. Row height 36px. Hover: surface-muted background.
- Header: caption-strong, uppercase, text-secondary. Sticky on vertical scroll.
- Cell padding: 12px horizontal, vertical centered.
- Numeric columns: right-aligned, `tnum` enabled, mono optional.

### Modals / Dialogs
- Surface-raised bg. Radius 12px. Max width 560px.
- Backdrop: `rgba(0, 0, 0, 0.4)` (light), `rgba(0, 0, 0, 0.6)` (dark).
- Header (title + close) → body → footer (actions right-aligned).

### Navigation
- **Sidebar item**: 40px height, 12px horizontal padding, 8px gap icon-text.
- **Active**: Sidebar Active BG + Active Foreground + 3px left bar (accent).
- **Hover**: surface-muted bg, no left bar.
- **Section labels**: caption-strong uppercase, text-muted, 8px top margin.

### Badges / Pills
- Radius: 9999px. Padding `0.125rem 0.5rem`. Font: caption.
- **Default**: surface-muted bg, text-secondary.
- **Status variants**: tinted bg + matching text — success / warning / destructive / info.
- **Outline variant**: transparent bg, 1px border in role color.

### Toasts / Notifications
- Bottom-right anchor. Slide-in animation (250ms ease-out). Auto-dismiss 5s default.
- Icon + title + description + close. Surface-raised bg, role-color left border (4px).

### Empty States
- Centered illustration (or icon ≥ 64px) + heading (sub title) + description (body) + primary CTA.
- Use sparingly — empty states are frequent in early product, must feel intentional not lazy.

### Skeleton / Loading
- Shimmer animation 1.5s linear infinite.
- Light: `bg: rgba(0,0,0,0.04)`, `shimmer: rgba(0,0,0,0.08)`.
- Dark: `bg: rgba(255,255,255,0.06)`, `shimmer: rgba(255,255,255,0.10)`.

---

## 7. Motion

### Principles
- **Calm + purposeful**: animations exist to communicate state change, not to entertain.
- **150–250ms** duration for micro-interactions (hover, click, tab switch).
- **300–400ms** for layout transitions (modal open, drawer slide).
- **Never over 500ms** unless explicitly delight (rare, marketing only).

### Easing
- Default: `cubic-bezier(0.4, 0.0, 0.2, 1)` (ease-in-out, Material's standard)
- Enter: `cubic-bezier(0.0, 0.0, 0.2, 1)` (ease-out, decelerate to rest)
- Exit: `cubic-bezier(0.4, 0.0, 1, 1)` (ease-in, accelerate away)

### Common Patterns
| Element | Property | Duration | Easing |
|---|---|---|---|
| Button hover | bg-color, shadow | 150ms | default |
| Modal open | opacity + transform | 250ms | enter |
| Modal close | opacity + transform | 200ms | exit |
| Tab switch | content fade | 200ms | default |
| Toast in | translateY + opacity | 250ms | enter |
| Toast out | opacity | 200ms | exit |
| Sidebar drawer | translateX | 300ms | default |
| Skeleton shimmer | bg-position | 1500ms | linear, infinite |

### Reduced Motion
Respect `@media (prefers-reduced-motion: reduce)`. Replace transforms with opacity, durations to 0–50ms.

---

## 8. Voice & Tone

### Korean (Primary)
- **존댓말 (정중)** for system messages and confirmations: "저장되었습니다", "삭제하시겠습니까?"
- **명령형 (간결)** for buttons and CTAs: "저장", "취소", "추가하기"
- **설명형 (객관)** for descriptions and help text: "이 항목은 ...에 사용됩니다"
- Avoid emojis in core UI (status badges OK with semantic icons instead).

### English (Secondary, code/dev/marketing contexts)
- Sentence case for buttons and labels ("Save changes", not "Save Changes")
- Title case for page titles only
- Concise, action-oriented: "Create project" not "Create a new project"

### Number / Date Formatting
- Korean dates: `2026.05.04` (default), `2026년 5월 4일` (formal contexts)
- English dates: `May 4, 2026` (US default for international SaaS)
- Numbers: `1,234,567` always with thousands separators, currency symbol before for KRW/USD
- Time: 24-hour for system logs (`14:30`), 12-hour for user-facing (`오후 2:30`)

### Microcopy Rules
- **No marketing language in app routes**: "Boost productivity!" → "Track your work"
- **Errors are specific**: Not "Something went wrong" but "프로젝트를 저장할 수 없습니다 — 네트워크 연결을 확인해 주세요"
- **Empty states have agency**: not "Nothing here yet" but "아직 등록된 고객이 없습니다 — 첫 번째 고객을 추가해 보세요"

---

## 9. Anti-Patterns (NEVER DO)

### Color
- ❌ Pure black (#000000) on pure white — too harsh. Use `#18181B` on `#FFFFFF`.
- ❌ More than two accent uses per screen — dilutes hierarchy.
- ❌ Status colors as decorative accents — only for actual semantic states.
- ❌ Custom hex per component — use tokens only. New token requires DESIGN.md update.

### Typography
- ❌ Mixing more than 2 font families on one screen (Pretendard + Geist Mono is OK; adding a third is not).
- ❌ Font weights below 400 or above 700 — system caps.
- ❌ Letter-spacing on Korean body text — reduces readability.
- ❌ All-caps Korean — Korean has no case. All-caps is for English labels only.

### Layout
- ❌ Floating elements without anchors (centered popovers without trigger relation).
- ❌ Off-grid spacing — every spacing value comes from the scale.
- ❌ Mixing radius within a region (8px button next to 16px card next to 4px input — no).
- ❌ Sidebar inside another sidebar (nested sidebars).

### Components
- ❌ Drop shadows over solid backgrounds — use border-shadow + elevation pair.
- ❌ Border AND box-shadow on the same element — pick one.
- ❌ Custom button styles per page — use system buttons or extend tokens.
- ❌ Rainbow icon sets — single line-icon family (lucide-react default).

### Motion
- ❌ Bouncy / overshoot easings on UI (`cubic-bezier(.68, -.55, .27, 1.55)` etc) — feels juvenile.
- ❌ Animations over 500ms on UI elements.
- ❌ Auto-playing video / parallax in app routes.
- ❌ Loading spinners that aren't skeletons or progress bars (spinners hide progress).

### Voice
- ❌ Marketing exclamations in app routes ("Awesome!", "🎉").
- ❌ "Oops!" or "Sorry!" in errors — be specific and actionable instead.
- ❌ Untranslated English in Korean primary contexts (mixing "Save" with "저장" inconsistently).

---

## Token Reference (Implementation)

### CSS Custom Properties (HSL for shadcn compat)

**Light mode (`:root`)**
```css
--background: 0 0% 100%;
--foreground: 240 10% 3.9%;
--surface: 0 0% 100%;
--surface-raised: 220 14% 97%;
--surface-muted: 240 5% 96%;
--card: 0 0% 100%;
--card-foreground: 240 10% 3.9%;
--popover: 220 14% 97%;
--popover-foreground: 240 10% 3.9%;
--primary: 217 91% 53%;          /* #2563EB */
--primary-foreground: 0 0% 100%;
--secondary: 240 5% 96%;
--secondary-foreground: 240 6% 10%;
--muted: 240 5% 96%;
--muted-foreground: 240 4% 46%;
--accent: 217 91% 53%;
--accent-foreground: 0 0% 100%;
--destructive: 0 84% 60%;
--destructive-foreground: 0 0% 100%;
--success: 142 71% 38%;
--warning: 32 94% 44%;
--info: 217 91% 60%;
--border: 240 6% 90%;
--input: 240 6% 90%;
--ring: 217 91% 53%;
--radius: 0.5rem;
--font-sans: 'Pretendard Variable', 'Geist', system-ui, sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', ui-monospace, monospace;
```

**Dark mode (`.dark`)**
```css
--background: 220 18% 6%;        /* #0C0E12 */
--foreground: 0 0% 98%;
--surface: 220 14% 12%;          /* #1A1D24 */
--surface-raised: 220 11% 17%;   /* #252830 */
--surface-muted: 240 6% 15%;
--card: 220 14% 12%;
--card-foreground: 0 0% 98%;
--popover: 220 11% 17%;
--popover-foreground: 0 0% 98%;
--primary: 211 91% 60%;          /* #3CA2F6 */
--primary-foreground: 220 18% 6%;
--secondary: 240 4% 15%;
--secondary-foreground: 0 0% 98%;
--muted: 240 4% 15%;
--muted-foreground: 240 5% 65%;
--accent: 211 91% 60%;
--accent-foreground: 220 18% 6%;
--destructive: 0 84% 60%;
--destructive-foreground: 0 0% 98%;
--success: 142 71% 45%;
--warning: 38 92% 50%;
--info: 213 94% 68%;
--border: 217 13% 23%;           /* #373B43 */
--input: 217 13% 23%;
--ring: 211 91% 60%;
```

### Tailwind Plug-in (Implementation Hint)
Project uses Tailwind CSS 4 with `@theme inline` directive. Token consumption:
```css
@theme inline {
  --color-background: hsl(var(--background));
  --color-primary: hsl(var(--primary));
  /* ...etc */
}
```

---

## How AI Coding Agents Use This File

When this `DESIGN.md` is the active design system (referenced via project root or skill injection):

1. **Color choices**: Use only token names from §2 (Color Palette). Hex values are reference; reach via `var(--token)` or Tailwind `bg-primary` etc.
2. **Typography**: Match role from §3 hierarchy table. Don't invent new sizes.
3. **Layout**: Follow §5 App Shell unless brief explicitly says otherwise (e.g., marketing page).
4. **Components**: Use shadcn/ui (already installed) with §6 customizations. Don't re-style buttons per page.
5. **Anti-patterns** (§9) trump everything else — even if the brief asks for a banned pattern, propose alternative first.
6. **Voice** (§8) controls all user-facing copy in app routes.

If the brief contradicts this DESIGN.md (e.g., "make it look like Apple" while FlowCoder default is the active spec), the agent must:
- Either: Generate using FlowCoder defaults and note the deviation request
- Or: Switch to a different DESIGN.md (e.g., load `apple.design.md` from open-design's bundled systems)
- Never: silently mix two design languages in one output.

---

## Provenance

- Synthesized from FlowStudio v2 (`docs/L1-domain/design-system.md`) + AXLE (`packages/ui/src/globals.css`)
- Format: open-design 9-section DESIGN.md (compatible with [getdesign.md](https://getdesign.md/) collection)
- Inspirations: Vercel (shadow-as-border, restraint), Linear (sidebar pattern, density), DeeVid (dark canvas tint)
- Korean-specific additions: Pretendard primary, `word-break: keep-all`, KO/EN tone separation

## Versioning

- v1.0.0 (2026-05-04) — Initial baseline. Synthesized from existing FlowCoder assets.
- Subsequent themes (axle-consulting, flowstudio-modern, white-label-N) derive from this baseline by overriding §2 Color Palette + optionally §1 Visual Theme + §6 Components.
