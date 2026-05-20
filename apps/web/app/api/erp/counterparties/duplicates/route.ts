/**
 * /api/erp/counterparties/duplicates (Phase 21 WI-724b)
 *
 *  GET — Read-only duplicate-detection report. Surfaces ErpCounterparty pairs
 *        the operator should consider merging via WI-724c.
 *
 *  Query params:
 *    threshold (optional) — minimum trigram similarity, 0.5..1.0, default 0.7.
 *                            Ratings closer to 1.0 are highly likely duplicates;
 *                            0.7 is the AC's recommended starting threshold.
 *    limit     (optional) — 1..200, default 50.
 *
 *  Why no bizRegNo branch:
 *    The partial unique constraint `(orgId, bizRegNo) WHERE bizRegNo IS NOT NULL`
 *    installed in WI-721 makes "two rows in the same tenant sharing a
 *    non-null bizRegNo" structurally impossible. We therefore restrict this
 *    report to name-similarity pairs and use the unique constraint as the
 *    contract that bizRegNo duplicates don't exist.
 *
 *  Why a self-join with the GIN `%` operator:
 *    `a.normalizedName % b.normalizedName` lets Postgres drive the search
 *    with the GIN trigram index from WI-724a-prep. The asymmetry guard
 *    `a.id < b.id` keeps each pair from appearing twice and excludes
 *    self-pairs. Order counts are joined from a single GROUP BY so the
 *    plan stays linear in counterparty count.
 *
 *  RED — empty result returns 200 with `items: []` (per design AC). The
 *  endpoint never 404s on "no duplicates"; that would conflate "feature
 *  worked, nothing to do" with "the URL is wrong".
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@axle/db";
import { requireErpScope, toResponse } from "@/lib/erp/auth";

const DEFAULT_THRESHOLD = 0.7;
const MIN_THRESHOLD = 0.5;
const MAX_THRESHOLD = 1.0;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const QuerySchema = z.object({
  threshold: z.coerce
    .number()
    .min(MIN_THRESHOLD)
    .max(MAX_THRESHOLD)
    .optional(),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).optional(),
});

export interface CounterpartyRowSummary {
  id: string;
  name: string;
  bizRegNo: string | null;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  defaultCoaCode: string | null;
  orderCount: number;
}

export interface DuplicatePair {
  similarity: number;
  /** Suggested target = the row with more Orders (safer history retention). */
  suggestedTargetId: string;
  a: CounterpartyRowSummary;
  b: CounterpartyRowSummary;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      threshold: url.searchParams.get("threshold") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const threshold = parsed.threshold ?? DEFAULT_THRESHOLD;
    const limit = parsed.limit ?? DEFAULT_LIMIT;

    const rows = await prisma.$transaction(async (tx) => {
      // Pin pg_trgm threshold for the `%` operator so the GIN index returns
      // exactly the pairs we want to score. Done inside the transaction to
      // avoid leaking GUC state to pooled sessions.
      await tx.$queryRaw(Prisma.sql`SELECT set_limit(${threshold})`);

      // Self-join with `a.id < b.id` to emit each pair once, never self-pair.
      // Order counts come from a CTE so the plan does a single COUNT over
      // Order rather than two correlated subqueries per pair.
      return tx.$queryRaw<
        Array<{
          a_id: string;
          a_name: string;
          a_biz: string | null;
          a_type: "CUSTOMER" | "SUPPLIER" | "BOTH";
          a_coa: string | null;
          a_count: bigint;
          b_id: string;
          b_name: string;
          b_biz: string | null;
          b_type: "CUSTOMER" | "SUPPLIER" | "BOTH";
          b_coa: string | null;
          b_count: bigint;
          sim: number;
        }>
      >(Prisma.sql`
        WITH order_counts AS (
          SELECT "counterpartyId", COUNT(*)::bigint AS cnt
          FROM "Order"
          WHERE "orgId" = ${ctx.orgId} AND "counterpartyId" IS NOT NULL
          GROUP BY "counterpartyId"
        )
        SELECT
          a."id"             AS a_id,
          a."name"           AS a_name,
          a."bizRegNo"       AS a_biz,
          a."type"           AS a_type,
          a."defaultCoaCode" AS a_coa,
          COALESCE(oa."cnt", 0::bigint) AS a_count,
          b."id"             AS b_id,
          b."name"           AS b_name,
          b."bizRegNo"       AS b_biz,
          b."type"           AS b_type,
          b."defaultCoaCode" AS b_coa,
          COALESCE(ob."cnt", 0::bigint) AS b_count,
          similarity(a."normalizedName", b."normalizedName")::float4 AS sim
        FROM "ErpCounterparty" a
        JOIN "ErpCounterparty" b
          ON b."orgId" = a."orgId"
         AND a."id"  < b."id"
         AND a."normalizedName" % b."normalizedName"
         AND b."deletedAt" IS NULL
        LEFT JOIN order_counts oa ON oa."counterpartyId" = a."id"
        LEFT JOIN order_counts ob ON ob."counterpartyId" = b."id"
        WHERE a."orgId" = ${ctx.orgId}
          AND a."deletedAt" IS NULL
          AND similarity(a."normalizedName", b."normalizedName") >= ${threshold}
        ORDER BY sim DESC, a."name" ASC
        LIMIT ${limit}
      `);
    });

    const items: DuplicatePair[] = rows.map((r) => {
      const aCount = Number(r.a_count);
      const bCount = Number(r.b_count);
      // Heuristic: prefer the row with more orders as the merge target so
      // historical references stay intact. Ties → keep the lexicographically
      // smaller id (stable, deterministic).
      const suggestedTargetId =
        aCount === bCount ? (r.a_id < r.b_id ? r.a_id : r.b_id) : aCount >= bCount ? r.a_id : r.b_id;

      return {
        similarity: Number(r.sim),
        suggestedTargetId,
        a: {
          id: r.a_id,
          name: r.a_name,
          bizRegNo: r.a_biz,
          type: r.a_type,
          defaultCoaCode: r.a_coa,
          orderCount: aCount,
        },
        b: {
          id: r.b_id,
          name: r.b_name,
          bizRegNo: r.b_biz,
          type: r.b_type,
          defaultCoaCode: r.b_coa,
          orderCount: bCount,
        },
      };
    });

    return Response.json({
      items,
      query: { threshold, limit },
    });
  } catch (err) {
    return toResponse(err);
  }
}
