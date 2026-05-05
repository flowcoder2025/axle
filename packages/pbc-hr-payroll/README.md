# @axle/pbc-hr-payroll

Pre-Built Component (PBC): the **HR / payroll / attendance / leave / 노무자문** surface shared by `apps/flowteams` and any future Korean-labor-aware app.

> Spec: [`docs/specs/meta-platform/pbc-hr-payroll.md`](../../docs/specs/meta-platform/pbc-hr-payroll.md)
> Korean labor-law mapping: [`docs/specs/meta-platform/pbc-hr-payroll-law-mapping.md`](../../docs/specs/meta-platform/pbc-hr-payroll-law-mapping.md)

## Status

**Phase 19 complete** (WI-601 ~ WI-610). All five domain surfaces (payroll, attendance, leave, nomu, enum mapping) are shipped with year-aware insurance rates, an in-memory + Prisma store pair per service, and a thin shell at `apps/flowteams`. CHANGELOG: [`CHANGELOG.md`](./CHANGELOG.md).

## What this package owns

| Surface | Items |
|---|---|
| Types | `EmploymentType`, `SalaryType`, `AttendanceMethod`, `AttendanceStatus`, `LeaveType`, `LeaveStatus`, `PayrollStatus`, `YearMonth`, `PayrollInput`, `PayrollResult`, `InsuranceRates`, `AttendanceRecord`, `AttendanceSummary`, `LeaveRequestInput`, `LeaveBalance` |
| Insurance rates | `KOREAN_INSURANCE_RATES_2025`, `KOREAN_INSURANCE_RATES_2026`, `getInsuranceRatesForYear(year)` |
| Payroll | `calculatePayroll(input, options?)`, `calculateInsuranceDeductions`, `calculateMonthlyIncomeTax`, `computeOrdinaryHourlyWage` |
| Attendance | `verifyQrAttendance`, `verifyIpAttendance`, `verifyGpsAttendance`, `verifyManualAttendance`, `verifyAttendanceContext`, `createAttendanceService`, `createInMemoryAttendanceStore`, `createPrismaAttendanceStore` |
| Leave | `createKoreanLeavePolicy`, `countLeaveDays`, `createLeaveService`, `createInMemoryLeaveStore`, `createPrismaLeaveStore` |
| Nomu (노무자문) | `classifyNomuTopic`, `redactNomuPii`, `extractKoreanLaborLawCitations`, `validateNomuAnswer`, `createNomuConsultationService`, `createInMemoryNomuConsultationStore`, `createPrismaNomuConsultationStore` |
| Enum mapping | `FLOWTEAMS_ATTENDANCE_METHODS`, `FLOWTEAMS_ATTENDANCE_STATUSES`, `verifyFlowTeamsAttendanceEnumMapping`, `verifyDefaultFlowTeamsAttendanceEnumMapping` |

## Out of scope

- **AI calls** — `NomuAiClient` is a boundary; the production LLM chain lives in `@axle/ai`.
- **Storage** — payslip rendering / file persistence belongs to `@axle/storage`.
- **Authentication / authorisation** — `@axle/auth` + the consumer's ReBAC layer.
- **Notifications** — `@axle/notification` (the leave service emits events; the consumer wires the side-effect).
- **4대보험 자동 신고 / 근로계약서 자동 생성 / 급여 이체 / 연말정산** — separate PBC candidates (see spec §6).

## Architecture (PBC pattern)

Every domain service follows the same shape:

```
   ┌────────────────────────────┐
   │  pure functions (calc /    │
   │  classify / validate / …)  │
   └──────────────┬─────────────┘
                  ▼
   ┌────────────────────────────┐
   │  Service factory           │
   │  createXxxService(deps)    │
   └──────────────┬─────────────┘
                  ▼
   ┌─────────────────────────────────────────────┐
   │  Store boundary (in-memory + Prisma adapter)│
   └─────────────────────────────────────────────┘
```

**The package never imports `@prisma/client` directly** — the Prisma adapters are structurally typed (`PrismaXxxDelegateLike`) so consumers wire `prisma.attendance` etc. without forcing a `prisma generate` on this package.

## Configuration

No env vars. Every dependency is injected through the `createXxxService` factory.

| Service | Required deps | Optional deps |
|---|---|---|
| `createAttendanceService` | `store`, `policy` (per-method verification) | `now`, `schedule`, `graceMinutes` |
| `createLeaveService` | `store`, `policy` (allocation) | `resolveTenureYears`, `now` |
| `createNomuConsultationService` | `store`, `ai` (`NomuAiClient`) | `now` |

---

## Usage examples

The examples below cover the five domain surfaces. Adapt the store wiring to your runtime; the in-memory factories are useful for tests.

### 1. Payroll calculation (year-aware)

```ts
import { calculatePayroll } from "@axle/pbc-hr-payroll";

const result = calculatePayroll({
  userId: "user_1",
  orgId: "org_1",
  period: { year: 2026, month: 5 },
  employmentType: "FULL_TIME",
  salaryType: "MONTHLY",
  baseSalary: 3_500_000,
  overtimeHours: 10, // 통상시급 × 1.5 가산임금 자동 적용
  allowances: [{ type: "meals", amount: 100_000 }],
});

// → { gross, deductions: { nationalPension, healthInsurance,
//       longTermCare, employmentInsurance, incomeTax, localIncomeTax, other },
//     net, metadata: { insuranceRatesYear, calculatedAt } }
```

