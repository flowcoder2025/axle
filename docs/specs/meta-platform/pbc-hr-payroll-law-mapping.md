# Korean Labor Law Mapping — `@axle/pbc-hr-payroll`

This is the **single source of truth** for the regulatory baseline encoded in the PBC. Every rate constant, allocation rule, and validation check has a row here pointing back to the statute it implements; if a clause changes, update this table first, then the constant, then the fixture.

> Generated under WI-610 (Phase 19). Cross-references: package [README](../../../packages/pbc-hr-payroll/README.md), spec [pbc-hr-payroll.md](./pbc-hr-payroll.md).

## Conventions

- **Statute** uses the Korean short name (e.g. `근로기준법`); the English label is in parentheses on first use only.
- **Clause** column lists the article number; subsections are inlined where the rule depends on them.
- **PBC symbol** is `package@path:export` so a `grep` finds the implementation in one shot.
- **Source** links to the official Ministry / Korea Law Information Center page or the published table the constant snapshots.
- 표의 모든 율(rate)은 **fraction of gross** (예: `0.045` = 4.5%) 으로 정규화되어 있어 `gross × rate` 로 직접 곱할 수 있다.

---

## 1. 4대보험 요율 (Insurance rates)

전부 `getInsuranceRatesForYear(year).<key>` 로 노출. 산재(`industrialAccident`)는 사업주 부담만이라 `PayrollResult.deductions` 에는 포함하지 않고 reporting 용도로만 보유.

| 항목 | 부담 주체 | 통계 (2025) | PBC 상수 (2025) | PBC 상수 (2026) | 법령 / 출처 |
|---|---|---|---|---|---|
| 국민연금 (National Pension, employee) | 근로자 | 4.5% (총 9% 노사 절반) | `KOREAN_INSURANCE_RATES_2025.nationalPension` = `0.045` | `KOREAN_INSURANCE_RATES_2026.nationalPension` = `0.045` (연금개혁 단계 인상 트리거 미발효 가정) | 국민연금법 제88조 — 가입자 부담률 (NPS 발표) |
| 건강보험 (Health Insurance, employee) | 근로자 | 3.545% (총 7.09%) | `KOREAN_INSURANCE_RATES_2025.healthInsurance` = `0.03545` | 동결 가정 — `0.03545` | 건강보험법 제73조 + 보건복지부 2025년 동결 결정 |
| 장기요양 (Long-term Care, employee) | 근로자 | 0.4591% of gross (= 건강보험료 × 12.95%, 절반) | `KOREAN_INSURANCE_RATES_2025.longTermCare` = `0.004591` | 동결 가정 — `0.004591` | 노인장기요양보험법 제8조; 보건복지부 고시 2024-217호 (장기요양보험료율 12.95%) |
| 고용보험 — 실업급여 (Employment Insurance, employee) | 근로자 | 0.9% (총 1.8% 노사 절반) | `KOREAN_INSURANCE_RATES_2025.employmentInsurance` = `0.009` | `0.009` | 고용보험법 제15조 + 시행령 제12조 — 실업급여 비율; **고용안정·직업능력개발 surcharge (사업주 0.25 ~ 0.85%)** 는 본 row 에 포함하지 않음 |
| 산재 (Industrial Accident, employer) | 사업주 only | 평균 1.47% (전업종 평균, 업종별 상이) | `KOREAN_INSURANCE_RATES_2025.industrialAccident` = `0.0147` | `0.0147` | 산업재해보상보험법 제5조 + 고용노동부 매년 고시 |

**Why 장기요양 = `0.004591`**: 장기요양보험료 = 건강보험료 × 12.95% (2025년 율). gross 대비로는 `0.03545 × 0.1295 ≈ 0.00459078` 인데 이를 4-자리에서 절상하면 `0.004591`. 이 derivation 은 `__tests__/insuranceRates.test.ts` 의 invariant 로 핀.

---

## 2. 가산임금 (Premium pay) — `calculatePayroll`

| 가산 종류 | 비율 | PBC 위치 | 법령 |
|---|---|---|---|
| 연장근로 (overtime) | 통상시급 × 1.5 | `src/payroll/calculate.ts` (`overtimeHours × ordinaryHourlyWage × 1.5`) | 근로기준법 제56조 ① |
| 휴일근로 ≤ 8h (공휴) | 통상시급 × 1.5 | `src/payroll/calculate.ts` (`holidayHours × ordinaryHourlyWage × 1.5`) | 근로기준법 제56조 ② 본문 |
| 통상시급 (월급제) | `baseSalary / 209` | `src/payroll/deductions.ts:computeOrdinaryHourlyWage` | 근로기준법 시행령 제6조 (월 소정근로시간 209h: 주 40h × 52w / 12m + 주휴 35.67h ≈ 209) |

