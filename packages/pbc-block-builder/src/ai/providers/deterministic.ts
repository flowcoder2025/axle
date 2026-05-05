/**
 * Deterministic copy provider (WI-507).
 *
 * The default `CopyProvider` for `generateCopy`. Produces block payloads
 * directly from the intent / brief without calling an LLM. This is what
 * tests, demos, and offline build pipelines see.
 *
 * Each per-block composer returns the smallest payload that satisfies the
 * block's zod schema. For richer demos, swap in an LLM-backed provider —
 * the pipeline contract stays the same.
 *
 * The composers are intentionally conservative: they prefer reusing the
 * brief's summary and keyPoints over inventing new content. This avoids
 * hallucinations in the deterministic path and keeps tests stable.
 */

import type { BlockId, Locale } from "../../types.js";
import type {
  BlockCopyRequest,
  CopyBrief,
  CopyProvider,
} from "../types.js";

/* ------------------------------------------------------------------ */
/* Brief extraction                                                    */
/* ------------------------------------------------------------------ */

function extractBrief(req: {
  intent: string;
  industry?: string;
  brandTone?: string;
  language?: Locale;
}): CopyBrief {
  const intent = req.intent.trim();
  // Summary = first sentence (period or newline) capped at 80 chars; falls
  // back to the whole intent for short inputs.
  const firstSentence =
    intent.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean)[0] ??
    intent;
  const summary = firstSentence.length > 80
    ? `${firstSentence.slice(0, 77)}...`
    : firstSentence;

  // Keypoints = comma-separated phrases from the whole intent. Drop empties,
  // dedupe, cap at 6, and ensure at least one entry so blocks that need a
  // bullet list always have material to work with.
  const phrases = intent
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const keyPoints: string[] = [];
  for (const p of phrases) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keyPoints.push(p);
    if (keyPoints.length >= 6) break;
  }
  if (keyPoints.length === 0) keyPoints.push(summary);

  return {
    summary,
    keyPoints,
    industry: req.industry,
    brandTone: req.brandTone,
    language: req.language,
  };
}

/* ------------------------------------------------------------------ */
/* Per-block composers                                                 */
/* ------------------------------------------------------------------ */

type Composer = (brief: CopyBrief) => unknown;

function pickN<T>(items: T[], n: number, fallback: () => T): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const item = items[i % Math.max(items.length, 1)];
    out.push(item ?? fallback());
  }
  return out;
}

const COMPOSERS: Partial<Record<BlockId, Composer>> = {
  A1: (b) => ({
    headline: b.summary,
    tagline: b.keyPoints[0],
  }),
  A2: (b) => ({ line: b.summary }),
  A3: (b) => ({
    intro: b.summary,
    points: pickN(b.keyPoints, Math.max(2, Math.min(4, b.keyPoints.length)), () => "—"),
  }),
  B1: (b) => ({
    items: pickN(b.keyPoints, Math.max(2, Math.min(4, b.keyPoints.length)), () => "Feature").map(
      (kp, i) => ({
        title: `Feature ${i + 1}`,
        description: kp,
      }),
    ),
  }),
  B2: (b) => ({
    before: { label: "Before", note: b.keyPoints[0] ?? b.summary },
    after: { label: "After", note: b.keyPoints[1] ?? b.summary },
  }),
  B3: (b) => ({
    name: b.keyPoints[0] ?? b.summary,
    description: b.summary,
  }),
  B4: (b) => ({
    imageSrc: "placeholder://usp",
    headline: b.summary,
  }),
  C1: (b) => ({
    items: [{ name: b.keyPoints[0] ?? b.summary }],
  }),
  // C2 is hard-refused at the pipeline layer — no composer here on purpose.
  C3: (b) => ({
    items: [{ outlet: b.industry ?? b.keyPoints[0] ?? "Press" }],
  }),
  C4: (b) => ({
    headline: b.summary,
    body: b.keyPoints.join(" "),
  }),
  C5: (b) => ({
    items: pickN(b.keyPoints, Math.min(3, Math.max(1, b.keyPoints.length)), () => "—").map(
      (kp, i) => ({
        label: kp,
        value: `${(i + 1) * 100}+`,
      }),
    ),
  }),
  D1: (b) => ({
    rows: pickN(b.keyPoints, Math.max(1, Math.min(4, b.keyPoints.length)), () => "—").map(
      (kp, i) => ({ label: `Spec ${i + 1}`, value: kp }),
    ),
  }),
  D2: (b) => ({
    steps: pickN(b.keyPoints, Math.max(1, Math.min(3, b.keyPoints.length)), () => "Step").map(
      (kp) => ({ title: kp }),
    ),
  }),
  D3: (b) => ({
    items: pickN(b.keyPoints, Math.max(1, Math.min(3, b.keyPoints.length)), () => "Item").map(
      (kp) => ({ name: kp }),
    ),
  }),
  D4: (b) => ({
    chart: {
      headers: ["Size", "Detail"],
      rows: pickN(b.keyPoints, Math.max(1, Math.min(3, b.keyPoints.length)), () => "—").map(
        (kp, i) => [`S${i + 1}`, kp],
      ),
    },
  }),
  E1: (b) => ({
    price: "TBD",
    ctaText: "Buy now",
    ctaHref: "#",
    urgencyText: b.keyPoints[0],
  }),
  E2: (b) => ({
    title: b.keyPoints[0] ?? "Promotion",
    description: b.summary,
  }),
  E3: (b) => ({
    items: pickN(b.keyPoints, Math.max(1, Math.min(3, b.keyPoints.length)), () => "Q").map(
      (kp) => ({ question: `${kp}?`, answer: b.summary }),
    ),
  }),
  E4: (b) => ({
    shippingNote: b.keyPoints[0] ?? b.summary,
    returnNote: b.keyPoints[1] ?? "30-day return",
  }),
  F1: () => ({
    images: [{ src: "placeholder://lifestyle" }],
  }),
  F2: (b) => ({
    options: [{ name: b.keyPoints[0] ?? "Default" }],
  }),
  F3: () => ({}),
};

/* ------------------------------------------------------------------ */
/* Provider factory                                                    */
/* ------------------------------------------------------------------ */

export function createDeterministicCopyProvider(): CopyProvider {
  return {
    brief: async (req) => extractBrief(req),
    blockCopy: async (req: BlockCopyRequest) => {
      const composer = COMPOSERS[req.blockId];
      if (!composer) {
        throw new Error(
          `deterministic provider: no composer for block ${req.blockId}`,
        );
      }
      return composer(req.brief);
    },
  };
}
