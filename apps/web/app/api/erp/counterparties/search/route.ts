/**
 * /api/erp/counterparties/search (Phase 21 WI-724a)
 *
 *  GET — Korean-friendly fuzzy search over ErpCounterparty.normalizedName.
 *        Uses the pg_trgm GIN index installed in WI-724a-prep
 *        (`ErpCounterparty_normalizedName_trgm_idx`).
 *
 *  Query params:
 *    q       (required) — search text. Both Korean and ASCII are supported;
 *                          the input is canonicalized by
 *                          `normalizeCounterpartyName` first so "(주)에이비씨"
 *                          and "에이비씨 Co., Ltd." land on the same key.
 *    type    (optional) — CUSTOMER | SUPPLIER | BOTH filter.
 *    limit   (optional) — 1..50, default 20.
 *
 *  Matching strategy (in priority order):
 *    1. Exact bizRegNo (if q canonicalizes to 10 digits) → similarity 1.0,
 *       sorted first. This catches the strong-evidence case before paying
 *       for trigram comparisons.
 *    2. Trigram similarity over normalizedName via the `%` operator. Threshold
 *       is pinned at 0.3 per WI-724a AC using `SELECT set_limit(0.3)` inside
 *       the same transaction so concurrent sessions can't drift it.
 *
 *  RED — empty `q` (after trim) → 400 VALIDATION_ERROR. The handler refuses
 *  to surface "everything" because trigram against an empty string would
 *  return every row at zero similarity and defeat the LIMIT.
 *
 *  Performance contract: ≤200ms for 10k rows. The GIN index is the
 *  load-bearing element — verified via EXPLAIN ANALYZE post-deploy.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@axle/db";
import { requireErpScope, toResponse, erpBadRequest } from "@/lib/erp/auth";
import {
  normalizeCounterpartyName,
  canonicalizeBizRegNo,
} from "@/lib/erp/counterparty-utils";

const SIMILARITY_THRESHOLD = 0.3; // matches WI-724a AC exactly
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const QuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "q is required")
    .max(200, "q must be ≤ 200 chars"),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]).optional(),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_LIMIT)
    .optional(),
});

export interface CounterpartyMatch {
  id: string;
  name: string;
  normalizedName: string;
  bizRegNo: string | null;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  defaultCoaCode: string | null;
  /** 1.0 for exact bizRegNo match, else pg_trgm similarity. */
  similarity: number;
  matchedBy: "bizRegNo" | "name";
}

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      q: url.searchParams.get("q") ?? "",
      type: url.searchParams.get("type") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const normalizedQ = normalizeCounterpartyName(parsed.q);
    if (normalizedQ.length === 0) {
      // The raw input was non-empty (Zod min 1) but normalized to nothing —
      // e.g. it was a Korean company prefix like "(주)" alone. Refuse to
      // run a useless similarity scan.
      return erpBadRequest("q normalizes to empty after prefix/suffix strip");
    }

    const limit = parsed.limit ?? DEFAULT_LIMIT;
    const canonicalBizReg = canonicalizeBizRegNo(parsed.q);
    const bizRegLookup =
      canonicalBizReg && /^\d{10}$/.test(canonicalBizReg)
        ? canonicalBizReg
        : null;
    const typeFilter = parsed.type;

    // Pin pg_trgm threshold + run the search in a single transaction so the
    // GUC doesn't leak across pooled connections.
    const results = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ set_limit: number }>>(
        Prisma.sql`SELECT set_limit(${SIMILARITY_THRESHOLD})`,
      );

      const typeSql = typeFilter
        ? Prisma.sql`AND "type" = ${typeFilter}::"CounterpartyType"`
        : Prisma.empty;

      // bizRegNo exact-match path is wired into both the WHERE OR-clause
      // (so a matching row enters the result set even without trigram
      // similarity) and the SELECT projections (so it floats to the top
      // with sim=1.0). When there's no bizRegNo lookup we simply omit both
      // pieces — the trigram `%` operator alone drives the search.
      const bizRegWhere = bizRegLookup
        ? Prisma.sql`OR "bizRegNo" = ${bizRegLookup}`
        : Prisma.empty;

      const simProjection = bizRegLookup
        ? Prisma.sql`CASE WHEN "bizRegNo" = ${bizRegLookup} THEN 1.0::float4
                          ELSE similarity("normalizedName", ${normalizedQ})::float4 END`
        : Prisma.sql`similarity("normalizedName", ${normalizedQ})::float4`;

      const matchedByProjection = bizRegLookup
        ? Prisma.sql`CASE WHEN "bizRegNo" = ${bizRegLookup} THEN 'bizRegNo'::text
                          ELSE 'name'::text END`
        : Prisma.sql`'name'::text`;

      return tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          normalizedName: string;
          bizRegNo: string | null;
          type: "CUSTOMER" | "SUPPLIER" | "BOTH";
          defaultCoaCode: string | null;
          sim: number;
          matched_by: "bizRegNo" | "name";
        }>
      >(Prisma.sql`
        SELECT
          "id",
          "name",
          "normalizedName",
          "bizRegNo",
          "type",
          "defaultCoaCode",
          ${simProjection} AS sim,
          ${matchedByProjection} AS matched_by
        FROM "ErpCounterparty"
        WHERE "orgId" = ${ctx.orgId}
          AND "deletedAt" IS NULL
          ${typeSql}
          AND (
            "normalizedName" % ${normalizedQ}
            ${bizRegWhere}
          )
        ORDER BY sim DESC, "name" ASC
        LIMIT ${limit}
      `);
    });

    const items: CounterpartyMatch[] = results.map((r) => ({
      id: r.id,
      name: r.name,
      normalizedName: r.normalizedName,
      bizRegNo: r.bizRegNo,
      type: r.type,
      defaultCoaCode: r.defaultCoaCode,
      similarity: Number(r.sim),
      matchedBy: r.matched_by,
    }));

    return Response.json({
      items,
      query: {
        raw: parsed.q,
        normalized: normalizedQ,
        bizRegLookup,
        threshold: SIMILARITY_THRESHOLD,
        limit,
      },
    });
  } catch (err) {
    return toResponse(err);
  }
}
