# Sprint Contract: pbc-hr-payroll

> **위치**: `packages/pbc-hr-payroll/`
> **부모 PRD**: [`./PRD.md`](./PRD.md)
> **활성화 게이트**: AXLE Phase 17/18 완료 + FlowTeams v1 안정화
> **기간 추정**: 6주
> **선행 PBC**: 없음 (다른 PBC와 병렬 가능, 단 동시 ≤ 2)

---

## 1. Goal

FlowTeams의 인사·급여·근태·휴가·노무자문 도메인을 **`pbc-hr-payroll` 패키지로 추출**하고, FlowTeams를 `apps/flowteams/`로 이전한다.

---

## 2. 현황 (FlowTeams Prisma 스캔 결과)

### 2.1 추출 대상 모델 (HR 도메인)

- `Employment`/`EmploymentType` (정규/계약/일용/시간제)
- `SalaryType` (월급/시급/일급)
- `Attendance`, `AttendanceMethod` (QR/IP/GPS/수동), `AttendanceStatus`
- `Payroll`, `PayrollItem`, `PayrollStatus`
- `Leave`, `LeaveType` (연차/병가/경조/...), `LeaveStatus`, `LeavePromotion`
- `AiConsultation`, `AiValidation` (노무자문)
- `Schedule` (근무 일정)

### 2.2 PBC 외 (공통 패키지 책임)

- `User`, `Account`, `VerificationToken` → `packages/auth`
- `RelationTuple`, `RelationDefinition` → `core-rebac`
- `Organization`, `Plan`, `UserRole`, `Subscription`, `SubscriptionStatus` → `core-org` (신규 후보)
- `Notification` → `packages/notification`

---

## 3. 인터페이스 명세

### 3.1 타입 + 서비스

```typescript
// packages/pbc-hr-payroll/src/types.ts

export type EmploymentType = 'FULL_TIME' | 'CONTRACT' | 'DAILY' | 'PART_TIME';
export type SalaryType = 'MONTHLY' | 'HOURLY' | 'DAILY';
export type AttendanceMethod = 'QR' | 'IP' | 'GPS' | 'MANUAL';
export type LeaveType = 'ANNUAL' | 'SICK' | 'CONDOLENCE' | 'MATERNITY' | 'PATERNITY' | 'OTHER';

export interface YearMonth { year: number; month: number; }

export interface PayrollInput {
  userId: string;
  orgId: string;
  period: YearMonth;
  baseSalary: number;
  overtimeHours?: number;
  bonus?: number;
  allowances?: Array<{ type: string; amount: number }>;
}

export interface PayrollResult {
  gross: number;
  deductions: {
    nationalPension: number;     // 국민연금
    healthInsurance: number;     // 건강보험
    longTermCare: number;        // 장기요양
    employmentInsurance: number; // 고용보험
    incomeTax: number;           // 소득세 (간이세액표)
    localIncomeTax: number;      // 지방소득세
    other: number;
  };
  net: number;
  metadata: {
    insuranceRatesYear: number;
    calculatedAt: Date;
  };
}

export interface PayrollStatement {
  result: PayrollResult;
  documentUrl?: string;          // PDF/HWPX 생성 후 URL
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  checkInAt: Date;
  checkOutAt?: Date;
  method: AttendanceMethod;
  status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT';
}

export interface AttendanceSummary {
  period: YearMonth;
  workDays: number;
  totalHours: number;
  overtimeHours: number;
  lateCount: number;
  absentCount: number;
}

export interface LeaveRequestInput {
  userId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface LeaveBalance {
  userId: string;
  year: number;
  granted: number;               // 부여
  used: number;                  // 사용
  remaining: number;             // 잔여
  byType: Record<LeaveType, number>;
}

// 4대보험 정책 (year-aware)
// 키 컨벤션: PayrollResult.deductions와 일치하는 camelCase 사용
export interface InsuranceRates {
  year: number;
  nationalPension: number;       // 국민연금
  healthInsurance: number;       // 건강보험
  longTermCare: number;          // 장기요양
  employmentInsurance: number;   // 고용보험
  industrialAccident: number;    // 산재 (업종별 별도)
}

export const KOREAN_INSURANCE_RATES_2026: InsuranceRates;
export const KOREAN_INSURANCE_RATES_2025: InsuranceRates;
```

### 3.2 Public API

```typescript
// packages/pbc-hr-payroll/src/index.ts

export interface PayrollService {
  calculate(input: PayrollInput): Promise<PayrollResult>;
  generateStatement(input: { userId: string; period: YearMonth }): Promise<PayrollStatement>;
}

export interface AttendanceService {
  recordCheckIn(input: { userId: string; method: AttendanceMethod }): Promise<AttendanceRecord>;
  recordCheckOut(input: { userId: string }): Promise<AttendanceRecord>;
  summarize(input: { userId: string; period: YearMonth }): Promise<AttendanceSummary>;
}

export interface LeaveService {
  request(input: LeaveRequestInput): Promise<{ id: string; status: 'PENDING' }>;
  approve(input: { leaveId: string; approverId: string }): Promise<void>;
  reject(input: { leaveId: string; approverId: string; reason: string }): Promise<void>;
  balance(input: { userId: string; year: number }): Promise<LeaveBalance>;
}

export interface NomuConsultationService {
  ask(input: { question: string; orgId: string }): Promise<{ id: string; answer: string }>;
  validate(input: { consultationId: string }): Promise<{ valid: boolean; reason?: string }>;
}

export function createPayrollService(deps: { prisma: PrismaClient; ai?: AiClient }): PayrollService;
export function createAttendanceService(deps: { prisma: PrismaClient }): AttendanceService;
export function createLeaveService(deps: { prisma: PrismaClient; notification: NotificationService }): LeaveService;
export function createNomuConsultationService(deps: { prisma: PrismaClient; ai: AiClient }): NomuConsultationService;
```

