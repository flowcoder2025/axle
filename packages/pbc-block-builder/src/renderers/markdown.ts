/**
 * Markdown renderer (WI-505).
 *
 * Implements `RenderOutput === "markdown"` for all 23 PBC blocks. Each
 * block emits a `<!-- pbc:{id} variant=… -->` HTML comment so consumers
 * can locate blocks inside mixed-source documents (the same affordance the
 * HTML renderer's `data-block-id` attribute provides). Comments are pinned
 * to be CommonMark-compatible — they survive the round-trip through every
 * mainstream Markdown processor we target (remark, marked, markdown-it).
 *
 * Markdown control characters are escaped in user-provided content to keep
 * "Buy *now*" rendering as the literal string instead of an emphasized
 * run. URL-bearing fields encode parentheses to avoid breaking
 * `[label](url)` syntax.
 *
 * Design notes:
 *   - The renderer is XSS-passive: Markdown gets converted to HTML by
 *     downstream tooling, and that converter owns the escaping policy.
 *     We only protect Markdown's own syntax — hostile HTML in user input
 *     simply passes through as literal text inside the markdown body.
 *   - Tables (D1, D4) use CommonMark pipe tables. Cells are escaped with a
 *     stricter `escapeMarkdownCell` that also turns pipes into `\|`.
 *   - `F3` divider becomes `---`; `B2` before/after collapses to a pair of
 *     headings since Markdown lacks a native split layout.
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

const MD_CONTROL_CHARS = /[\\`*_[\]<>|]/g;

/**
 * Escapes Markdown control characters in user-provided content.
 *
 * Order matters: backslash must be escaped first, otherwise the inserted
 * `\` for the other characters would themselves be escaped on a second
 * pass. Using a single regex covers this — each match consumes the source
 * char and emits `\` + char.
 */
export function escapeMarkdown(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  return str.replace(MD_CONTROL_CHARS, (ch) => `\\${ch}`);
}

/**
 * Same as `escapeMarkdown` but additionally escapes pipes — required for
 * any text that lands inside a CommonMark pipe-table cell.
 */
function escapeMarkdownCell(value: unknown): string {
  // `|` is already covered by escapeMarkdown's char class; this wrapper
  // exists to spell the intent at the call-site for clarity.
  return escapeMarkdown(value);
}

/**
 * Encodes URL parentheses to keep `[label](url)` parsing intact. Spaces in
 * URLs are wrapped in `<…>` form by callers that need it; this helper only
 * handles the parens.
 */
function encodeMarkdownLink(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

export function renderBlockMarkdown(
  blockId: BlockId,
  data: unknown,
  context: RenderContext,
): RenderResult<string> {
  const def = BLOCKS[blockId];
  if (!def) {
    throw new Error(`renderBlockMarkdown: unknown block id '${blockId}'`);
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
        `renderBlockMarkdown: ${blockId} payload failed validation — invalid fields: ${fields}`,
      );
    }
    throw err;
  }

  const renderer = MARKDOWN_RENDERERS[blockId];
  if (!renderer) {
    throw new Error(`renderBlockMarkdown: no Markdown renderer registered for ${blockId}`);
  }

  const variant = readVariant(context);
  const marker = variant
    ? `<!-- pbc:${blockId} variant=${variant} -->`
    : `<!-- pbc:${blockId} -->`;
  const body = renderer(parsed, context).trim();
  const content = `${marker}\n\n${body}\n`;

  return {
    content,
    metadata: {
      blockId,
      output: "markdown",
      variant: variant ?? null,
    },
  };
}

