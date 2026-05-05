/**
 * AI copy pipeline (WI-507).
 *
 * 5-stage orchestration per `pbc-block-builder.md` §1:
 *
 *   Stage 1 — intake     : validate the request, drop unknown / refused blocks
 *   Stage 2 — analyze    : provider.brief({intent, industry, language})
 *   Stage 3a — anchor    : generate the lead block (default A1, otherwise the
 *                          first present targetBlock) so subsequent blocks have
 *                          a stable footing
 *   Stage 3b — block copy: generate the rest in parallel
 *   Stage 4 — assemble   : validate every payload against its zod schema and
 *                          drop ones that fail (with a recorded rationale)
 *   Stage 5 — output     : return blocks + rationale + wall-clock time
 *
 * The provider is injectable so:
 *   - tests run without an LLM (default deterministic provider),
 *   - apps can plug `@axle/ai` or any other provider without forcing this
 *     package to depend on the AI SDK,
 *   - the C2 reviews refusal stays in this package (the provider never
 *     sees C2 requests, so an over-eager LLM cannot fabricate review data).
 */

import { ZodError } from "zod";
import { BLOCKS } from "../blocks/index.js";
import type {
  BlockId,
  BlockValidationResult,
  CopyGenerationRequest,
  CopyGenerationResult,
} from "../types.js";
import { createDeterministicCopyProvider } from "./providers/deterministic.js";
import type {
  BlockCopyRequest,
  CopyBrief,
  CopyProvider,
  GenerateCopyOptions,
} from "./types.js";

/** Block ids the pipeline refuses to generate. */
const REFUSED_BLOCKS: ReadonlySet<BlockId> = new Set<BlockId>([
  // C2 reviews — Korean fair-trade law forbids fabricated customer reviews.
  // The schema's source comment pins this contract and the AI pipeline
  // enforces it.
  "C2",
]);

const REFUSAL_REASON: Record<string, string> = {
  C2: "real customer reviews only — refused to fabricate",
};

export async function generateCopy(
  request: CopyGenerationRequest,
  options: GenerateCopyOptions = {},
): Promise<CopyGenerationResult> {
  const startedAt = Date.now();

  // -- Stage 1: intake ---------------------------------------------------
  if (!request.intent || !request.intent.trim()) {
    throw new Error("generateCopy: intent must be a non-empty string");
  }
  const targetBlocks = request.targetBlocks ?? [];
  const provider = options.provider ?? createDeterministicCopyProvider();

  const accepted: BlockId[] = [];
  const rationaleParts: string[] = [];

  if (targetBlocks.length === 0) {
    return {
      blocks: [],
      rationale: "no target blocks requested",
      generationTime: Date.now() - startedAt,
    };
  }

  for (const id of targetBlocks) {
    if (!BLOCKS[id]) {
      rationaleParts.push(`skipped ${id}: unknown block id`);
      continue;
    }
    if (REFUSED_BLOCKS.has(id)) {
      rationaleParts.push(
        `skipped ${id}: ${REFUSAL_REASON[id] ?? "refused"}`,
      );
      continue;
    }
    accepted.push(id);
  }

  if (accepted.length === 0) {
    return {
      blocks: [],
      rationale: rationaleParts.join("; ") || "no eligible target blocks",
      generationTime: Date.now() - startedAt,
    };
  }

  // -- Stage 2: analyze --------------------------------------------------
  const brief: CopyBrief = await provider.brief({
    intent: request.intent,
    industry: request.industry,
    brandTone: request.brandTone,
    language: request.language,
  });

  // -- Stage 3a: anchor --------------------------------------------------
  const anchorId = pickAnchorId(accepted);
  const anchorReq: BlockCopyRequest = {
    blockId: anchorId,
    blockSchema: BLOCKS[anchorId].schema,
    brief,
    brandTone: request.brandTone,
    language: request.language,
  };
  const anchorRaw = await provider.blockCopy(anchorReq);

  // -- Stage 3b: block copy (parallel) -----------------------------------
  const others = accepted.filter((id) => id !== anchorId);
  const othersRaw = await Promise.all(
    others.map((blockId) =>
      provider.blockCopy({
        blockId,
        blockSchema: BLOCKS[blockId].schema,
        brief,
        anchor: { id: anchorId, data: anchorRaw },
        brandTone: request.brandTone,
        language: request.language,
      }),
    ),
  );

  // -- Stage 4: assemble (validate + preserve order) ---------------------
  const generatedById = new Map<BlockId, unknown>();
  generatedById.set(anchorId, anchorRaw);
  others.forEach((id, i) => generatedById.set(id, othersRaw[i]));

  const blocks: Array<{ id: BlockId; data: unknown }> = [];
  for (const id of targetBlocks) {
    if (!generatedById.has(id)) continue; // dropped during intake
    const data = generatedById.get(id);
    const validation = validateBlockData(id, data);
    if (!validation.ok) {
      rationaleParts.push(
        `dropped ${id}: schema validation failed (${validation.errors?.join(", ")})`,
      );
      continue;
    }
    blocks.push({ id, data });
  }

  // -- Stage 5: output ---------------------------------------------------
  if (rationaleParts.length === 0) {
    rationaleParts.push(
      `generated ${blocks.length} block(s) anchored on ${anchorId} from intent "${request.intent.slice(0, 60)}${request.intent.length > 60 ? "…" : ""}"`,
    );
  }

  return {
    blocks,
    rationale: rationaleParts.join("; "),
    generationTime: Date.now() - startedAt,
  };
}

function pickAnchorId(accepted: BlockId[]): BlockId {
  // Prefer A1 (canonical hero) when present; otherwise the first requested
  // block. The anchor seeds the brand voice for all later parallel blocks.
  if (accepted.includes("A1" as BlockId)) return "A1" as BlockId;
  return accepted[0];
}

/* ------------------------------------------------------------------ */
/* Public block-validation helper                                      */
/* ------------------------------------------------------------------ */

export function validateBlockData(
  blockId: BlockId,
  data: unknown,
): BlockValidationResult {
  const def = BLOCKS[blockId];
  if (!def) {
    return { ok: false, errors: [`unknown block id: ${blockId}`] };
  }
  const parsed = def.schema.safeParse(data);
  if (parsed.success) return { ok: true };
  const errors =
    parsed.error instanceof ZodError
      ? parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        )
      : [String(parsed.error)];
  return { ok: false, errors };
}

export type { CopyProvider, CopyBrief, GenerateCopyOptions, BlockCopyRequest };