---

## 4. 패키지 구조

```
packages/pbc-hr-payroll/
├── src/
│   ├── types.ts
│   ├── index.ts
│   ├── payroll/
│   │   ├── calculate.ts
│   │   ├── deductions.ts
│   │   ├── insuranceRates/
│   │   │   ├── 2025.ts
│   │   │   └── 2026.ts
│   │   └── statement.ts
│   ├── attendance/
│   │   └── service.ts
│   ├── leave/
│   │   └── service.ts
│   └── nomu/
│       └── consultation.ts
├── prisma/
│   └── schema.prisma             (도메인 모델만, 통합 schema에서 포팅)
├── __tests__/
│   ├── fixtures/
│   │   └── payroll-2026.ts       (회귀 fixture)
│   └── *.test.ts
└── package.json
```

---

## 5. Acceptance Criteria

- [ ] FlowTeams 도메인 모델이 `packages/pbc-hr-payroll/prisma/`로 분리 (또는 통합 schema의 도메인 섹션)
- [ ] 급여 계산 함수가 4대보험·소득세 한국 법규 정확히 반영 (2026년 기준 fixture 통과)
- [ ] 근태/휴가 비즈니스 로직이 PBC로 추출, 앱(FlowTeams)은 thin shell
- [ ] FlowTeams를 `apps/flowteams/`로 이전, AXLE 모노레포 안에서 빌드 통과
- [ ] AI 노무자문이 `packages/ai/` 의존, PBC는 인터페이스만 정의
- [ ] 단위 테스트: 급여 계산 시나리오 ≥ 10개 (정규직/계약직/일용직/시간제 × 일반/연장/공휴근로)
- [ ] 통합 테스트: FlowTeams app E2E 1개 (월급 정산 플로우)
- [ ] 4대보험 율 변경 시 fixture만 갱신하면 되는 구조 (year-aware)
- [ ] 문서: API + 한국 법규 매핑 표

---

## 6. Out of Scope

- ❌ 모바일 앱 빌드 (별도 task)
- ❌ 4대보험 자동 신고 API 연동 (`pbc-hr-filing` 후속 PBC 후보)
- ❌ 근로계약서 자동 생성 (`pbc-hr-contracts` 후속)
- ❌ 급여 이체 (별도 결제 PBC)
- ❌ 연말정산 (별도 PBC 후보)

---

## 7. Verification

```bash
cd /Volumes/포터블/AXLE
npm run test --workspace=@axle/pbc-hr-payroll
npm run typecheck --workspace=@axle/pbc-hr-payroll

# 급여 fixture 회귀
npm run test:fixtures:payroll-2026 --workspace=@axle/pbc-hr-payroll

# FlowTeams app E2E
npm run test:e2e -- --filter=apps/flowteams
```

---

## 8. WI 분해 (예시)

| WI 번호 | 작업 | 추정 |
|---|---|---|
| WI-601-feat | pbc-hr-payroll 스켈레톤 + types.ts | 0.5d |
| WI-602-feat | 4대보험 rates 2025/2026 + 단위 테스트 | 1d |
| WI-603-feat | 급여 계산 로직 + 10개 fixture | 2d |
| WI-604-feat | 근태 서비스 + AttendanceMethod별 검증 | 1.5d |
| WI-605-feat | 휴가 서비스 + 잔여 계산 | 1.5d |
| WI-606-feat | 노무자문 인터페이스 (실제 AI는 packages/ai) | 1d |
| WI-607-refactor | FlowTeams 도메인 모델을 PBC로 분리 | 2d |
| WI-608-refactor | FlowTeams를 apps/flowteams로 이전 | 3d |
| WI-609-test | E2E 월급 정산 시나리오 | 1.5d |
| WI-610-docs | API + 법규 매핑 표 | 1d |

총 ~15일 (6주 일정)

---

## 9. 리스크

| 리스크 | 확률 | 영향 | 대응 |
|---|---|---|---|
| 한국 법규(4대보험율, 소득세표)가 매년 변경 | 高 | 中 | year-aware 구조 + 매년 fixture 갱신 (`insuranceRates/{year}.ts`) |
| FlowTeams가 자체 진행 중이라 이전 충돌 | 高 | 高 | FlowTeams v1 안정화 후 fork → 추출 → 마이그레이션 |
| Prisma multi-schema 도입 결정 보류 | 中 | 中 | 1차는 통합 schema 유지, 도메인 섹션 분리만 |
| AI 노무자문 정확도 검증 어려움 | 中 | 低 | `AiValidation` 모델로 응답 품질 추적 |
| 외주노동(특수고용/플랫폼노동) 변형 케이스 | 中 | 中 | 1차 범위에서 제외, 후속 PBC 검토 |

---

## 10. 결정 로그

| 일자 | 결정 | 근거 |
|---|---|---|
| 2026-05-03 | FlowTeams를 `apps/flowteams/`로 이전 | 메타플랫폼의 첫 도메인 앱 케이스 |
| 2026-05-03 | 노무자문 AI는 `packages/ai/` 호출 | PBC는 도메인만, AI는 횡단 |
| 2026-05-03 | year-aware 보험율 구조 | 매년 법규 변경 자동 흡수 |
| 2026-05-03 | Prisma multi-schema는 1차 보류 | 통합 schema 유지가 빌드 단순 |
| 2026-05-03 | 활성화 게이트에 "FlowTeams v1 안정화" 추가 | 추출 시 충돌 회피 |
