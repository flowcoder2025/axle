/**
 * HTML renderer (WI-503).
 *
 * Implements `RenderOutput === "html"` for all 23 blocks defined in
 * `src/blocks/`. The renderer is intentionally framework-free — it returns a
 * plain string per block so consumers (Next.js apps, static-site exporters,
 * and the FlowStudio v2 migration in WI-509) can drop the markup straight
 * into a server-rendered template without a React/JSX dependency.
 *
 * Two safety invariants drive the design:
 *
 *   1. **Schema-first**: every render call validates the payload through the
 *      block's zod schema before producing markup. Invalid data throws a
 *      descriptive error rather than silently emitting partial HTML — the
 *      AI copy pipeline (WI-507) and the FlowStudio migration both rely on
 *      this contract to surface bad payloads at composition time.
 *
 *   2. **Always escape user text**: every interpolated string passes through
 *      `escapeHtml`. Block schemas accept arbitrary strings, so any field
 *      could carry XSS payloads if a downstream consumer renders the HTML
 *      into a browser context (admin previews, server components, exported
 *      static pages).
 *
 * Wrapper-class convention: `pbc-block pbc-{id} pbc-{id}--{variant}`. The
 * single-letter category root + numeric suffix matches the FlowStudio v2
 * existing CSS hooks so the migration in WI-509 can re-skin without diff
 * churn. The `data-block-id` attribute is for runtime diagnostics (e.g.
 * builder UIs that need to map a clicked element back to the source block).
 */

import { ZodError } from "zod";
import { BLOCKS } from "../blocks/index.js";
import type {
  BlockId,
  RenderContext,
  RenderResult,
} from "../types.js";

/* ------------------------------------------------------------------ */
/* Public utilities                                                    */
/* ------------------------------------------------------------------ */

/**
 * Escapes the five HTML metacharacters. `null` / `undefined` collapse to an
 * empty string so optional schema fields never produce the literal text
 * `"undefined"` in the output. Numbers are coerced to strings.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a single block to HTML. Validates `data` through the block's zod
 * schema first, then dispatches to the per-block renderer.
 *
 * Throws when:
 *   - the block id is not registered (typo / WI-509 leftover)
 *   - the schema rejects `data` (invalid composition payload)
 */
