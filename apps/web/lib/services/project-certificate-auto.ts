/**
 * Project Certificate Auto-Generation (WI-325)
 *
 * When a project transitions to COMPLETED, the client has (by definition)
 * just earned the certificate that project was pursuing. This module maps
 * the project type to the corresponding certificate type and creates the
 * Certificate record, unless a valid one already exists.
 *
 * The hook is idempotent: re-running it for the same project will not
 * create duplicate certificates.
 */

import { prisma } from "@axle/db";
import type { Project, ProjectType } from "@prisma/client";
import { findValidCertificate } from "./certificate-checklist";

/**
 * Default years of validity for each project type's certificate.
 * `0` means "no expiry" — the certificate is issued once and stays valid
 * indefinitely (the validity date is stored as null).
 * Project types NOT in this map are considered non-certificate-producing
 * (e.g. BUSINESS_PLAN, FINANCIAL_ANALYSIS, RESEARCH_TASK, BUNDLE).
 */
const DEFAULT_VALIDITY_YEARS: Partial<Record<ProjectType, number>> = {
  VENTURE_CERT: 3,
  RESEARCH_INSTITUTE: 0,
  PATENT: 20,
  SOBOOJANG_CERT: 3,
};

/**
 * Human-readable certificate type that will be stored in `Certificate.type`.
 * Stable across locales — used to match existing certificates for renewal.
 */
const CERTIFICATE_TYPE_BY_PROJECT: Partial<Record<ProjectType, string>> = {
  VENTURE_CERT: "벤처기업확인서",
  RESEARCH_INSTITUTE: "기업부설연구소 인정서",
  PATENT: "특허등록증",
  SOBOOJANG_CERT: "소부장 확인서",
};

export interface AutoCertificateResult {
  /** Certificate was created by this call. */
  created: boolean;
  /** Certificate row id (existing or new). Null if the project type has no mapping. */
  certificateId: string | null;
  /** Reason the certificate wasn't created, when `created === false`. */
  reason?: "UNSUPPORTED_TYPE" | "ALREADY_EXISTS" | "BUNDLE_SKIPPED";
}

/**
 * Returns the certificate type string for a project type, or null when the
 * project type doesn't map to an issuable certificate.
 */
export function certificateTypeForProject(
  projectType: ProjectType,
): string | null {
  return CERTIFICATE_TYPE_BY_PROJECT[projectType] ?? null;
}

/**
 * Inverse of `certificateTypeForProject` — resolves a Certificate.type string
 * back to the ProjectType that would renew it. Used by the renewal cron
 * (WI-326) to decide which project type to create when a certificate is
 * nearing expiry.
 */
export function projectTypeForCertificate(
  certificateType: string,
): ProjectType | null {
  for (const [projectType, certType] of Object.entries(
    CERTIFICATE_TYPE_BY_PROJECT,
  )) {
    if (certType === certificateType) return projectType as ProjectType;
  }
  return null;
}

/**
 * Default renewal lead time — we begin prompting for renewal this many days
 * before the certificate expires.
 */
export const DEFAULT_RENEWAL_LEAD_DAYS = 90;

/**
 * Compute the `validTo` date for a newly issued certificate. Returns null
 * when the cert has no expiration (e.g. 기업부설연구소 인정서).
 */
function computeValidTo(projectType: ProjectType, issuedAt: Date): Date | null {
  const years = DEFAULT_VALIDITY_YEARS[projectType];
  if (years === undefined || years === 0) return null;
  const validTo = new Date(issuedAt);
  validTo.setFullYear(validTo.getFullYear() + years);
  return validTo;
}

/**
 * Create a Certificate record for the given project if:
 *   - The project type maps to a known certificate type
 *   - The client does NOT already have a valid active certificate of that type
 *
 * BUNDLE projects are intentionally skipped — their children each trigger
 * this hook independently, so creating a Certificate for the parent would
 * double-issue.
 *
 * ── Precedence vs the checklist-upload path (WI-335-fix H1) ──────────────
 * Two paths can mint a Certificate for the same `(client, type)` pair:
 *
 *   1. THIS function — fired on `project.status = COMPLETED`. `subjectName`
 *      is the project title (e.g. "JET 벤처기업 인증 신청"). Skipped when a
 *      valid active cert already exists.
 *
 *   2. `fulfillCertificateUpload` (certificate-checklist.ts) — fired when the
 *      consultant uploads the actual PDF via the checklist CERTIFICATE item.
 *      `subjectName` comes from the user's input. Always supersedes the
 *      currently-active cert by flipping `isActive = false` on prior rows
 *      and inserting a new active row.
 *
 * Sequence outcomes (verified by `__tests__/services/cert-issue-precedence.test.ts`):
 *
 *   • COMPLETED → upload  → 1 active cert with user-supplied subjectName
 *                            (auto cert was deactivated on upload)
 *   • upload    → COMPLETED → 1 active cert with user-supplied subjectName
 *                            (auto skipped because valid cert already existed)
 *
 * Both sequences converge on the same end state; user-supplied `subjectName`
 * always wins. The checklist-upload path is the canonical writer once a real
 * certificate exists.
 */
export async function autoCreateCertificateFromProject(
  project: Pick<Project, "id" | "type" | "clientId" | "title">,
  options: { issuedAt?: Date } = {},
): Promise<AutoCertificateResult> {
  if (project.type === "BUNDLE") {
    return { created: false, certificateId: null, reason: "BUNDLE_SKIPPED" };
  }

  const certificateType = certificateTypeForProject(project.type);
  if (!certificateType) {
    return { created: false, certificateId: null, reason: "UNSUPPORTED_TYPE" };
  }

  // Idempotency: skip when a non-expired active certificate of this type
  // already exists for the client (regardless of which project created it).
  const existing = await findValidCertificate(project.clientId, certificateType);
  if (existing) {
    return {
      created: false,
      certificateId: existing.id,
      reason: "ALREADY_EXISTS",
    };
  }

  const issuedAt = options.issuedAt ?? new Date();

  const cert = await prisma.certificate.create({
    data: {
      clientId: project.clientId,
      type: certificateType,
      subjectName: project.title,
      validFrom: issuedAt,
      validTo: computeValidTo(project.type, issuedAt),
      isActive: true,
    },
    select: { id: true },
  });

  return { created: true, certificateId: cert.id };
}