function readVariant(context: RenderContext): string | undefined {
  const v = context.metadata?.variant;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/* ------------------------------------------------------------------ */
/* Per-block renderers                                                 */
/* ------------------------------------------------------------------ */

type MarkdownRenderer = (data: unknown, context: RenderContext) => string;

// --- A: Opening -----------------------------------------------------

const renderA1: MarkdownRenderer = (raw) => {
  const data = raw as {
    headline: string;
    tagline?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaHref?: string;
  };
  const lines: string[] = [];
  if (data.backgroundImage) {
    lines.push(`![](${encodeMarkdownLink(data.backgroundImage)})`);
    lines.push("");
  }
  lines.push(`# ${escapeMarkdown(data.headline)}`);
  if (data.tagline) {
    lines.push("");
    lines.push(escapeMarkdown(data.tagline));
  }
  if (data.ctaText && data.ctaHref) {
    lines.push("");
    lines.push(`[${escapeMarkdown(data.ctaText)}](${encodeMarkdownLink(data.ctaHref)})`);
  }
  return lines.join("\n");
};

const renderA2: MarkdownRenderer = (raw) => {
  const data = raw as { line: string };
  return `## ${escapeMarkdown(data.line)}`;
};

const renderA3: MarkdownRenderer = (raw) => {
  const data = raw as { points: string[]; intro?: string };
  const lines: string[] = [];
  if (data.intro) {
    lines.push(escapeMarkdown(data.intro));
    lines.push("");
  }
  for (const p of data.points) {
    lines.push(`- ${escapeMarkdown(p)}`);
  }
  return lines.join("\n");
};

// --- B: Core Value --------------------------------------------------

const renderB1: MarkdownRenderer = (raw) => {
  const data = raw as {
    items: Array<{ title: string; description: string; icon?: string; imageSrc?: string }>;
  };
  const sections = data.items.map((item) => {
    const parts: string[] = [];
    if (item.imageSrc) {
      parts.push(`![${escapeMarkdown(item.title)}](${encodeMarkdownLink(item.imageSrc)})`);
      parts.push("");
    }
    parts.push(`### ${escapeMarkdown(item.title)}`);
    parts.push("");
    parts.push(escapeMarkdown(item.description));
    return parts.join("\n");
  });
  return sections.join("\n\n");
};

const renderB2: MarkdownRenderer = (raw) => {
  const data = raw as {
    before: { label: string; imageSrc?: string; note?: string };
    after: { label: string; imageSrc?: string; note?: string };
    caption?: string;
  };
  const side = (kind: "Before" | "After", v: { label: string; imageSrc?: string; note?: string }) => {
    const parts: string[] = [];
    parts.push(`### ${kind}: ${escapeMarkdown(v.label)}`);
    if (v.imageSrc) {
      parts.push("");
      parts.push(`![${escapeMarkdown(v.label)}](${encodeMarkdownLink(v.imageSrc)})`);
    }
    if (v.note) {
      parts.push("");
      parts.push(escapeMarkdown(v.note));
    }
    return parts.join("\n");
  };
  const lines = [side("Before", data.before), side("After", data.after)];
  if (data.caption) {
    lines.push(`> ${escapeMarkdown(data.caption)}`);
  }
  return lines.join("\n\n");
};

const renderB3: MarkdownRenderer = (raw) => {
  const data = raw as {
    name: string;
    description: string;
    properties?: Array<{ label: string; value: string }>;
    imageSrc?: string;
  };
  const lines: string[] = [];
  if (data.imageSrc) {
    lines.push(`![${escapeMarkdown(data.name)}](${encodeMarkdownLink(data.imageSrc)})`);
    lines.push("");
  }
  lines.push(`### ${escapeMarkdown(data.name)}`);
  lines.push("");
  lines.push(escapeMarkdown(data.description));
  if (data.properties?.length) {
    lines.push("");
    for (const p of data.properties) {
      lines.push(`- **${escapeMarkdown(p.label)}**: ${escapeMarkdown(p.value)}`);
    }
  }
  return lines.join("\n");
};

const renderB4: MarkdownRenderer = (raw) => {
  const data = raw as {
    imageSrc: string;
    callouts?: Array<{ label: string; x?: number; y?: number }>;
    headline?: string;
  };
  const lines: string[] = [];
  lines.push(
    `![${escapeMarkdown(data.headline ?? "USP")}](${encodeMarkdownLink(data.imageSrc)})`,
  );
  if (data.headline) {
    lines.push("");
    lines.push(`**${escapeMarkdown(data.headline)}**`);
  }
  if (data.callouts?.length) {
    lines.push("");
    for (const c of data.callouts) {
      lines.push(`- ${escapeMarkdown(c.label)}`);
    }
  }
  return lines.join("\n");
};

// --- C: Trust -------------------------------------------------------

const renderC1: MarkdownRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; issuer?: string; year?: number; imageSrc?: string }>;
  };
  return data.items
    .map((item) => {
      const meta = [item.issuer, item.year]
        .filter((v) => v !== undefined && v !== null && v !== "")
        .map((v) => escapeMarkdown(v))
        .join(" · ");
      const namePart = `**${escapeMarkdown(item.name)}**`;
      return meta ? `- ${namePart} (${meta})` : `- ${namePart}`;
    })
    .join("\n");
};