export function renderBlockHtml(
  blockId: BlockId,
  data: unknown,
  context: RenderContext,
): RenderResult<string> {
  const def = BLOCKS[blockId];
  if (!def) {
    throw new Error(`renderBlockHtml: unknown block id '${blockId}'`);
  }

  let parsed: unknown;
  try {
    parsed = def.schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const fields = err.issues
        .map((issue) => issue.path.join(".") || "(root)")
        .join(", ");
      throw new Error(
        `renderBlockHtml: ${blockId} payload failed validation — invalid fields: ${fields}`,
      );
    }
    throw err;
  }

  const renderer = HTML_RENDERERS[blockId];
  if (!renderer) {
    // Indicates a registry/renderer drift — every entry in BLOCKS must have
    // a matching HTML renderer once WI-503 is merged.
    throw new Error(`renderBlockHtml: no HTML renderer registered for ${blockId}`);
  }

  const variant = readVariant(context);
  const inner = renderer(parsed, context);
  const content = wrapBlock(blockId, variant, inner);

  return {
    content,
    metadata: {
      blockId,
      output: "html",
      variant: variant ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Wrapper + helpers                                                   */
/* ------------------------------------------------------------------ */

function readVariant(context: RenderContext): string | undefined {
  const v = context.metadata?.variant;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function wrapBlock(id: BlockId, variant: string | undefined, inner: string): string {
  const classes = ["pbc-block", `pbc-${id}`];
  if (variant) classes.push(`pbc-${id}--${variant}`);
  return `<section class="${classes.join(" ")}" data-block-id="${id}">${inner}</section>`;
}

function attr(name: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${name}="${escapeHtml(value)}"`;
}

function maybe<T>(value: T | undefined | null, render: (v: T) => string): string {
  return value === undefined || value === null ? "" : render(value);
}

/* ------------------------------------------------------------------ */
/* Per-block renderers                                                 */
/*                                                                     */
/* Each renderer accepts the schema-validated payload (typed `unknown`  */
/* because the registry erases the per-block schema generic) and the    */
/* render context. They return the inner HTML — the wrapper section is  */
/* applied centrally in `renderBlockHtml`.                              */
/* ------------------------------------------------------------------ */

type HtmlRenderer = (data: unknown, context: RenderContext) => string;

// --- A: Opening -----------------------------------------------------

const renderA1: HtmlRenderer = (raw) => {
  const data = raw as {
    headline: string;
    tagline?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaHref?: string;
  };
  const style = data.backgroundImage
    ? ` style="background-image:url('${escapeHtml(data.backgroundImage)}')"`
    : "";
  return [
    `<div class="pbc-A1__inner"${style}>`,
    `<h1 class="pbc-A1__headline">${escapeHtml(data.headline)}</h1>`,
    maybe(data.tagline, (t) => `<p class="pbc-A1__tagline">${escapeHtml(t)}</p>`),
    data.ctaText && data.ctaHref
      ? `<a class="pbc-A1__cta" href="${escapeHtml(data.ctaHref)}">${escapeHtml(data.ctaText)}</a>`
      : "",
    `</div>`,
  ].join("");
};

const renderA2: HtmlRenderer = (raw) => {
  const data = raw as { line: string; backgroundColor?: string; accent?: string };
  const styles: string[] = [];
  if (data.backgroundColor) styles.push(`background-color:${escapeHtml(data.backgroundColor)}`);
  if (data.accent) styles.push(`color:${escapeHtml(data.accent)}`);
  const style = styles.length ? ` style="${styles.join(";")}"` : "";
  return `<p class="pbc-A2__line"${style}>${escapeHtml(data.line)}</p>`;
};

const renderA3: HtmlRenderer = (raw) => {
  const data = raw as { points: string[]; intro?: string };
  const items = data.points
    .map((p) => `<li class="pbc-A3__point">${escapeHtml(p)}</li>`)
    .join("");
  return [
    maybe(data.intro, (i) => `<p class="pbc-A3__intro">${escapeHtml(i)}</p>`),
    `<ul class="pbc-A3__list">${items}</ul>`,
  ].join("");
};

// --- B: Core Value --------------------------------------------------

const renderB1: HtmlRenderer = (raw) => {
  const data = raw as {
    items: Array<{ title: string; description: string; icon?: string; imageSrc?: string }>;
  };
  const cards = data.items
    .map((item) => {
      const media = item.imageSrc
        ? `<img class="pbc-B1__image" src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.title)}">`
        : item.icon
          ? `<span class="pbc-B1__icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
          : "";
      return [
        `<li class="pbc-B1__item">`,
        media,
        `<h3 class="pbc-B1__title">${escapeHtml(item.title)}</h3>`,
        `<p class="pbc-B1__desc">${escapeHtml(item.description)}</p>`,
        `</li>`,
      ].join("");
    })
    .join("");
  return `<ul class="pbc-B1__list">${cards}</ul>`;
};

const renderB2: HtmlRenderer = (raw) => {
  const data = raw as {
    before: { label: string; imageSrc?: string; note?: string };
    after: { label: string; imageSrc?: string; note?: string };
    caption?: string;
  };
  const side = (kind: "before" | "after", v: { label: string; imageSrc?: string; note?: string }) =>
    [
      `<figure class="pbc-B2__${kind}">`,
      v.imageSrc
        ? `<img src="${escapeHtml(v.imageSrc)}" alt="${escapeHtml(v.label)}">`
        : "",
      `<figcaption><strong>${escapeHtml(v.label)}</strong>${maybe(v.note, (n) => ` <span>${escapeHtml(n)}</span>`)}</figcaption>`,
      `</figure>`,
    ].join("");
  return [
    `<div class="pbc-B2__pair">`,
    side("before", data.before),
    side("after", data.after),
    `</div>`,
    maybe(data.caption, (c) => `<p class="pbc-B2__caption">${escapeHtml(c)}</p>`),
  ].join("");
};

const renderB3: HtmlRenderer = (raw) => {
  const data = raw as {
    name: string;
    description: string;
    properties?: Array<{ label: string; value: string }>;
    imageSrc?: string;
  };
  const props = data.properties?.length
    ? `<dl class="pbc-B3__props">${data.properties
        .map(
          (p) =>
            `<dt>${escapeHtml(p.label)}</dt><dd>${escapeHtml(p.value)}</dd>`,
        )
        .join("")}</dl>`
    : "";
  return [
    data.imageSrc
      ? `<img class="pbc-B3__image" src="${escapeHtml(data.imageSrc)}" alt="${escapeHtml(data.name)}">`
      : "",
    `<h3 class="pbc-B3__name">${escapeHtml(data.name)}</h3>`,
    `<p class="pbc-B3__desc">${escapeHtml(data.description)}</p>`,
    props,
  ].join("");
};

const renderB4: HtmlRenderer = (raw) => {
  const data = raw as {
    imageSrc: string;
    callouts?: Array<{ label: string; x?: number; y?: number }>;
    headline?: string;
  };
  const callouts = data.callouts?.length
    ? `<ul class="pbc-B4__callouts">${data.callouts
        .map((c) => {
          const styleParts: string[] = [];
          if (typeof c.x === "number") styleParts.push(`left:${c.x}%`);
          if (typeof c.y === "number") styleParts.push(`top:${c.y}%`);
          const style = styleParts.length ? ` style="${styleParts.join(";")}"` : "";
          return `<li class="pbc-B4__callout"${style}>${escapeHtml(c.label)}</li>`;
        })
        .join("")}</ul>`
    : "";
  return [
    `<figure class="pbc-B4__figure">`,
    `<img src="${escapeHtml(data.imageSrc)}"${attr("alt", data.headline ?? "USP")}>`,
    callouts,
    maybe(data.headline, (h) => `<figcaption class="pbc-B4__headline">${escapeHtml(h)}</figcaption>`),
    `</figure>`,
  ].join("");
};

// --- C: Trust -------------------------------------------------------

const renderC1: HtmlRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; issuer?: string; year?: number; imageSrc?: string }>;
  };
  const items = data.items
    .map((item) => {
      const meta = [item.issuer, item.year].filter(Boolean).map((v) => escapeHtml(v)).join(" · ");
      return [
        `<li class="pbc-C1__item">`,
        item.imageSrc
          ? `<img src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.name)}">`
          : "",
        `<span class="pbc-C1__name">${escapeHtml(item.name)}</span>`,
        meta ? `<span class="pbc-C1__meta">${meta}</span>` : "",
        `</li>`,
      ].join("");
    })
    .join("");
  return `<ul class="pbc-C1__list">${items}</ul>`;
};

