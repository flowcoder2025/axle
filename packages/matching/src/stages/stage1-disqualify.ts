import type { ClientProfile, ProgramProfile } from "../types.js";

export interface Stage1Result {
  disqualified: boolean;
  reasons: string[];
}

/**
 * Stage 1: Hard disqualification — instant rejection based on eligibility.
 * Any single failing criterion causes disqualification.
 */
export function stage1Disqualify(
  client: ClientProfile,
  program: ProgramProfile
): Stage1Result {
  const reasons: string[] = [];

  const eligibility = program.eligibility ?? {};

  // Region mismatch — if program specifies a region and client region differs
  if (
    program.region &&
    client.region &&
    program.region !== client.region
  ) {
    reasons.push(`지역 불일치: 프로그램(${program.region}) ≠ 기업(${client.region})`);
  }

  // Industry exclusion — eligibility.excludedIndustries list
  const excludedIndustries = eligibility["excludedIndustries"] as string[] | undefined;
  if (
    Array.isArray(excludedIndustries) &&
    client.industry &&
    excludedIndustries.includes(client.industry)
  ) {
    reasons.push(`산업 제외: ${client.industry}은(는) 지원 제외 업종입니다`);
  }

  // Required certifications — eligibility.requiredCertifications
  const requiredCerts = eligibility["requiredCertifications"] as string[] | undefined;
  if (Array.isArray(requiredCerts) && requiredCerts.length > 0) {
    const clientCerts = client.certifications ?? [];
    const missing = requiredCerts.filter((c) => !clientCerts.includes(c));
    if (missing.length > 0) {
      reasons.push(`필수 인증 미보유: ${missing.join(", ")}`);
    }
  }

  // Company size limits — eligibility.minEmployees / maxEmployees
  const minEmployees = eligibility["minEmployees"] as number | undefined;
  const maxEmployees = eligibility["maxEmployees"] as number | undefined;

  if (
    typeof minEmployees === "number" &&
    typeof client.employeeCount === "number" &&
    client.employeeCount < minEmployees
  ) {
    reasons.push(`임직원 수 미달: 최소 ${minEmployees}명 이상 필요 (현재 ${client.employeeCount}명)`);
  }

  if (
    typeof maxEmployees === "number" &&
    typeof client.employeeCount === "number" &&
    client.employeeCount > maxEmployees
  ) {
    reasons.push(`임직원 수 초과: 최대 ${maxEmployees}명 이하 필요 (현재 ${client.employeeCount}명)`);
  }

  // Venture-only programs
  if (eligibility["ventureOnly"] === true && !client.isVenture) {
    reasons.push("벤처기업 인증 필수: 미인증 기업은 지원 불가");
  }

  // InnoBiz-only programs
  if (eligibility["innoBizOnly"] === true && !client.isInnoBiz) {
    reasons.push("이노비즈 인증 필수: 미인증 기업은 지원 불가");
  }

  return {
    disqualified: reasons.length > 0,
    reasons,
  };
}
