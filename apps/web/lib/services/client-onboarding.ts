/**
 * client-onboarding.ts
 *
 * Prepares the onboarding checklist data when a new client is created.
 * Phase 1: data preparation and logging only.
 * Phase 4: actual email dispatch will be wired via packages/email.
 */

export const DEFAULT_ONBOARDING_ITEMS = [
  { name: "NDA (비밀유지계약)", isRequired: true },
  { name: "사업자등록증 사본", isRequired: true },
  { name: "기업 소개서", isRequired: false },
  { name: "대표자 신분증 사본", isRequired: true },
  { name: "최근 3년 재무제표", isRequired: true },
] as const;

export interface OnboardingChecklistPayload {
  clientId: string;
  orgId: string;
  items: ReadonlyArray<{ name: string; isRequired: boolean }>;
  initiatedAt: string;
}

/**
 * Prepares and logs the onboarding checklist for a newly created client.
 *
 * This function is intentionally fire-and-forget — it must not throw so that
 * errors here never block the 201 client-creation response.
 *
 * NOTE: Email delivery is deferred to Phase 4 (packages/email integration).
 */
export async function sendOnboardingChecklist(
  clientId: string,
  orgId: string
): Promise<void> {
  try {
    const payload: OnboardingChecklistPayload = {
      clientId,
      orgId,
      items: DEFAULT_ONBOARDING_ITEMS,
      initiatedAt: new Date().toISOString(),
    };

    // Phase 4 TODO: replace this log with actual email dispatch via packages/email
    console.info("[onboarding] checklist prepared", payload);
  } catch (err) {
    // Swallow errors to keep client creation unaffected
    console.error("[onboarding] failed to prepare checklist", { clientId, orgId, err });
  }
}