const renderC2: HtmlRenderer = (raw) => {
  const data = raw as {
    summary?: { averageRating: number; totalCount: number };
    reviews: Array<{
      rating: number;
      quote: string;
      author: string;
      date?: string;
      source?: string;
    }>;
  };
  const summary = data.summary
    ? `<p class="pbc-C2__summary">${escapeHtml(data.summary.averageRating.toFixed(1))} / 5 (${escapeHtml(String(data.summary.totalCount))})</p>`
    : "";
  const reviews = data.reviews
    .map((r) => {
      const meta = [r.author, r.date, r.source]
        .filter(Boolean)
        .map((v) => escapeHtml(v))
        .join(" · ");
      return [
        `<li class="pbc-C2__review">`,
        `<div class="pbc-C2__rating" aria-label="${escapeHtml(`${r.rating} of 5`)}">${escapeHtml(r.rating.toString())}</div>`,
        `<blockquote class="pbc-C2__quote">${escapeHtml(r.quote)}</blockquote>`,
        `<cite class="pbc-C2__cite">${meta}</cite>`,
        `</li>`,
      ].join("");
    })
    .join("");
  return [summary, `<ul class="pbc-C2__list">${reviews}</ul>`].join("");
};

const renderC3: HtmlRenderer = (raw) => {
  const data = raw as {
    items: Array<{
      outlet: string;
      title?: string;
      url?: string;
      logoSrc?: string;
      publishedAt?: string;
    }>;
  };
  const items = data.items
    .map((item) => {
      const inner = [
        item.logoSrc
          ? `<img src="${escapeHtml(item.logoSrc)}" alt="${escapeHtml(item.outlet)}">`
          : "",
        `<span class="pbc-C3__outlet">${escapeHtml(item.outlet)}</span>`,
        maybe(item.title, (t) => `<span class="pbc-C3__title">${escapeHtml(t)}</span>`),
        maybe(item.publishedAt, (d) => `<time class="pbc-C3__date">${escapeHtml(d)}</time>`),
      ].join("");
      return item.url
        ? `<li class="pbc-C3__item"><a href="${escapeHtml(item.url)}">${inner}</a></li>`
        : `<li class="pbc-C3__item">${inner}</li>`;
    })
    .join("");
  return `<ul class="pbc-C3__list">${items}</ul>`;
};