> 휴일근로 8h 초과분의 100% 가산 (근로기준법 제56조 ② 단서) 은 본 PBC 의 1차 범위 밖 (Out of Scope, spec §6). 후속 PBC 에서 처리.

---

## 3. 소득세 (Income tax) — 간이 근사

`calculateMonthlyIncomeTax(monthlyTaxable)` 는 **간이세액표 lookup 의 stand-in** 이다. 정확한 국세청 간이세액표는 (월급여, 부양가족수) 키의 수천 행 테이블이라 본 WI 범위에서 풀 테이블을 싣지 않았다.

| 단계 | 적용 | 출처 |
|---|---|---|
| 근로소득공제 (employment income deduction) | `min(annual_taxable × 0.30, 14_750_000)` | 소득세법 제47조 의 근사. 실제 표는 5단 누진 (5,000만 초과 ~ 1억은 0.05 등). 5,000만 미만 구간을 단일 30% 로 평탄화. |
| 본인 인적공제 (personal deduction) | `1_500_000` | 소득세법 제50조 ① — 본인 1.5M 만 적용 (부양가족 미반영). |
| 종합소득세 누진세 (brackets) | 6 / 15 / 24 / 35 / 38 / 40 / 42 / 45 % | 소득세법 제55조 ① (2026년 기준; 1,400만/5,000만/8,800만/1.5억/3억/5억/10억 경계). |
| 근로소득세액공제 (tax credit) | `min(annual_tax × 0.55, 740_000)` | 소득세법 제59조 — 근로소득세액공제. 13,000원 ~ 130만원 누진은 `0.55` 단일 비율로 평탄화 + 740k 캡 적용. |
| 월별 환산 | `floor(annualWithholding / 12)` | 매월 균등 원천징수 가정. |
| 지방소득세 | `floor(incomeTax × 0.1)` | 지방세법 제93조 (소득분 = 소득세 × 10%). |

**한계**: 위 근사는 월급 200만 ~ 600만 구간에서 실제 간이세액표 대비 **약 +20% 과대 추정** 한다 (보수적). 실제 사용자 화면에 띄울 때는 `incomeTax` 옆에 "간이 추정" 배지를 함께 표시할 것. WI-610 후속에서 실제 lookup 으로 교체 예정.

---

## 4. 연차 (Annual leave) — `createKoreanLeavePolicy.resolveAnnualGrant`

| 근속 | 부여 일수 | PBC 출력 | 법령 |
|---|---|---|---|
| < 1년 | 월 1일씩, 최대 11일 | `tenureYears < 1 → 11` | 근로기준법 제60조 ② (월 만근 시 1일 발생, 1년 미만은 누적 최대 11일) |
| 1년 ~ 3년 미만 | 15일 | `tenureYears = 1, 2 → 15` | 근로기준법 제60조 ① |
| 3년 이상 | 15 + (tenure-1)/2 (정수내림), 25일 cap | `tenureYears = 3 → 16, 5 → 17, 21+ → 25` | 근로기준법 제60조 ④ (가산휴가 매 2년당 1일, 25일 cap) |

> 1년 80% 미만 출근의 비례 차감(근로기준법 제60조 ② 단서) 은 본 1차 범위 밖. 출근율을 입력 받으면 적용 가능하도록 정책 인터페이스 (`LeaveAllocationPolicy`) 는 열려 있음.

## 5. 기타 휴가 — `createKoreanLeavePolicy.resolveOtherGrant`

| LeaveType | 부여 | PBC 상수 | 법령 |
|---|---|---|---|
| `MATERNITY` (출산휴가) | 90일 (다태아 120일 — 본 PBC 미반영) | `90` | 근로기준법 제74조 ① + 남녀고용평등법 제18조 |
| `PATERNITY` (배우자 출산휴가) | 10일 (2026년 기준) | `10` | 남녀고용평등법 제18조의2 (2024년 개정 — 5일 → 10일 인상) |
| `CONDOLENCE` (경조사) | 5일 (org 기본) | `5` | 법정 무관 — 단체협약/취업규칙 통상 (org 별도 override 가능) |
| `SICK` (병가) | 0일 (무급) | `0` | 법정 무관 — 취업규칙으로 관리 |
| `OTHER` | 0일 | `0` | org 별도 정책 |

