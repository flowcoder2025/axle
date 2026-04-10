import type { ClientProfile, ProgramProfile } from "../types.js";

export interface Stage3Result {
  score: number;
  reasons: string[];
}

/**
 * Stage 3: Positive scoring — add points for good matches.
 * Base score starts at 0; max achievable is 100.
 */
export function stage3Scoring(
  client: ClientProfile,
  program: ProgramProfile
): Stage3Result {
  let score = 0;
  const reasons: string[] = [];

  const requirements = program.requirements ?? {};

  // Region match (+15)
  if (program.region && client.region && program.region === client.region) {
    score += 15;
    reasons.push(`지역 일치: ${client.region} (+15점)`);
  }

  // Industry alignment (+20) — program targets exactly client's industry
  const targetIndustries = requirements["targetIndustries"] as string[] | undefined;
  if (
    Array.isArray(targetIndustries) &&
    client.industry &&
    targetIndustries.includes(client.industry)
  ) {
    score += 20;
    reasons.push(`산업 분야 일치: ${client.industry} (+20점)`);
  }

  // Revenue in target range (+15) — only when program specifies at least one revenue bound
  const minRevenue = requirements["minRevenue"] as number | undefined;
  const maxRevenue = requirements["maxRevenue"] as number | undefined;
  const hasRevenueBound = typeof minRevenue === "number" || typeof maxRevenue === "number";
  if (hasRevenueBound && typeof client.revenue === "number" && client.revenue > 0) {
    const aboveMin = typeof minRevenue !== "number" || client.revenue >= minRevenue;
    const belowMax = typeof maxRevenue !== "number" || client.revenue <= maxRevenue;
    if (aboveMin && belowMax) {
      score += 15;
      reasons.push(`매출 범위 적합 (+15점)`);
    }
  }

  // Certification bonus (+10 each)
  const certBonuses = requirements["certBonuses"] as string[] | undefined;
  if (Array.isArray(certBonuses) && (client.certifications?.length ?? 0) > 0) {
    const clientCerts = client.certifications ?? [];
    const matched = certBonuses.filter((c) => clientCerts.includes(c));
    if (matched.length > 0) {
      const points = matched.length * 10;
      score += points;
      reasons.push(`인증 보너스: ${matched.join(", ")} (+${points}점)`);
    }
  }

  // Venture/InnoBiz bonus when program category aligns (+10)
  if (program.category === "VENTURE" && client.isVenture) {
    score += 10;
    reasons.push("벤처기업 인증 보유 — 벤처 전용 프로그램 적합 (+10점)");
  }

  if (program.category === "CERTIFICATION" && client.isInnoBiz) {
    score += 10;
    reasons.push("이노비즈 인증 보유 — 인증 프로그램 적합 (+10점)");
  }

  return { score, reasons };
}
