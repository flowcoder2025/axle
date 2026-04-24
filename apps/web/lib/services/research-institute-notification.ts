/**
 * WI-311: Research Institute Notification auto-fill pipeline.
 *
 * Pulls Client + `masterProfile.researchInstitute` out of the database and
 * shapes them into the input expected by
 * `generateResearchInstituteNotificationDocx` (`@axle/docgen`, WI-311).
 *
 * Auto-filled from structured DB columns:
 *   - companyInfo (name, ceo, business number, founded, address)
 *
 * Pulled from `masterProfile.researchInstitute` (free-form JSON, owned by the
 * future institute-edit UI but already populated by any consultant who saves
 * overrides):
 *   - companyInfo.instituteName / instituteAddress / instituteAreaSqm /
 *     instituteFoundedDate
 *   - overview
 *   - rdFields[]
 *   - coreTechnologies[]
 *   - projects[]
 *   - researchers[]
 *
 * Numeric fields (currently just `instituteAreaSqm`) use the same three-way
 * signal as WI-302's venture slice:
 *   - `undefined` (absent) → no value supplied
 *   - `null`               → explicitly empty (editor cleared it)
 *   - `number`             → explicit value
 *
 * The masterProfile JSON column is shared with other features (org-chart,
 * client-profile, venture). This module never writes to it; saving overrides
 * is owned by the future institute-edit UI. WI-311 also adds
 * `researchInstitute` to PRESERVED_KEYS in the profile PATCH route so a
 * save from the client-profile form does not wipe the slice.
 */

import { prisma } from "@axle/db";
import type {
  ResearchInstituteNotificationInput,
  ResearchInstituteRDField,
  ResearchInstituteCoreTechnology,
  ResearchInstituteProject,
  ResearchInstituteResearcher,
} from "@axle/docgen";

/**
 * Shape of the `researchInstitute` slice we read out of `Client.masterProfile`.
 * Every field is optional — the editor may fill it incrementally.
 */
export interface MasterProfileResearchInstituteSlice {
  instituteName?: string;
  instituteAddress?: string;
  /** `null` = explicitly empty, `undefined` = missing. */
  instituteAreaSqm?: number | null;
  /** ISO date (YYYY-MM-DD) */
  instituteFoundedDate?: string;
  overview?: string;
  rdFields?: ResearchInstituteRDField[];
  coreTechnologies?: ResearchInstituteCoreTechnology[];
  projects?: ResearchInstituteProject[];
  researchers?: ResearchInstituteResearcher[];
}

/**
 * Resolve a value with three-way semantics:
 *   - explicit value → use it
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

function isoDate(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

function readInstituteSlice(
  masterProfile: unknown,
): MasterProfileResearchInstituteSlice {
  if (!masterProfile || typeof masterProfile !== "object") return {};
  const v = (masterProfile as Record<string, unknown>).researchInstitute;
  if (!v || typeof v !== "object") return {};
  return v as MasterProfileResearchInstituteSlice;
}

export async function buildResearchInstituteNotificationInput(
  clientId: string,
): Promise<ResearchInstituteNotificationInput> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const institute = readInstituteSlice(client.masterProfile);

  return {
    companyInfo: {
      companyName: client.name,
      ceoName: client.ceoName ?? "",
      foundedDate: isoDate(client.foundedDate),
      businessNumber: client.businessNumber ?? undefined,
      address: client.address ?? undefined,
      instituteName: institute.instituteName,
      instituteAddress: institute.instituteAddress,
      instituteAreaSqm: resolveOverride(institute.instituteAreaSqm, undefined),
      instituteFoundedDate: institute.instituteFoundedDate,
    },
    overview: institute.overview,
    rdFields: institute.rdFields,
    coreTechnologies: institute.coreTechnologies,
    projects: institute.projects,
    researchers: institute.researchers,
  };
}
