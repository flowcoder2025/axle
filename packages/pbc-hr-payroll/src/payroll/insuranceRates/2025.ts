/**
 * Korean 4대보험 rates for calendar year **2025** (officially confirmed).
 *
 * Source / provenance:
 *   - 국민연금공단 (NPS) — 가입자 부담률 4.5% (총 9% 노사 분담).
 *   - 보건복지부 / 건강보험공단 — 2025년 건강보험료율 7.09% (가입자 3.545%).
 *     2025년 동결 결정, 2024년과 동일.
 *   - 장기요양보험료율 12.95% × 건강보험료 (2025년 동결).
 *     → 가입자 부담 of gross = 0.03545 × 0.1295 ≈ 0.004591.
 *   - 고용노동부 — 실업급여 1.8% (노사 50:50). 가입자 0.9%.
 *     ※ 고용안정·직업능력개발 surcharge (0.25 ~ 0.85%)는 사업주 only,
 *       이 row에 포함하지 않는다.
 *   - 산재보험 — 업종별 상이; 전업종 평균 1.47% (2025년) 사업주 only.
 *
 * 키 컨벤션은 `PayrollResult.deductions`와 정렬된 camelCase
 * (WI-601 TARGET 핀). 각 rate은 `gross × rate` 로 가입자 공제액을
 * 계산할 수 있도록 **gross 대비 분수**로 표현한다.
 */

import type { InsuranceRates } from "../../types.js";

export const KOREAN_INSURANCE_RATES_2025: InsuranceRates = Object.freeze({
  year: 2025,
  nationalPension: 0.045,
  healthInsurance: 0.03545,
  longTermCare: 0.004591,
  employmentInsurance: 0.009,
  industrialAccident: 0.0147,
}) satisfies InsuranceRates;
