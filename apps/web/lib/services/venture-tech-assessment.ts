/**
 * WI-302: Venture Tech Assessment auto-fill pipeline.
 *
 * Pulls Client + ClientFinancial + ClientAchievement + masterProfile.venture
 * out of the database and shapes them into the input expected by
 * `generateVentureTechAssessmentDocx` (`@axle/docgen`, WI-301).
 *
 * Auto-filled from structured DB columns:
 *   - companyInfo (name, ceo, business number, founded, address, capital)
 *   - finance (most recent 3 years, ascending)
 *   - achievements.employeeCount
 *   - intellectualProperty.patents (counted from ClientAchievement)
 *
 * Pulled from `masterProfile.venture` (free-form JSON written by the editor):
 *   - sections (per-section body text — id keyed by VENTURE_BUSINESS_PLAN_SECTIONS)
 *   - checks (problemImportance / productDifferentiation / fundingSources)
 *   - achievements.domesticSales / achievements.exports (when not equal to revenue)
 *   - intellectualProperty.trademarks / designs / softwareCopyrights
 *
 * The masterProfile JSON column is shared with other features (org-chart,
 * client-profile). This module never writes to it; saving venture overrides
 * is owned by the assessment-edit API (WI-303).
 */

import { prisma } from "@axle/db";
import type {
  VentureTechAssessmentInput,
  VentureTechAssessmentChecks,
  VentureTechAssessmentFinanceRow,
} from "@axle/docgen";

/**
 * Shape of the `venture` slice we read out of `Client.masterProfile`. Every
 * field is optional — the editor may fill it incrementally.
 *
 * Number fields use a **three-way signal** for fallbacks (WI-332-fix M4):
 *   - `undefined` (or absent) → auto-fill from DB columns when applicable
 *   - `null`                  → explicitly empty, no fallback (user cleared it)
 *   - `number`                → explicit override
 *
 * This distinction matters for `domesticSales`, which would otherwise fall
 * back to the most recent year's revenue and silently disagree with what the
 * editor saw on screen.
 */
export interface MasterProfileVentureSlice {
  sections?: Record<string, string>;
  checks?: VentureTechAssessmentChecks;
  achievements?: {
    /** `null` = explicitly empty (no revenue fallback). */
    domesticSales?: number | null;
    exports?: number | null;
  };
  ip?: {
    trademarks?: number | null;
    designs?: number | null;
    softwareCopyrights?: number | null;
    /** When supplied, overrides the count derived from ClientAchievement. */
    patents?: number | null;
  };
}

/**
 * Convert a Prisma Decimal / string / number column into a plain JS Number,
 * asserting that no precision is lost in the process.
 *
 * We surface an explicit error (rather than returning a silently-truncated
 * value) when the input exceeds JS safe-integer range. Korean 자본금 fields
 * for large holding companies routinely exceed `Number.MAX_SAFE_INTEGER`
 * (2^53 - 1 ≈ 9.007 × 10^15) — silently rounding to the nearest representable
 * double would produce a wrong number on the official form.
 *
 * Note: `Number(null) === 0`, so we must guard `value == null` first; the
 * `Number.isFinite` check then handles only non-finite results (NaN, ±∞).
 */
function decimalToNumber(value: unknown): number | undefined {
  if (value == null) return undefined;

  // Prisma Decimal exposes `.toString()`; plain numbers/strings work too.
  const str =
    typeof value === "object" && value !== null && "toString" in value
      ? (value as { toString(): string }).toString()
      : String(value);

  const n = Number(str);
  if (!Number.isFinite(n)) return undefined;

  if (Math.abs(n) > Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `Numeric value exceeds JS safe integer range (${str}). ` +
        `Refusing to convert to Number to avoid silent precision loss.`,
    );
  }

  return n;
}

function isoDate(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

function readVentureSlice(masterProfile: unknown): MasterProfileVentureSlice {
  if (!masterProfile || typeof masterProfile !== "object") return {};
  const v = (masterProfile as Record<string, unknown>).venture;
  if (!v || typeof v !== "object") return {};
  return v as MasterProfileVentureSlice;
}

/**
 * Resolve a number with three-way semantics (WI-334-feat M4):
 *   - explicit number → use it
 *   - explicit `null` → "explicitly empty"; never fall back
 *   - `undefined`     → fall back to the auto-derived value
 */
function resolveOverride<T>(
  override: T | null | undefined,
  fallback: T | undefined,
): T | undefined {
  if (override === null) return undefined;
  return override ?? fallback;
}

export async function buildVentureTechAssessmentInput(
  clientId: string,
): Promise<VentureTechAssessmentInput> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      // Take only the 3 most recent years; we sort ASC for the report.
      financials: { orderBy: { year: "desc" }, take: 3 },
      achievements: true,
    },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const venture = readVentureSlice(client.masterProfile);

  const finance: VentureTechAssessmentFinanceRow[] = client.financials
    .map((f) => ({
      year: f.year,
      revenue: decimalToNumber(f.revenue),
      operatingProfit: decimalToNumber(f.operatingProfit),
      netProfit: decimalToNumber(f.netProfit),
    }))
    .sort((a, b) => a.year - b.year);

  const patentCount = client.achievements.filter(
    (a) => a.type === "PATENT",
  ).length;

  // Most recent year's revenue is the natural domestic sales fallback when the
  // editor hasn't entered a separate figure.
  const mostRecentRevenue =
    finance.length > 0 ? finance[finance.length - 1].revenue : undefined;

  return {
    companyInfo: {
      companyName: client.name,
      ceoName: client.ceoName ?? "",
      foundedDate: isoDate(client.foundedDate),
      businessNumber: client.businessNumber ?? undefined,
      address: client.address ?? undefined,
      capitalAmount: decimalToNumber(client.capitalAmount),
    },
    sections: venture.sections ?? {},
    checks: venture.checks ?? {},
    finance,
    achievements: {
      // null override = "explicitly empty"; undefined = fall back to revenue
      domesticSales: resolveOverride(
        venture.achievements?.domesticSales,
        mostRecentRevenue,
      ),
      exports: resolveOverride(venture.achievements?.exports, undefined),
      employeeCount: client.employeeCount ?? undefined,
    },
    intellectualProperty: {
      // Editor override wins; otherwise count PATENT-type achievements.
      patents: resolveOverride(venture.ip?.patents, patentCount),
      trademarks: resolveOverride(venture.ip?.trademarks, undefined),
      designs: resolveOverride(venture.ip?.designs, undefined),
      softwareCopyrights: resolveOverride(
        venture.ip?.softwareCopyrights,
        undefined,
      ),
    },
  };
}