const renderC4: HtmlRenderer = (raw) => {
  const data = raw as {
    headline: string;
    body: string;
    founderName?: string;
    founderImage?: string;
    timeline?: Array<{ year: number; label: string }>;
  };
  const timeline = data.timeline?.length
    ? `<ol class="pbc-C4__timeline">${data.timeline
        .map(
          (t) =>
            `<li><time>${escapeHtml(String(t.year))}</time><span>${escapeHtml(t.label)}</span></li>`,
        )
        .join("")}</ol>`
    : "";
  const founder =
    data.founderName || data.founderImage
      ? `<figure class="pbc-C4__founder">${
          data.founderImage
            ? `<img src="${escapeHtml(data.founderImage)}" alt="${escapeHtml(data.founderName ?? "")}">`
            : ""
        }${maybe(data.founderName, (n) => `<figcaption>${escapeHtml(n)}</figcaption>`)}</figure>`
      : "";
  return [
    `<h2 class="pbc-C4__headline">${escapeHtml(data.headline)}</h2>`,
    `<div class="pbc-C4__body">${escapeHtml(data.body)}</div>`,
    founder,
    timeline,
  ].join("");
};

const renderC5: HtmlRenderer = (raw) => {
  const data = raw as {
    items: Array<{ label: string; value: string; unit?: string; context?: string }>;
  };
  const items = data.items
    .map((item) =>
      [
        `<li class="pbc-C5__item">`,
        `<span class="pbc-C5__value">${escapeHtml(item.value)}${maybe(item.unit, (u) => `<small>${escapeHtml(u)}</small>`)}</span>`,
        `<span class="pbc-C5__label">${escapeHtml(item.label)}</span>`,
        maybe(item.context, (c) => `<span class="pbc-C5__context">${escapeHtml(c)}</span>`),
        `</li>`,
      ].join(""),
    )
    .join("");
  return `<ul class="pbc-C5__list">${items}</ul>`;
};

// --- D: Detail ------------------------------------------------------

