/**
 * Chart of Accounts seed (Phase 21 WI-725).
 *
 * Curated subset of the 국세청 표준재무제표 v2024 chart that covers the
 * accounts AXLE consulting teams actually classify daily. The list is
 * intentionally modest (~30 entries) — operators add the long tail per
 * tenant via `POST /api/erp/chart-of-accounts`.
 *
 * Source: 국세청 (NTS) 표준재무제표 v2024 — https://www.nts.go.kr
 *
 * Coding scheme: NTS publishes a 4-digit hierarchical code per account.
 * We use 3-digit display codes derived from the NTS code's first three
 * digits, which is what consultants quote in Korean SMB practice. The
 * digits are kept as plain text (no leading-zero loss in JSON) and the
 * `parentCode` field encodes the hierarchy for depth-2 / depth-3 rollups.
 *
 * The list is treated as constants — the seed function writes the rows
 * verbatim with `isSystem=true` so the CRUD route can refuse user edits.
 */

import type { Prisma } from "@prisma/client";

export const COA_SOURCE = "국세청 표준재무제표 v2024" as const;

export interface CoaSeedEntry {
  code: string;
  name: string;
  category: "REVENUE" | "COGS" | "OPEX" | "NON_OPERATING" | "OTHER";
  parentCode: string | null;
}

/**
 * Canonical seed list. Add new entries in numeric (code) order so reading
 * the file mirrors the NTS layout. Editing existing rows is intentionally
 * disruptive — any change here must be coordinated with a migration that
 * re-seeds existing tenants (see notes on seed idempotency below).
 */
export const COA_SEED: readonly CoaSeedEntry[] = [
  // ── Revenue (매출) ──────────────────────────────────────────────────
  { code: "400", name: "매출", category: "REVENUE", parentCode: null },
  { code: "401", name: "상품매출", category: "REVENUE", parentCode: "400" },
  { code: "402", name: "제품매출", category: "REVENUE", parentCode: "400" },
  { code: "404", name: "용역매출", category: "REVENUE", parentCode: "400" },

  // ── Cost of goods sold (매출원가) ──────────────────────────────────
  { code: "450", name: "매출원가", category: "COGS", parentCode: null },
  { code: "451", name: "상품매입", category: "COGS", parentCode: "450" },
  { code: "452", name: "원재료매입", category: "COGS", parentCode: "450" },
  { code: "455", name: "외주가공비", category: "COGS", parentCode: "450" },

  // ── Operating expenses (판매비와관리비) ────────────────────────────
  { code: "500", name: "판매비와관리비", category: "OPEX", parentCode: null },
  { code: "501", name: "급여", category: "OPEX", parentCode: "500" },
  { code: "511", name: "복리후생비", category: "OPEX", parentCode: "500" },
  { code: "512", name: "여비교통비", category: "OPEX", parentCode: "500" },
  { code: "513", name: "접대비", category: "OPEX", parentCode: "500" },
  { code: "514", name: "통신비", category: "OPEX", parentCode: "500" },
  { code: "515", name: "수도광열비", category: "OPEX", parentCode: "500" },
  { code: "517", name: "세금과공과", category: "OPEX", parentCode: "500" },
  { code: "518", name: "감가상각비", category: "OPEX", parentCode: "500" },
  { code: "519", name: "임차료", category: "OPEX", parentCode: "500" },
  { code: "520", name: "보험료", category: "OPEX", parentCode: "500" },
  { code: "521", name: "차량유지비", category: "OPEX", parentCode: "500" },
  { code: "522", name: "운반비", category: "OPEX", parentCode: "500" },
  { code: "523", name: "광고선전비", category: "OPEX", parentCode: "500" },
  { code: "524", name: "도서인쇄비", category: "OPEX", parentCode: "500" },
  { code: "525", name: "회의비", category: "OPEX", parentCode: "500" },
  { code: "529", name: "사무용품비", category: "OPEX", parentCode: "500" },
  { code: "530", name: "소모품비", category: "OPEX", parentCode: "500" },
  { code: "531", name: "지급수수료", category: "OPEX", parentCode: "500" },
  { code: "532", name: "수선비", category: "OPEX", parentCode: "500" },

  // ── Non-operating (영업외) ─────────────────────────────────────────
  { code: "900", name: "영업외수익", category: "NON_OPERATING", parentCode: null },
  { code: "901", name: "이자수익", category: "NON_OPERATING", parentCode: "900" },
  { code: "905", name: "잡이익", category: "NON_OPERATING", parentCode: "900" },
  { code: "950", name: "영업외비용", category: "NON_OPERATING", parentCode: null },
  { code: "951", name: "이자비용", category: "NON_OPERATING", parentCode: "950" },
  { code: "955", name: "잡손실", category: "NON_OPERATING", parentCode: "950" },

  // ── Other (기타) ────────────────────────────────────────────────────
  { code: "999", name: "기타", category: "OTHER", parentCode: null },
];

/** Tx surface the seed function actually uses. Tests inject a stub. */
export type CoaSeedTxClient = Pick<Prisma.TransactionClient, "chartOfAccounts">;

/**
 * Idempotently insert the system seed for `orgId`. Returns the number of
 * rows inserted (0 when the org already has the full seed). Existing
 * isSystem rows are NEVER overwritten — to roll out an updated seed,
 * issue a follow-up migration that retires deprecated codes via
 * `effectiveTo` instead of mutating them in place.
 *
 * The function is safe to call concurrently for the same orgId: the
 * `(orgId, code)` unique constraint serializes the inserts and we catch
 * `P2002` per-row so a concurrent partial seed completes cleanly.
 */
export async function seedSystemChartOfAccounts(
  tx: CoaSeedTxClient,
  orgId: string,
): Promise<{ inserted: number; existed: number }> {
  // Cheap fast path: if we already have the full seed for this org, skip
  // the per-row check + INSERT cycle entirely.
  const existingSystemCount = await tx.chartOfAccounts.count({
    where: { orgId, isSystem: true },
  });
  if (existingSystemCount >= COA_SEED.length) {
    return { inserted: 0, existed: existingSystemCount };
  }

  let inserted = 0;
  for (const row of COA_SEED) {
    try {
      await tx.chartOfAccounts.create({
        data: {
          orgId,
          code: row.code,
          name: row.name,
          category: row.category,
          parentCode: row.parentCode,
          source: COA_SOURCE,
          isSystem: true,
        },
      });
      inserted += 1;
    } catch (err: unknown) {
      // P2002 on (orgId, code) means another caller (or a prior partial
      // seed) already inserted this row — treat as success and move on.
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }
  return { inserted, existed: existingSystemCount };
}
