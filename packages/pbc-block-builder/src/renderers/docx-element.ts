/**
 * DOCX-element renderer (WI-506).
 *
 * The fourth output adapter from `pbc-block-builder.md` §3.1. Per the spec
 * §6 Out of Scope ("DOCX element 어댑터의 모든 블록 지원 — 1차는 텍스트/
 * 이미지/리스트만"), the v1 element vocabulary is intentionally tiny:
 *
 *   - `paragraph` — runs of formatted text
 *   - `heading`   — paragraph with a heading level (1..4)
 *   - `list`      — ordered or unordered, items contain runs
 *   - `image`     — src + alt + optional dimensions
 *
 * Blocks that cannot be expressed cleanly with that vocabulary (D1 spec
 * table, D4 size guide, B2 before/after, B4 callouts, F3 divider) degrade
 * to a heading + list of `Label: Value` items rather than emitting an
 * unsupported element type. This keeps the downstream DOCX writer
 * (`docx`, `officegen`, etc.) on a single discriminator at all times.
 *
 * The element model is intentionally framework-free — `@axle/pbc-block-
 * builder` has no DOCX library dependency. Apps that consume this output
 * walk the array and call into their library of choice. A reference
 * walker for the `docx` library will land in WI-510.
 */

import { ZodError } from "zod";
import { BLOCKS } from "../blocks/index.js";
import type {
  BlockId,
  RenderContext,
  RenderResult,
} from "../types.js";

/* ------------------------------------------------------------------ */
/* Element model                                                       */
/* ------------------------------------------------------------------ */

export interface DocxRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface DocxListItem {
  runs: DocxRun[];
}

export type DocxElement =
  | { type: "paragraph"; runs: DocxRun[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4; runs: DocxRun[] }
  | { type: "list"; ordered: boolean; items: DocxListItem[] }
  | { type: "image"; src: string; alt?: string; width?: number; height?: number };

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

export function renderBlockDocxElement(
  blockId: BlockId,
  data: unknown,
  context: RenderContext,
): RenderResult<DocxElement[]> {
  const def = BLOCKS[blockId];
  if (!def) {
    throw new Error(`renderBlockDocxElement: unknown block id '${blockId}'`);
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
        `renderBlockDocxElement: ${blockId} payload failed validation — invalid fields: ${fields}`,
      );
    }
    throw err;
  }

  const renderer = DOCX_RENDERERS[blockId];
  if (!renderer) {
    throw new Error(
      `renderBlockDocxElement: no DOCX renderer registered for ${blockId}`,
    );
  }

  const variant = readVariant(context);
  return {
    content: renderer(parsed, context),
    metadata: {
      blockId,
      output: "docx-element",
      variant: variant ?? null,
    },
  };
}