const renderD1: HtmlRenderer = (raw) => {
  const data = raw as {
    rows: Array<{ label: string; value: string }>;
    title?: string;
  };
  const caption = data.title
    ? `<caption>${escapeHtml(data.title)}</caption>`
    : "";
  const rows = data.rows
    .map(
      (r) =>
        `<tr><th scope="row">${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");
  return `<table class="pbc-D1__table">${caption}<tbody>${rows}</tbody></table>`;
};

const renderD2: HtmlRenderer = (raw) => {
  const data = raw as {
    steps: Array<{ title: string; description?: string; imageSrc?: string }>;
    videoUrl?: string;
  };
  const steps = data.steps
    .map(
      (s) =>
        `<li class="pbc-D2__step">${
          s.imageSrc ? `<img src="${escapeHtml(s.imageSrc)}" alt="${escapeHtml(s.title)}">` : ""
        }<h4>${escapeHtml(s.title)}</h4>${maybe(s.description, (d) => `<p>${escapeHtml(d)}</p>`)}</li>`,
    )
    .join("");
  const video = data.videoUrl
    ? `<a class="pbc-D2__video" href="${escapeHtml(data.videoUrl)}">▶︎ Video</a>`
    : "";
  return [`<ol class="pbc-D2__steps">${steps}</ol>`, video].join("");
};

const renderD3: HtmlRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; quantity?: number; imageSrc?: string; note?: string }>;
  };
  const items = data.items
    .map((item) =>
      [
        `<li class="pbc-D3__item">`,
        item.imageSrc
          ? `<img src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.name)}">`
          : "",
        `<span class="pbc-D3__name">${escapeHtml(item.name)}</span>`,
        typeof item.quantity === "number"
          ? `<span class="pbc-D3__qty">×${escapeHtml(String(item.quantity))}</span>`
          : "",
        maybe(item.note, (n) => `<span class="pbc-D3__note">${escapeHtml(n)}</span>`),
        `</li>`,
      ].join(""),
    )
    .join("");
  return `<ul class="pbc-D3__list">${items}</ul>`;
};

const renderD4: HtmlRenderer = (raw) => {
  const data = raw as {
    chart: { headers: string[]; rows: string[][] };
    note?: string;
    realWearImages?: string[];
  };
  const headers = `<tr>${data.chart.headers
    .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
    .join("")}</tr>`;
  const rows = data.chart.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  const realWear = data.realWearImages?.length
    ? `<div class="pbc-D4__real-wear">${data.realWearImages
        .map((src) => `<img src="${escapeHtml(src)}" alt="">`)
        .join("")}</div>`
    : "";
  return [
    `<table class="pbc-D4__chart"><thead>${headers}</thead><tbody>${rows}</tbody></table>`,
    maybe(data.note, (n) => `<p class="pbc-D4__note">${escapeHtml(n)}</p>`),
    realWear,
  ].join("");
};

// --- E: Conversion --------------------------------------------------

const renderE1: HtmlRenderer = (raw) => {
  const data = raw as {
    price: string;
    originalPrice?: string;
    ctaText: string;
    ctaHref: string;
    urgencyText?: string;
  };
  return [
    `<div class="pbc-E1__price-block">`,
    maybe(data.originalPrice, (p) => `<span class="pbc-E1__original">${escapeHtml(p)}</span>`),
    `<span class="pbc-E1__price">${escapeHtml(data.price)}</span>`,
    `</div>`,
    maybe(data.urgencyText, (u) => `<p class="pbc-E1__urgency">${escapeHtml(u)}</p>`),
    `<a class="pbc-E1__cta" href="${escapeHtml(data.ctaHref)}">${escapeHtml(data.ctaText)}</a>`,
  ].join("");
};

const renderE2: HtmlRenderer = (raw) => {
  const data = raw as {
    title: string;
    discount?: string;
    code?: string;
    expiresAt?: string;
    description?: string;
  };
  return [
    `<h3 class="pbc-E2__title">${escapeHtml(data.title)}</h3>`,
    maybe(data.discount, (d) => `<span class="pbc-E2__discount">${escapeHtml(d)}</span>`),
    maybe(data.code, (c) => `<code class="pbc-E2__code">${escapeHtml(c)}</code>`),
    maybe(data.expiresAt, (e) => `<time class="pbc-E2__expiry">~${escapeHtml(e)}</time>`),
    maybe(data.description, (d) => `<p class="pbc-E2__desc">${escapeHtml(d)}</p>`),
  ].join("");
};

