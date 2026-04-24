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
 */
export interface MasterProfileVentureSlice {
  sections?: Record<string, string>;
  checks?: VentureTechAssessmentChecks;
  achievements?: {
    domesticSales?: number;
    exports?: number;
  };
  ip?: {
    trademarks?: number;
    designs?: number;
    softwareCopyrights?: number;
    /** When supplied, overrides the count derived from ClientAchievement. */
    patents?: number;
  };
}

function decimalToNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  // Prisma Decimal / string / number — Number() handles all three.
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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
      domesticSales:
        venture.achievements?.domesticSales ?? mostRecentRevenue,
      exports: venture.achievements?.exports,
      employeeCount: client.employeeCount ?? undefined,
    },
    intellectualProperty: {
      // Editor override wins; otherwise count PATENT-type achievements.
      patents: venture.ip?.patents ?? patentCount,
      trademarks: venture.ip?.trademarks,
      designs: venture.ip?.designs,
      softwareCopyrights: venture.ip?.softwareCopyrights,
    },
  };
}