function readVariant(context: RenderContext): string | undefined {
  const v = context.metadata?.variant;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function p(text: string, format: Partial<Omit<DocxRun, "text">> = {}): DocxElement {
  return { type: "paragraph", runs: [{ text, ...format }] };
}

function pRuns(runs: DocxRun[]): DocxElement {
  return { type: "paragraph", runs };
}

function h(level: 1 | 2 | 3 | 4, text: string): DocxElement {
  return { type: "heading", level, runs: [{ text }] };
}

function bullet(items: string[] | DocxListItem[]): DocxElement {
  return { type: "list", ordered: false, items: normalizeItems(items) };
}

function numbered(items: string[] | DocxListItem[]): DocxElement {
  return { type: "list", ordered: true, items: normalizeItems(items) };
}

function normalizeItems(items: string[] | DocxListItem[]): DocxListItem[] {
  return items.map((it) =>
    typeof it === "string" ? { runs: [{ text: it }] } : it,
  );
}

function image(src: string, alt?: string): DocxElement {
  return alt !== undefined ? { type: "image", src, alt } : { type: "image", src };
}

function labelValue(label: string, value: string): DocxListItem {
  return {
    runs: [
      { text: `${label}: `, bold: true },
      { text: value },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Per-block renderers                                                 */
/* ------------------------------------------------------------------ */

type DocxRenderer = (data: unknown, context: RenderContext) => DocxElement[];

// --- A: Opening -----------------------------------------------------

const renderA1: DocxRenderer = (raw) => {
  const data = raw as {
    headline: string;
    tagline?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaHref?: string;
  };
  const out: DocxElement[] = [];
  if (data.backgroundImage) out.push(image(data.backgroundImage, data.headline));
  out.push(h(1, data.headline));
  if (data.tagline) out.push(p(data.tagline));
  if (data.ctaText && data.ctaHref) {
    out.push(pRuns([{ text: `${data.ctaText} → ${data.ctaHref}`, bold: true }]));
  }
  return out;
};

const renderA2: DocxRenderer = (raw) => {
  const data = raw as { line: string };
  return [h(2, data.line)];
};

const renderA3: DocxRenderer = (raw) => {
  const data = raw as { points: string[]; intro?: string };
  const out: DocxElement[] = [];
  if (data.intro) out.push(p(data.intro));
  out.push(bullet(data.points));
  return out;
};

// --- B: Core Value --------------------------------------------------

const renderB1: DocxRenderer = (raw) => {
  const data = raw as {
    items: Array<{ title: string; description: string; icon?: string; imageSrc?: string }>;
  };
  const out: DocxElement[] = [];
  for (const item of data.items) {
    if (item.imageSrc) out.push(image(item.imageSrc, item.title));
    out.push(pRuns([{ text: item.title, bold: true }]));
    out.push(p(item.description));
  }
  return out;
};

const renderB2: DocxRenderer = (raw) => {
  const data = raw as {
    before: { label: string; imageSrc?: string; note?: string };
    after: { label: string; imageSrc?: string; note?: string };
    caption?: string;
  };
  const side = (kind: "Before" | "After", v: { label: string; imageSrc?: string; note?: string }) => {
    const els: DocxElement[] = [h(3, `${kind}: ${v.label}`)];
    if (v.imageSrc) els.push(image(v.imageSrc, v.label));
    if (v.note) els.push(p(v.note));
    return els;
  };
  const out: DocxElement[] = [...side("Before", data.before), ...side("After", data.after)];
  if (data.caption) out.push(pRuns([{ text: data.caption, italic: true }]));
  return out;
};

const renderB3: DocxRenderer = (raw) => {
  const data = raw as {
    name: string;
    description: string;
    properties?: Array<{ label: string; value: string }>;
    imageSrc?: string;
  };
  const out: DocxElement[] = [];
  if (data.imageSrc) out.push(image(data.imageSrc, data.name));
  out.push(h(3, data.name));
  out.push(p(data.description));
  if (data.properties?.length) {
    out.push(bullet(data.properties.map((pr) => labelValue(pr.label, pr.value))));
  }
  return out;
};

const renderB4: DocxRenderer = (raw) => {
  const data = raw as {
    imageSrc: string;
    callouts?: Array<{ label: string; x?: number; y?: number }>;
    headline?: string;
  };
  const out: DocxElement[] = [image(data.imageSrc, data.headline ?? "USP")];
  if (data.headline) out.push(pRuns([{ text: data.headline, bold: true }]));
  if (data.callouts?.length) {
    out.push(bullet(data.callouts.map((c) => c.label)));
  }
  return out;
};

// --- C: Trust -------------------------------------------------------

const renderC1: DocxRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; issuer?: string; year?: number; imageSrc?: string }>;
  };
  return [
    bullet(
      data.items.map((item) => {
        const meta = [item.issuer, item.year].filter(Boolean).join(" · ");
        const runs: DocxRun[] = [{ text: item.name, bold: true }];
        if (meta) runs.push({ text: ` (${meta})` });
        return { runs };
      }),
    ),
  ];
};

const renderC2: DocxRenderer = (raw) => {
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
  const out: DocxElement[] = [];
  if (data.summary) {
    out.push(
      pRuns([
        {
          text: `${data.summary.averageRating.toFixed(1)} / 5 (${data.summary.totalCount})`,
          bold: true,
        },
      ]),
    );
  }
  for (const r of data.reviews) {
    out.push(pRuns([{ text: `"${r.quote}"`, italic: true }]));
    const meta = [r.author, r.date, r.source].filter(Boolean).join(" · ");
    out.push(p(`— ${meta} (${r.rating}/5)`));
  }
  return out;
};

const renderC3: DocxRenderer = (raw) => {
  const data = raw as {
    items: Array<{
      outlet: string;
      title?: string;
      url?: string;
      logoSrc?: string;
      publishedAt?: string;
    }>;
  };
  return [
    bullet(
      data.items.map((item) => {
        const runs: DocxRun[] = [{ text: item.outlet, bold: true }];
        if (item.title) runs.push({ text: ` — ${item.title}` });
        if (item.publishedAt) runs.push({ text: ` (${item.publishedAt})` });
        if (item.url) runs.push({ text: ` ${item.url}`, italic: true });
        return { runs };
      }),
    ),
  ];
};

const renderC4: DocxRenderer = (raw) => {
  const data = raw as {
    headline: string;
    body: string;
    founderName?: string;
    founderImage?: string;
    timeline?: Array<{ year: number; label: string }>;
  };
  const out: DocxElement[] = [h(2, data.headline), p(data.body)];
  if (data.founderImage) out.push(image(data.founderImage, data.founderName ?? ""));
  if (data.founderName) {
    out.push(pRuns([{ text: `— ${data.founderName}`, italic: true }]));
  }
  if (data.timeline?.length) {
    out.push(
      bullet(
        data.timeline.map((t) => ({
          runs: [
            { text: `${t.year}`, bold: true },
            { text: ` — ${t.label}` },
          ],
        })),
      ),
    );
  }
  return out;
};

const renderC5: DocxRenderer = (raw) => {
  const data = raw as {
    items: Array<{ label: string; value: string; unit?: string; context?: string }>;
  };
  return [
    bullet(
      data.items.map((item) => {
        const value = item.unit ? `${item.value}${item.unit}` : item.value;
        const runs: DocxRun[] = [
          { text: value, bold: true },
          { text: ` ${item.label}` },
        ];
        if (item.context) runs.push({ text: ` — ${item.context}`, italic: true });
        return { runs };
      }),
    ),
  ];
};

// --- D: Detail ------------------------------------------------------

const renderD1: DocxRenderer = (raw) => {
  const data = raw as {
    rows: Array<{ label: string; value: string }>;
    title?: string;
  };
  const out: DocxElement[] = [];
  if (data.title) out.push(h(3, data.title));
  out.push(bullet(data.rows.map((r) => labelValue(r.label, r.value))));
  return out;
};

const renderD2: DocxRenderer = (raw) => {
  const data = raw as {
    steps: Array<{ title: string; description?: string; imageSrc?: string }>;
    videoUrl?: string;
  };
  const out: DocxElement[] = [];
  out.push(
    numbered(
      data.steps.map((s) => {
        const runs: DocxRun[] = [{ text: s.title, bold: true }];
        if (s.description) runs.push({ text: ` — ${s.description}` });
        return { runs };
      }),
    ),
  );
  for (const s of data.steps) {
    if (s.imageSrc) out.push(image(s.imageSrc, s.title));
  }
  if (data.videoUrl) out.push(p(`▶︎ Video: ${data.videoUrl}`));
  return out;
};

const renderD3: DocxRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; quantity?: number; imageSrc?: string; note?: string }>;
  };
  return [
    bullet(
      data.items.map((item) => {
        const runs: DocxRun[] = [{ text: item.name, bold: true }];
        if (typeof item.quantity === "number") runs.push({ text: ` ×${item.quantity}` });
        if (item.note) runs.push({ text: ` — ${item.note}` });
        return { runs };
      }),
    ),
  ];
};