---

## 6. 근태 (Attendance) — verifications

| 검증 | 규칙 | PBC 위치 | 법령 / 근거 |
|---|---|---|---|
| 1주 소정근로시간 | 40h 기준 | `apps/flowteams` 스케줄 wiring 시 적용 | 근로기준법 제50조 ① |
| 통상시급 환산 | 월급 / 209 | `computeOrdinaryHourlyWage` | 근로기준법 시행령 제6조 |
| QR / IP / GPS / MANUAL 검증 | 정책 주입 (사업장 단위) | `verifyQrAttendance` / `verifyIpAttendance` / `verifyGpsAttendance` / `verifyManualAttendance` | 법정 무관 — 출근 인증 방식은 사업장 자율. `MANUAL` 은 근로기준법 제42조 (근로자 명부 기록 의무) 보조용으로 actor + reason 강제. |
| LATE / EARLY_LEAVE 판정 | `schedule.startAt + graceMinutes` 초과 / `schedule.endAt` 미달 | `createAttendanceService` (LATE 우선순위) | 취업규칙 자율 — 본 PBC 는 정책만 받음 |

`AttendanceMethod` / `AttendanceStatus` enum 은 FlowTeams Prisma enum 의 정확한 mirror — `verifyDefaultFlowTeamsAttendanceEnumMapping()` 가 boot 시 검증.

---

## 7. 노무 자문 (Nomu) — citation 인식 법령

`extractKoreanLaborLawCitations(text)` 가 인식하는 9 개 법령 (정규식: `(<statute>) 제 \d+ 조`):

| 법령 | 약어 (인식 키워드) | 본 PBC 가 직접 인용하는 조문 |
|---|---|---|
| 근로기준법 (Labor Standards Act) | `근로기준법` | 제17조 (서면 근로계약), 제23조 (해고 정당사유), 제35조 (수습 적용제외), 제42조 (근로자 명부), 제50조 (1주 40h), 제56조 (가산임금), 제60조 (연차), 제74조 (출산휴가) |
| 산업재해보상보험법 (Industrial Accident Compensation Insurance Act) | `산업재해보상보험법` | 제5조 (가입 의무) |
| 남녀고용평등법 (Equal Employment Opportunity Act) | `남녀고용평등법` | 제18조 (출산휴가), 제18조의2 (배우자 출산휴가) |
| 최저임금법 (Minimum Wage Act) | `최저임금법` | 제6조 (최저임금 적용) |
| 근로자퇴직급여보장법 (Workers' Retirement Pension Security Act) | `근로자퇴직급여보장법` | 제8조 (퇴직금) |
| 산업안전보건법 (Occupational Safety and Health Act) | `산업안전보건법` | — (validator 만 인식) |
| 국민연금법 (National Pension Act) | `국민연금법` | 제88조 (보험료율) |
| 건강보험법 (National Health Insurance Act) | `건강보험법` | 제73조 (보험료율) |
| 고용보험법 (Employment Insurance Act) | `고용보험법` | 제15조 (보험료율) |

`validateNomuAnswer` 는 LLM 답변에 위 9개 법령 중 **최소 1개 이상의 `제N조` 인용** 이 포함되어야 `valid = true` 를 반환한다. 길이 ∈ [50, 5000] / banned phrase (회피·우회 권유) 미포함 / 단정 표현 5개+ 시 `warnings` 추가도 함께 체크.

---

## 8. 변경 절차 (Update playbook)

법령이 바뀌었거나 새 연도 요율이 발표됐을 때:

1. **이 문서의 해당 row** 를 먼저 갱신 (출처 링크 + 새 값).
2. `packages/pbc-hr-payroll/src/payroll/insuranceRates/<year>.ts` 또는 `src/leave/policy.ts` 의 상수를 갱신. 새 연도면 새 파일을 추가하고 `insuranceRates/index.ts` 의 `RATES_BY_YEAR` 에 등록.
3. `__tests__/insuranceRates.test.ts` / `__tests__/leave/policy.test.ts` 의 핀 값을 갱신.
4. `__tests__/fixtures/payroll-2026.ts` 같은 fixture 도 영향받으면 같은 PR 안에서 재생성.
5. PR 의 description 에 본 mapping 의 어느 row 가 바뀌었는지 명시 (감사 추적).

> **Order matters**: 이 문서 → 상수 → 테스트 → fixture. 역순으로 진행하면 "테스트는 통과하지만 인용 표가 거짓말" 인 상태가 PR 의 절반 동안 살아남는다.
