/**
 * React renderer (WI-504).
 *
 * Implements `RenderOutput === "react"` for all 23 PBC blocks. Mirrors the
 * WI-503 HTML renderer's contract:
 *
 *   - Schema-first: every render call validates the payload through the
 *     block's zod schema before producing JSX.
 *   - Stable wrapper: every block is wrapped in
 *     `<section class="pbc-block pbc-{id} pbc-{id}--{variant}" data-block-id="{id}">`
 *     so apps can theme via the same CSS hooks they use for the HTML output.
 *   - **No `dangerouslySetInnerHTML` anywhere**. React's child escaping is
 *     the single XSS defense — the AI copy pipeline (WI-507) and the
 *     FlowStudio v2 migration (WI-509) both rely on this.
 *
 * The package's React peerDependency is **optional** — consumers that only
 * use the HTML / Markdown / DOCX outputs do not need React installed. The
 * dispatcher in `render.ts` only loads this module when
 * `context.output === "react"`.
 */

import { Fragment, type ReactNode } from "react";
import { ZodError } from "zod";
import { BLOCKS } from "../blocks/index.js";
import type {
  BlockId,
  RenderContext,
  RenderResult,
} from "../types.js";

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

export function renderBlockReact(
  blockId: BlockId,
  data: unknown,
  context: RenderContext,
): RenderResult<ReactNode> {
  const def = BLOCKS[blockId];
  if (!def) {
    throw new Error(`renderBlockReact: unknown block id '${blockId}'`);
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
        `renderBlockReact: ${blockId} payload failed validation — invalid fields: ${fields}`,
      );
    }
    throw err;
  }

  const renderer = REACT_RENDERERS[blockId];
  if (!renderer) {
    throw new Error(`renderBlockReact: no React renderer registered for ${blockId}`);
  }

  const variant = readVariant(context);
  const inner = renderer(parsed, context);
  const className = ["pbc-block", `pbc-${blockId}`];
  if (variant) className.push(`pbc-${blockId}--${variant}`);

  return {
    content: (
      <section className={className.join(" ")} data-block-id={blockId}>
        {inner}
      </section>
    ),
    metadata: {
      blockId,
      output: "react",
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

type ReactRenderer = (data: unknown, context: RenderContext) => ReactNode;

// --- A: Opening -----------------------------------------------------

const renderA1: ReactRenderer = (raw) => {
  const data = raw as {
    headline: string;
    tagline?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaHref?: string;
  };
  const style = data.backgroundImage
    ? { backgroundImage: `url('${data.backgroundImage}')` }
    : undefined;
  return (
    <div className="pbc-A1__inner" style={style}>
      <h1 className="pbc-A1__headline">{data.headline}</h1>
      {data.tagline ? <p className="pbc-A1__tagline">{data.tagline}</p> : null}
      {data.ctaText && data.ctaHref ? (
        <a className="pbc-A1__cta" href={data.ctaHref}>
          {data.ctaText}
        </a>
      ) : null}
    </div>
  );
};

const renderA2: ReactRenderer = (raw) => {
  const data = raw as { line: string; backgroundColor?: string; accent?: string };
  const style: React.CSSProperties = {};
  if (data.backgroundColor) style.backgroundColor = data.backgroundColor;
  if (data.accent) style.color = data.accent;
  return (
    <p className="pbc-A2__line" style={Object.keys(style).length ? style : undefined}>
      {data.line}
    </p>
  );
};

const renderA3: ReactRenderer = (raw) => {
  const data = raw as { points: string[]; intro?: string };
  return (
    <Fragment>
      {data.intro ? <p className="pbc-A3__intro">{data.intro}</p> : null}
      <ul className="pbc-A3__list">
        {data.points.map((p, i) => (
          <li key={i} className="pbc-A3__point">
            {p}
          </li>
        ))}
      </ul>
    </Fragment>
  );
};

// --- B: Core Value --------------------------------------------------

const renderB1: ReactRenderer = (raw) => {
  const data = raw as {
    items: Array<{ title: string; description: string; icon?: string; imageSrc?: string }>;
  };
  return (
    <ul className="pbc-B1__list">
      {data.items.map((item, i) => (
        <li key={i} className="pbc-B1__item">
          {item.imageSrc ? (
            <img className="pbc-B1__image" src={item.imageSrc} alt={item.title} />
          ) : item.icon ? (
            <span className="pbc-B1__icon" aria-hidden="true">
              {item.icon}
            </span>
          ) : null}
          <h3 className="pbc-B1__title">{item.title}</h3>
          <p className="pbc-B1__desc">{item.description}</p>
        </li>
      ))}
    </ul>
  );
};

const renderB2: ReactRenderer = (raw) => {
  const data = raw as {
    before: { label: string; imageSrc?: string; note?: string };
    after: { label: string; imageSrc?: string; note?: string };
    caption?: string;
  };
  const Side = ({
    kind,
    v,
  }: {
    kind: "before" | "after";
    v: { label: string; imageSrc?: string; note?: string };
  }) => (
    <figure className={`pbc-B2__${kind}`}>
      {v.imageSrc ? <img src={v.imageSrc} alt={v.label} /> : null}
      <figcaption>
        <strong>{v.label}</strong>
        {v.note ? <span> {v.note}</span> : null}
      </figcaption>
    </figure>
  );
  return (
    <Fragment>
      <div className="pbc-B2__pair">
        <Side kind="before" v={data.before} />
        <Side kind="after" v={data.after} />
      </div>
      {data.caption ? <p className="pbc-B2__caption">{data.caption}</p> : null}
    </Fragment>
  );
};

const renderB3: ReactRenderer = (raw) => {
  const data = raw as {
    name: string;
    description: string;
    properties?: Array<{ label: string; value: string }>;
    imageSrc?: string;
  };
  return (
    <Fragment>
      {data.imageSrc ? (
        <img className="pbc-B3__image" src={data.imageSrc} alt={data.name} />
      ) : null}
      <h3 className="pbc-B3__name">{data.name}</h3>
      <p className="pbc-B3__desc">{data.description}</p>
      {data.properties?.length ? (
        <dl className="pbc-B3__props">
          {data.properties.map((p, i) => (
            <Fragment key={i}>
              <dt>{p.label}</dt>
              <dd>{p.value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </Fragment>
  );
};

const renderB4: ReactRenderer = (raw) => {
  const data = raw as {
    imageSrc: string;
    callouts?: Array<{ label: string; x?: number; y?: number }>;
    headline?: string;
  };
  return (
    <figure className="pbc-B4__figure">
      <img src={data.imageSrc} alt={data.headline ?? "USP"} />
      {data.callouts?.length ? (
        <ul className="pbc-B4__callouts">
          {data.callouts.map((c, i) => {
            const style: React.CSSProperties = {};
            if (typeof c.x === "number") style.left = `${c.x}%`;
            if (typeof c.y === "number") style.top = `${c.y}%`;
            return (
              <li
                key={i}
                className="pbc-B4__callout"
                style={Object.keys(style).length ? style : undefined}
              >
                {c.label}
              </li>
            );
          })}
        </ul>
      ) : null}
      {data.headline ? (
        <figcaption className="pbc-B4__headline">{data.headline}</figcaption>
      ) : null}
    </figure>
  );
};

// --- C: Trust -------------------------------------------------------

const renderC1: ReactRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; issuer?: string; year?: number; imageSrc?: string }>;
  };
  return (
    <ul className="pbc-C1__list">
      {data.items.map((item, i) => {
        const meta = [item.issuer, item.year].filter((v) => v !== undefined && v !== null);
        return (
          <li key={i} className="pbc-C1__item">
            {item.imageSrc ? <img src={item.imageSrc} alt={item.name} /> : null}
            <span className="pbc-C1__name">{item.name}</span>
            {meta.length ? (
              <span className="pbc-C1__meta">{meta.join(" · ")}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};

const renderC2: ReactRenderer = (raw) => {
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
  return (
    <Fragment>
      {data.summary ? (
        <p className="pbc-C2__summary">
          {data.summary.averageRating.toFixed(1)} / 5 ({data.summary.totalCount})
        </p>
      ) : null}
      <ul className="pbc-C2__list">
        {data.reviews.map((r, i) => {
          const meta = [r.author, r.date, r.source].filter(Boolean).join(" · ");
          return (
            <li key={i} className="pbc-C2__review">
              <div className="pbc-C2__rating" aria-label={`${r.rating} of 5`}>
                {r.rating.toString()}
              </div>
              <blockquote className="pbc-C2__quote">{r.quote}</blockquote>
              <cite className="pbc-C2__cite">{meta}</cite>
            </li>
          );
        })}
      </ul>
    </Fragment>
  );
};

const renderC3: ReactRenderer = (raw) => {
  const data = raw as {
    items: Array<{
      outlet: string;
      title?: string;
      url?: string;
      logoSrc?: string;
      publishedAt?: string;
    }>;
  };
  return (
    <ul className="pbc-C3__list">
      {data.items.map((item, i) => {
        const inner = (
          <Fragment>
            {item.logoSrc ? <img src={item.logoSrc} alt={item.outlet} /> : null}
            <span className="pbc-C3__outlet">{item.outlet}</span>
            {item.title ? <span className="pbc-C3__title">{item.title}</span> : null}
            {item.publishedAt ? (
              <time className="pbc-C3__date">{item.publishedAt}</time>
            ) : null}
          </Fragment>
        );
        return (
          <li key={i} className="pbc-C3__item">
            {item.url ? <a href={item.url}>{inner}</a> : inner}
          </li>
        );
      })}
    </ul>
  );
};

const renderC4: ReactRenderer = (raw) => {
  const data = raw as {
    headline: string;
    body: string;
    founderName?: string;
    founderImage?: string;
    timeline?: Array<{ year: number; label: string }>;
  };
  return (
    <Fragment>
      <h2 className="pbc-C4__headline">{data.headline}</h2>
      <div className="pbc-C4__body">{data.body}</div>
      {data.founderName || data.founderImage ? (
        <figure className="pbc-C4__founder">
          {data.founderImage ? (
            <img src={data.founderImage} alt={data.founderName ?? ""} />
          ) : null}
          {data.founderName ? <figcaption>{data.founderName}</figcaption> : null}
        </figure>
      ) : null}
      {data.timeline?.length ? (
        <ol className="pbc-C4__timeline">
          {data.timeline.map((t, i) => (
            <li key={i}>
              <time>{String(t.year)}</time>
              <span>{t.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Fragment>
  );
};

const renderC5: ReactRenderer = (raw) => {
  const data = raw as {
    items: Array<{ label: string; value: string; unit?: string; context?: string }>;
  };
  return (
    <ul className="pbc-C5__list">
      {data.items.map((item, i) => (
        <li key={i} className="pbc-C5__item">
          <span className="pbc-C5__value">
            {item.value}
            {item.unit ? <small>{item.unit}</small> : null}
          </span>
          <span className="pbc-C5__label">{item.label}</span>
          {item.context ? (
            <span className="pbc-C5__context">{item.context}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

// --- D: Detail ------------------------------------------------------

const renderD1: ReactRenderer = (raw) => {
  const data = raw as {
    rows: Array<{ label: string; value: string }>;
    title?: string;
  };
  return (
    <table className="pbc-D1__table">
      {data.title ? <caption>{data.title}</caption> : null}
      <tbody>
        {data.rows.map((r, i) => (
          <tr key={i}>
            <th scope="row">{r.label}</th>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const renderD2: ReactRenderer = (raw) => {
  const data = raw as {
    steps: Array<{ title: string; description?: string; imageSrc?: string }>;
    videoUrl?: string;
  };
  return (
    <Fragment>
      <ol className="pbc-D2__steps">
        {data.steps.map((s, i) => (
          <li key={i} className="pbc-D2__step">
            {s.imageSrc ? <img src={s.imageSrc} alt={s.title} /> : null}
            <h4>{s.title}</h4>
            {s.description ? <p>{s.description}</p> : null}
          </li>
        ))}
      </ol>
      {data.videoUrl ? (
        <a className="pbc-D2__video" href={data.videoUrl}>
          ▶︎ Video
        </a>
      ) : null}
    </Fragment>
  );
};

const renderD3: ReactRenderer = (raw) => {
  const data = raw as {
    items: Array<{ name: string; quantity?: number; imageSrc?: string; note?: string }>;
  };
  return (
    <ul className="pbc-D3__list">
      {data.items.map((item, i) => (
        <li key={i} className="pbc-D3__item">
          {item.imageSrc ? <img src={item.imageSrc} alt={item.name} /> : null}
          <span className="pbc-D3__name">{item.name}</span>
          {typeof item.quantity === "number" ? (
            <span className="pbc-D3__qty">×{item.quantity}</span>
          ) : null}
          {item.note ? <span className="pbc-D3__note">{item.note}</span> : null}
        </li>
      ))}
    </ul>
  );
};

const renderD4: ReactRenderer = (raw) => {
  const data = raw as {
    chart: { headers: string[]; rows: string[][] };
    note?: string;
    realWearImages?: string[];
  };
  return (
    <Fragment>
      <table className="pbc-D4__chart">
        <thead>
          <tr>
            {data.chart.headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.chart.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.note ? <p className="pbc-D4__note">{data.note}</p> : null}
      {data.realWearImages?.length ? (
        <div className="pbc-D4__real-wear">
          {data.realWearImages.map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      ) : null}
    </Fragment>
  );
};

// --- E: Conversion --------------------------------------------------

const renderE1: ReactRenderer = (raw) => {
  const data = raw as {
    price: string;
    originalPrice?: string;
    ctaText: string;
    ctaHref: string;
    urgencyText?: string;
  };
  return (
    <Fragment>
      <div className="pbc-E1__price-block">
        {data.originalPrice ? (
          <span className="pbc-E1__original">{data.originalPrice}</span>
        ) : null}
        <span className="pbc-E1__price">{data.price}</span>
      </div>
      {data.urgencyText ? (
        <p className="pbc-E1__urgency">{data.urgencyText}</p>
      ) : null}
      <a className="pbc-E1__cta" href={data.ctaHref}>
        {data.ctaText}
      </a>
    </Fragment>
  );
};

const renderE2: ReactRenderer = (raw) => {
  const data = raw as {
    title: string;
    discount?: string;
    code?: string;
    expiresAt?: string;
    description?: string;
  };
  return (
    <Fragment>
      <h3 className="pbc-E2__title">{data.title}</h3>
      {data.discount ? (
        <span className="pbc-E2__discount">{data.discount}</span>
      ) : null}
      {data.code ? <code className="pbc-E2__code">{data.code}</code> : null}
      {data.expiresAt ? (
        <time className="pbc-E2__expiry">~{data.expiresAt}</time>
      ) : null}
      {data.description ? (
        <p className="pbc-E2__desc">{data.description}</p>
      ) : null}
    </Fragment>
  );
};

const renderE3: ReactRenderer = (raw) => {
  const data = raw as {
    items: Array<{ question: string; answer: string; category?: string }>;
  };
  return (
    <div className="pbc-E3__list">
      {data.items.map((item, i) => (
        <details
          key={i}
          className="pbc-E3__item"
          {...(item.category ? { "data-category": item.category } : {})}
        >
          <summary>{item.question}</summary>
          <div className="pbc-E3__answer">{item.answer}</div>
        </details>
      ))}
    </div>
  );
};

const renderE4: ReactRenderer = (raw) => {
  const data = raw as {
    shippingNote: string;
    returnNote: string;
    policies?: Array<{ label: string; value: string }>;
  };
  return (
    <Fragment>
      <div className="pbc-E4__shipping">
        <strong>Shipping</strong> {data.shippingNote}
      </div>
      <div className="pbc-E4__return">
        <strong>Returns</strong> {data.returnNote}
      </div>
      {data.policies?.length ? (
        <dl className="pbc-E4__policies">
          {data.policies.map((p, i) => (
            <Fragment key={i}>
              <dt>{p.label}</dt>
              <dd>{p.value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </Fragment>
  );
};

// --- F: Mood --------------------------------------------------------

const renderF1: ReactRenderer = (raw) => {
  const data = raw as {
    images: Array<{ src: string; alt?: string }>;
    aspectRatio?: string;
  };
  const style = data.aspectRatio
    ? ({ aspectRatio: data.aspectRatio } as React.CSSProperties)
    : undefined;
  return (
    <div className="pbc-F1__gallery">
      {data.images.map((img, i) => (
        <img key={i} src={img.src} alt={img.alt ?? ""} style={style} />
      ))}
    </div>
  );
};

const renderF2: ReactRenderer = (raw) => {
  const data = raw as {
    options: Array<{
      name: string;
      colorHex?: string;
      imageSrc?: string;
      available?: boolean;
    }>;
  };
  return (
    <ul className="pbc-F2__list">
      {data.options.map((opt, i) => {
        const swatch = opt.colorHex ? (
          <span
            className="pbc-F2__swatch"
            style={{ backgroundColor: opt.colorHex }}
            aria-hidden="true"
          />
        ) : opt.imageSrc ? (
          <img className="pbc-F2__image" src={opt.imageSrc} alt={opt.name} />
        ) : null;
        return (
          <li
            key={i}
            className="pbc-F2__option"
            {...(opt.available === false ? { "data-unavailable": "true" } : {})}
          >
            {swatch}
            <span className="pbc-F2__name">{opt.name}</span>
          </li>
        );
      })}
    </ul>
  );
};

const renderF3: ReactRenderer = (raw) => {
  const data = raw as { height?: number; label?: string };
  const style =
    typeof data.height === "number" ? ({ height: `${data.height}px` } as React.CSSProperties) : undefined;
  return (
    <Fragment>
      <hr className="pbc-F3__divider" role="separator" style={style} />
      {data.label ? <span className="pbc-F3__label">{data.label}</span> : null}
    </Fragment>
  );
};

/* ------------------------------------------------------------------ */
/* Renderer registry                                                   */
/* ------------------------------------------------------------------ */

export const REACT_RENDERERS: Record<string, ReactRenderer> = {
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