`getInsuranceRatesForYear(year)` falls back to the nearest registered year for unknown future years (so a 2030 lookup returns the 2026 row); `metadata.insuranceRatesYear` surfaces the actual row used.

### 2. Attendance — QR check-in with in-memory store

```ts
import {
  createAttendanceService,
  createInMemoryAttendanceStore,
  type AttendanceVerificationPolicy,
} from "@axle/pbc-hr-payroll";

const policy: AttendanceVerificationPolicy = {
  qr: { resolveExpectedCode: (userId) => `code-${userId}` },
  ip: { allowedIps: new Set(["10.0.0.1"]) },
  gps: { geofences: [{ centerLat: 37.5665, centerLng: 126.978, radiusM: 100 }] },
  manual: { allowedApproverIds: new Set(["admin_1"]) },
};

const svc = createAttendanceService({
  store: createInMemoryAttendanceStore(),
  policy,
  schedule: () => ({
    startAt: new Date("2026-05-15T00:00:00Z"), // 09:00 KST
    endAt:   new Date("2026-05-15T09:00:00Z"), // 18:00 KST
  }),
  graceMinutes: 10,
});

const record = await svc.recordCheckIn({
  userId: "user_1",
  method: "QR",
  qrCode: "code-user_1",
});
// LATE / NORMAL is decided from schedule.startAt + graceMinutes; LATE
// precedence is preserved on check-out (a LATE check-in won't be
// downgraded by an EARLY_LEAVE check-out).
```

### 3. Leave — request, approve, balance

```ts
import {
  createInMemoryLeaveStore,
  createKoreanLeavePolicy,
  createLeaveService,
} from "@axle/pbc-hr-payroll";

const svc = createLeaveService({
  store: createInMemoryLeaveStore(),
  policy: createKoreanLeavePolicy(), // KLSA 베이스라인 (15일 + 2년당 1일, 25 cap)
  resolveTenureYears: () => 3, // → 16일 연차
});

const r = await svc.request({
  userId: "user_1",
  type: "ANNUAL",
  startDate: new Date("2026-06-01"),
  endDate: new Date("2026-06-03"),
});
await svc.approve({ leaveId: r.id, approverId: "manager_1" });

const balance = await svc.balance({ userId: "user_1", year: 2026 });
// → { granted: 16, used: 3, remaining: 13, byType: { ANNUAL: 3, ... } }
```

### 4. Nomu (노무자문) — preprocess + AI call + validation

```ts
import {
  createInMemoryNomuConsultationStore,
  createNomuConsultationService,
  type NomuAiClient,
} from "@axle/pbc-hr-payroll";

const aiClient: NomuAiClient = {
  async generateAnswer({ redactedQuestion, topic }) {
    // The package guarantees PII is already stripped from `redactedQuestion`
    // and the topic is classified before the call reaches you.
    return { answer: await yourLlm.complete(redactedQuestion, topic) };
  },
};

const svc = createNomuConsultationService({
  store: createInMemoryNomuConsultationStore(),
  ai: aiClient,
});

const r = await svc.ask({
  question: "주민번호 900101-1234567 직원의 연장수당 계산?",
  orgId: "org_1",
});
// PII is masked before the AI sees it; `r.answer` is the LLM output.

const v = await svc.validate({ consultationId: r.id });
// `v.valid` requires ≥1 Korean labor-law citation, length ∈ [50, 5000],
// and no banned phrase (회피/우회 권유). Strong-claim adverbs ≥5 emit a
// warning but stay valid.
```

### 5. Prisma adapter (production wiring)

```ts
import { prisma } from "@axle/db";
import {
  createPrismaAttendanceStore,
  createPrismaLeaveStore,
  createPrismaNomuConsultationStore,
} from "@axle/pbc-hr-payroll";

// Stores are organisation-scoped — every CRUD call is automatically
// filtered/stamped with `organizationId`.
const attendanceStore = createPrismaAttendanceStore(prisma.attendance, {
  organizationId: "org_1",
});
const leaveStore = createPrismaLeaveStore(prisma.leave, {
  organizationId: "org_1",
});
const nomuStore = createPrismaNomuConsultationStore(prisma.nomuConsultation);
```

The schema row that backs each adapter lives in the **HR Payroll Domain** section of `packages/db/prisma/schema.prisma` (added in WI-607).

---

## Korean labor-law mapping

Every rate constant, allocation rule, and validation check in this package implements a specific clause of Korean labor law. The full mapping (PBC symbol ↔ statute / clause ↔ source) is in:

[`docs/specs/meta-platform/pbc-hr-payroll-law-mapping.md`](../../docs/specs/meta-platform/pbc-hr-payroll-law-mapping.md)

This document is the **single source of truth** for the regulatory baseline; if a clause changes, update the mapping table first, then the constant, then the fixture.

---

## Tests

```
npm run test --workspace=@axle/pbc-hr-payroll
# → 14 test files, 233 tests (Phase 19, 2026-05)
```

Coverage targets: insurance rate constants, calculator fixtures (10 scenarios spanning the 4 employment × 3 work-type matrix), per-method attendance verification, leave policy + balance accounting, nomu preprocess / validate, and Prisma adapter argument shape (spy delegates).