const renderE3: HtmlRenderer = (raw) => {
  const data = raw as {
    items: Array<{ question: string; answer: string; category?: string }>;
  };
  const items = data.items
    .map(
      (item) =>
        `<details class="pbc-E3__item"${attr("data-category", item.category)}><summary>${escapeHtml(item.question)}</summary><div class="pbc-E3__answer">${escapeHtml(item.answer)}</div></details>`,
    )
    .join("");
  return `<div class="pbc-E3__list">${items}</div>`;
};

const renderE4: HtmlRenderer = (raw) => {
  const data = raw as {
    shippingNote: string;
    returnNote: string;
    policies?: Array<{ label: string; value: string }>;
  };
  const policies = data.policies?.length
    ? `<dl class="pbc-E4__policies">${data.policies
        .map(
          (p) =>
            `<dt>${escapeHtml(p.label)}</dt><dd>${escapeHtml(p.value)}</dd>`,
        )
        .join("")}</dl>`
    : "";
  return [
    `<div class="pbc-E4__shipping"><strong>Shipping</strong> ${escapeHtml(data.shippingNote)}</div>`,
    `<div class="pbc-E4__return"><strong>Returns</strong> ${escapeHtml(data.returnNote)}</div>`,
    policies,
  ].join("");
};

// --- F: Mood --------------------------------------------------------

const renderF1: HtmlRenderer = (raw) => {
  const data = raw as {
    images: Array<{ src: string; alt?: string }>;
    aspectRatio?: string;
  };
  const style = data.aspectRatio ? ` style="aspect-ratio:${escapeHtml(data.aspectRatio)}"` : "";
  const imgs = data.images
    .map((img) => `<img src="${escapeHtml(img.src)}"${attr("alt", img.alt ?? "")}${style}>`)
    .join("");
  return `<div class="pbc-F1__gallery">${imgs}</div>`;
};

const renderF2: HtmlRenderer = (raw) => {
  const data = raw as {
    options: Array<{
      name: string;
      colorHex?: string;
      imageSrc?: string;
      available?: boolean;
    }>;
  };
  const items = data.options
    .map((opt) => {
      const swatch = opt.colorHex
        ? `<span class="pbc-F2__swatch" style="background-color:${escapeHtml(opt.colorHex)}" aria-hidden="true"></span>`
        : opt.imageSrc
          ? `<img class="pbc-F2__image" src="${escapeHtml(opt.imageSrc)}" alt="${escapeHtml(opt.name)}">`
          : "";
      const unavailable = opt.available === false ? ' data-unavailable="true"' : "";
      return `<li class="pbc-F2__option"${unavailable}>${swatch}<span class="pbc-F2__name">${escapeHtml(opt.name)}</span></li>`;
    })
    .join("");
  return `<ul class="pbc-F2__list">${items}</ul>`;
};

const renderF3: HtmlRenderer = (raw) => {
  const data = raw as { height?: number; label?: string };
  const style = typeof data.height === "number" ? ` style="height:${data.height}px"` : "";
  const inner = data.label
    ? `<span class="pbc-F3__label">${escapeHtml(data.label)}</span>`
    : "";
  return `<hr class="pbc-F3__divider" role="separator"${style}>${inner}`;
};

/* ------------------------------------------------------------------ */
/* Renderer registry                                                   */
/* ------------------------------------------------------------------ */

export const HTML_RENDERERS: Record<string, HtmlRenderer> = {
  A1: renderA1,
  A2: renderA2,
  A3: renderA3,
  B1: renderB1,
  B2: renderB2,
  B3: renderB3,
  B4: renderB4,
  C1: renderC1,
  C2: renderC2,
  C3: renderC3,
  C4: renderC4,
  C5: renderC5,
  D1: renderD1,
  D2: renderD2,
  D3: renderD3,
  D4: renderD4,
  E1: renderE1,
  E2: renderE2,
  E3: renderE3,
  E4: renderE4,
  F1: renderF1,
  F2: renderF2,
  F3: renderF3,
};