const renderC2: MarkdownRenderer = (raw) => {
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
  const lines: string[] = [];
  if (data.summary) {
    lines.push(
      `**${data.summary.averageRating.toFixed(1)} / 5** (${data.summary.totalCount})`,
    );
    lines.push("");
  }
  for (const r of data.reviews) {
    lines.push(`> ${escapeMarkdown(r.quote)}`);
    const meta = [r.author, r.date, r.source]
      .filter(Boolean)
      .map((v) => escapeMarkdown(v))
      .join(" · ");
    lines.push(`> — ${meta} (${r.rating}/5)`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
};

const renderC3: MarkdownRenderer = (raw) => {
  const data = raw as {
    items: Array<{
      outlet: string;
      title?: string;
      url?: string;
      logoSrc?: string;
      publishedAt?: string;
    }>;
  };
  return data.items
    .map((item) => {
      const label = item.title
        ? `${escapeMarkdown(item.outlet)} — ${escapeMarkdown(item.title)}`
        : escapeMarkdown(item.outlet);
      const main = item.url
        ? `[${label}](${encodeMarkdownLink(item.url)})`
        : label;
      return item.publishedAt
        ? `- ${main} (${escapeMarkdown(item.publishedAt)})`
        : `- ${main}`;
    })
    .join("\n");
};

const renderC4: MarkdownRenderer = (raw) => {
  const data = raw as {
    headline: string;
    body: string;
    founderName?: string;
    founderImage?: string;
    timeline?: Array<{ year: number; label: string }>;
  };
  const lines: string[] = [];
  lines.push(`## ${escapeMarkdown(data.headline)}`);
  lines.push("");
  lines.push(escapeMarkdown(data.body));
  if (data.founderImage) {
    lines.push("");
    lines.push(
      `![${escapeMarkdown(data.founderName ?? "")}](${encodeMarkdownLink(data.founderImage)})`,
    );
  }
  if (data.founderName) {
    lines.push("");
    lines.push(`— ${escapeMarkdown(data.founderName)}`);
  }
  if (data.timeline?.length) {
    lines.push("");
    for (const t of data.timeline) {
      lines.push(`- **${t.year}** — ${escapeMarkdown(t.label)}`);
    }
  }
  return lines.join("\n");
};

const renderC5: MarkdownRenderer = (raw) => {
  const data = raw as {
    items: Array<{ label: string; value: string; unit?: string; context?: string }>;
  };
  return data.items
    .map((item) => {
      const valuePart = item.unit
        ? `**${escapeMarkdown(item.value)}${escapeMarkdown(item.unit)}**`
        : `**${escapeMarkdown(item.value)}**`;
      const ctx = item.context ? ` — ${escapeMarkdown(item.context)}` : "";
      return `- ${valuePart} ${escapeMarkdown(item.label)}${ctx}`;
    })
    .join("\n");
};

// --- D: Detail ------------------------------------------------------

const renderD1: MarkdownRenderer = (raw) => {
  const data = raw as {
    rows: Array<{ label: string; value: string }>;
    title?: string;
  };
  const lines: string[] = [];
  if (data.title) {
    lines.push(`### ${escapeMarkdown(data.title)}`);
    lines.push("");
  }
  lines.push("| Label | Value |");
  lines.push("| --- | --- |");
  for (const r of data.rows) {
    lines.push(`| ${escapeMarkdownCell(r.label)} | ${escapeMarkdownCell(r.value)} |`);
  }
  return lines.join("\n");
};

const renderD2: MarkdownRenderer = (raw) => {
  const data = raw as {
    steps: Array<{ title: string; description?: string; imageSrc?: string }>;
    videoUrl?: string;
  };
  const lines: string[] = [];
  data.steps.forEach((s, i) => {
    let line = `${i + 1}. **${escapeMarkdown(s.title)}**`;
    if (s.description) line += ` — ${escapeMarkdown(s.description)}`;
    lines.push(line);
    if (s.imageSrc) {
      lines.push(
        `   ![${escapeMarkdown(s.title)}](${encodeMarkdownLink(s.imageSrc)})`,
      );
    }
  });
  if (data.videoUrl) {
    lines.push("");
    lines.push(`[▶︎ Video](${encodeMarkdownLink(data.videoUrl)})`);
  }
  return lines.join("\n");
};

const renderD3: MarkdownRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; quantity?: number; imageSrc?: string; note?: string }>;
  };
  return data.items
    .map((item) => {
      const qty =
        typeof item.quantity === "number" ? ` ×${item.quantity}` : "";
      const note = item.note ? ` — ${escapeMarkdown(item.note)}` : "";
      return `- **${escapeMarkdown(item.name)}**${qty}${note}`;
    })
    .join("\n");
};