const renderD4: DocxRenderer = (raw) => {
  const data = raw as {
    chart: { headers: string[]; rows: string[][] };
    note?: string;
    realWearImages?: string[];
  };
  const out: DocxElement[] = [];
  // v1 has no native table — render as a list of "Header1: Value1, Header2: Value2"
  // per row. Downstream DOCX writers can upgrade to a real table when WI-506
  // expands beyond text/image/list.
  out.push(
    bullet(
      data.chart.rows.map((row) => ({
        runs: row.flatMap((cell, i): DocxRun[] => {
          const head = data.chart.headers[i] ?? "";
          const sep = i === 0 ? "" : ", ";
          return [
            { text: `${sep}${head}: `, bold: true },
            { text: cell },
          ];
        }),
      })),
    ),
  );
  if (data.note) out.push(pRuns([{ text: data.note, italic: true }]));
  if (data.realWearImages?.length) {
    for (const src of data.realWearImages) out.push(image(src, ""));
  }
  return out;
};

// --- E: Conversion --------------------------------------------------

const renderE1: DocxRenderer = (raw) => {
  const data = raw as {
    price: string;
    originalPrice?: string;
    ctaText: string;
    ctaHref: string;
    urgencyText?: string;
  };
  const priceRuns: DocxRun[] = [];
  if (data.originalPrice) {
    priceRuns.push({ text: data.originalPrice, italic: true });
    priceRuns.push({ text: " " });
  }
  priceRuns.push({ text: data.price, bold: true });
  const out: DocxElement[] = [pRuns(priceRuns)];
  if (data.urgencyText) out.push(p(data.urgencyText));
  out.push(pRuns([{ text: `${data.ctaText} → ${data.ctaHref}`, bold: true }]));
  return out;
};

