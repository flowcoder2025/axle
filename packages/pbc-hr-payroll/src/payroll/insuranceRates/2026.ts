/**
 * Korean 4대보험 rates for calendar year **2026** (forward-projected).
 *
 * Source / provenance:
 *   - 국민연금: 2025년 통과된 연금개혁법(보험료율 9% → 13% 단계적
 *     인상)은 2026년에 본격 발효되지 않음 (단계 인상 일정상). 1차 인상
 *     트리거가 2026년이 아니므로 2025년 부담률 4.5%를 유지로 본다.
 *     ※ 정부 공식 발표가 갱신되면 이 파일만 교체.
 *   - 건강보험: 보건복지부의 동결 기조 유지 가정 — 2025년과 동일한
 *     7.09% (가입자 3.545%).
 *   - 장기요양보험: 12.95% × 건강보험료 — 2026년 별도 인상 발표가
 *     없으므로 2025년 동일.
 *   - 고용보험: 실업급여 1.8% (노사 50:50). 가입자 0.9%.
 *   - 산재보험: 업종별 상이. 전업종 평균 1.47% (사업주 only).
 *
 * 키 컨벤션은 `PayrollResult.deductions`와 정렬된 camelCase
 * (WI-601 TARGET 핀). 정부의 차년도 요율 고시가 2025년 11월 ~ 12월에
 * 일괄 공표되면 위 가정을 갱신할 것.
 */

import type { InsuranceRates } from "../../types.js";

export const KOREAN_INSURANCE_RATES_2026: InsuranceRates = Object.freeze({
  year: 2026,
  nationalPension: 0.045,
  healthInsurance: 0.03545,
  longTermCare: 0.004591,
  employmentInsurance: 0.009,
  industrialAccident: 0.0147,
}) satisfies InsuranceRates;
