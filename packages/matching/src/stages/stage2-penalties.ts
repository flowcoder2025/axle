import type { ClientProfile, ProgramProfile } from "../types.js";

export interface Penalty {
  reason: string;
  points: number;
}

export interface Stage2Result {
  penalties: Penalty[];
  totalPenalty: number;
}

/**
 * Stage 2: Soft penalties — reduce score for partial mismatches.
 * None of these individually disqualify the applicant.
 */
export function stage2Penalties(
  client: ClientProfile,
  program: ProgramProfile
): Stage2Result {
  const penalties: Penalty[] = [];

  const requirements = program.requirements ?? {};

  // Weak industry match — program specifies target industries but client is not a strong match
  const targetIndustries = requirements["targetIndustries"] as string[] | undefined;
  if (
    Array.isArray(targetIndustries) &&
    targetIndustries.length > 0 &&
    client.industry &&
    !targetIndustries.includes(client.industry)
  ) {
    penalties.push({ reason: "산업 분야 약한 일치: 주력 대상 업종과 차이 있음", points: 10 });
  }

  // No recent financial data — revenue is undefined or zero
  if (
    client.revenue === undefined ||
    client.revenue === null ||
    client.revenue === 0
  ) {
    penalties.push({ reason: "최근 재무 데이터 없음: 매출 정보 미입력", points: 5 });
  }

  // Low employee count relative to program target
  const targetMinEmployees = requirements["targetMinEmployees"] as number | undefined;
  if (
    typeof targetMinEmployees === "number" &&
    typeof client.employeeCount === "number" &&
    client.employeeCount < targetMinEmployees
  ) {
    penalties.push({
      reason: `임직원 수 목표 대비 부족: 권장 ${targetMinEmployees}명 이상 (현재 ${client.employeeCount}명)`,
      points: 5,
    });
  }

  const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0);

  return { penalties, totalPenalty };
}