const renderE2: DocxRenderer = (raw) => {
  const data = raw as {
    title: string;
    discount?: string;
    code?: string;
    expiresAt?: string;
    description?: string;
  };
  const out: DocxElement[] = [h(3, data.title)];
  const meta: DocxRun[] = [];
  if (data.discount) meta.push({ text: data.discount, bold: true });
  if (data.code) {
    if (meta.length) meta.push({ text: " · " });
    meta.push({ text: data.code });
  }
  if (data.expiresAt) {
    if (meta.length) meta.push({ text: " · " });
    meta.push({ text: `~${data.expiresAt}`, italic: true });
  }
  if (meta.length) out.push(pRuns(meta));
  if (data.description) out.push(p(data.description));
  return out;
};

const renderE3: DocxRenderer = (raw) => {
  const data = raw as {
    items: Array<{ question: string; answer: string; category?: string }>;
  };
  const out: DocxElement[] = [];
  for (const item of data.items) {
    out.push(pRuns([{ text: item.question, bold: true }]));
    out.push(p(item.answer));
  }
  return out;
};

const renderE4: DocxRenderer = (raw) => {
  const data = raw as {
    shippingNote: string;
    returnNote: string;
    policies?: Array<{ label: string; value: string }>;
  };
  const items: DocxListItem[] = [
    labelValue("Shipping", data.shippingNote),
    labelValue("Returns", data.returnNote),
  ];
  if (data.policies?.length) {
    for (const p of data.policies) items.push(labelValue(p.label, p.value));
  }
  return [bullet(items)];
};

// --- F: Mood --------------------------------------------------------

const renderF1: DocxRenderer = (raw) => {
  const data = raw as {
    images: Array<{ src: string; alt?: string }>;
    aspectRatio?: string;
  };
  return data.images.map((img) => image(img.src, img.alt));
};

const renderF2: DocxRenderer = (raw) => {
  const data = raw as {
    options: Array<{
      name: string;
      colorHex?: string;
      imageSrc?: string;
      available?: boolean;
    }>;
  };
  return [
    bullet(
      data.options.map((opt) => {
        const runs: DocxRun[] = [{ text: opt.name, bold: true }];
        if (opt.colorHex) runs.push({ text: ` (${opt.colorHex})` });
        if (opt.available === false) runs.push({ text: " — unavailable", italic: true });
        return { runs };
      }),
    ),
  ];
};

const renderF3: DocxRenderer = (raw) => {
  const data = raw as { height?: number; label?: string };
  // No native divider in the v1 element vocabulary — render as either an
  // empty paragraph or an italic label paragraph. Downstream DOCX writers
  // can upgrade this to a real horizontal rule when the model expands.
  if (data.label) {
    return [pRuns([{ text: data.label, italic: true }])];
  }
  return [p("")];
};

/* ------------------------------------------------------------------ */
/* Renderer registry                                                   */
/* ------------------------------------------------------------------ */

export const DOCX_RENDERERS: Record<string, DocxRenderer> = {
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