const renderD4: MarkdownRenderer = (raw) => {
  const data = raw as {
    chart: { headers: string[]; rows: string[][] };
    note?: string;
    realWearImages?: string[];
  };
  const lines: string[] = [];
  const headers = data.chart.headers.map((h) => escapeMarkdownCell(h));
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of data.chart.rows) {
    lines.push(`| ${row.map((cell) => escapeMarkdownCell(cell)).join(" | ")} |`);
  }
  if (data.note) {
    lines.push("");
    lines.push(`> ${escapeMarkdown(data.note)}`);
  }
  if (data.realWearImages?.length) {
    lines.push("");
    for (const src of data.realWearImages) {
      lines.push(`![](${encodeMarkdownLink(src)})`);
    }
  }
  return lines.join("\n");
};

// --- E: Conversion --------------------------------------------------

const renderE1: MarkdownRenderer = (raw) => {
  const data = raw as {
    price: string;
    originalPrice?: string;
    ctaText: string;
    ctaHref: string;
    urgencyText?: string;
  };
  const lines: string[] = [];
  const priceLine = data.originalPrice
    ? `~~${escapeMarkdown(data.originalPrice)}~~ **${escapeMarkdown(data.price)}**`
    : `**${escapeMarkdown(data.price)}**`;
  lines.push(priceLine);
  if (data.urgencyText) {
    lines.push("");
    lines.push(`> ${escapeMarkdown(data.urgencyText)}`);
  }
  lines.push("");
  lines.push(`[${escapeMarkdown(data.ctaText)}](${encodeMarkdownLink(data.ctaHref)})`);
  return lines.join("\n");
};

const renderE2: MarkdownRenderer = (raw) => {
  const data = raw as {
    title: string;
    discount?: string;
    code?: string;
    expiresAt?: string;
    description?: string;
  };
  const lines: string[] = [];
  lines.push(`### ${escapeMarkdown(data.title)}`);
  if (data.discount) lines.push(`**${escapeMarkdown(data.discount)}**`);
  if (data.code) lines.push("`" + data.code + "`");
  if (data.expiresAt) lines.push(`~ ${escapeMarkdown(data.expiresAt)}`);
  if (data.description) {
    lines.push("");
    lines.push(escapeMarkdown(data.description));
  }
  return lines.join("\n");
};

const renderE3: MarkdownRenderer = (raw) => {
  const data = raw as {
    items: Array<{ question: string; answer: string; category?: string }>;
  };
  return data.items
    .map((item) => {
      const lines: string[] = [];
      lines.push(`**${escapeMarkdown(item.question)}**`);
      lines.push("");
      lines.push(escapeMarkdown(item.answer));
      return lines.join("\n");
    })
    .join("\n\n");
};

const renderE4: MarkdownRenderer = (raw) => {
  const data = raw as {
    shippingNote: string;
    returnNote: string;
    policies?: Array<{ label: string; value: string }>;
  };
  const lines: string[] = [];
  lines.push(`- **Shipping** ${escapeMarkdown(data.shippingNote)}`);
  lines.push(`- **Returns** ${escapeMarkdown(data.returnNote)}`);
  if (data.policies?.length) {
    for (const p of data.policies) {
      lines.push(`- **${escapeMarkdown(p.label)}** ${escapeMarkdown(p.value)}`);
    }
  }
  return lines.join("\n");
};

// --- F: Mood --------------------------------------------------------

const renderF1: MarkdownRenderer = (raw) => {
  const data = raw as {
    images: Array<{ src: string; alt?: string }>;
    aspectRatio?: string;
  };
  return data.images
    .map(
      (img) =>
        `![${escapeMarkdown(img.alt ?? "")}](${encodeMarkdownLink(img.src)})`,
    )
    .join("\n\n");
};

const renderF2: MarkdownRenderer = (raw) => {
  const data = raw as {
    options: Array<{
      name: string;
      colorHex?: string;
      imageSrc?: string;
      available?: boolean;
    }>;
  };
  return data.options
    .map((opt) => {
      const swatch = opt.colorHex ? ` (${escapeMarkdown(opt.colorHex)})` : "";
      const unavailable = opt.available === false ? " — *unavailable*" : "";
      return `- **${escapeMarkdown(opt.name)}**${swatch}${unavailable}`;
    })
    .join("\n");
};

const renderF3: MarkdownRenderer = (raw) => {
  const data = raw as { height?: number; label?: string };
  if (data.label) {
    return `---\n\n*${escapeMarkdown(data.label)}*`;
  }
  return "---";
};

/* ------------------------------------------------------------------ */
/* Renderer registry                                                   */
/* ------------------------------------------------------------------ */

export const MARKDOWN_RENDERERS: Record<string, MarkdownRenderer> = {
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
