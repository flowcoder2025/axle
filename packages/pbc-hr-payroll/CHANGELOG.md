# Changelog — `@axle/pbc-hr-payroll`

## 0.0.2 — 2026-05-12 (WI-612)

### Added

- **WI-612** — `createPayrollService(deps)` factory + `generateStatement` round-trip. `calculate` runs `calculatePayroll` then persists a `Payroll` row + 7 `PayrollItem` deduction rows via the structurally-typed `PrismaPayrollDelegateLike` (2 methods: `create`, `findMany`). `generateStatement({ userId, period })` reconstructs the full `PayrollResult` from the persisted rows. `createPrismaPayrollStore(prismaPayrollDelegate, { organizationId })` bakes `organizationId` into the delegate (same per-org pattern as `attendance/prismaStore.ts`).
- **WI-612** — `renderStatementMarkdown(statement, ctx?)` / `renderStatementHtml(statement, ctx?)` pure string renderers for the Korean 급여명세서. HTML output escapes every dynamic value (XSS hardening: no `<script>`, no inline event handlers, escaped `documentUrl`). PDF / HWPX rendering is intentionally out-of-scope (follow-up WI).
- **WI-612** — `apps/flowteams/lib/services.ts` now wires `createPayrollService` into `createFlowTeamsServices(opts)`; `apps/flowteams/app/payroll/page.tsx` switched to `services.payroll.calculate(...)` — direct `calculatePayroll` import removed from the page (spec §3.2 PBC abstraction).
- 15 new unit tests (`__tests__/payroll-service.test.ts` × 6, `__tests__/statement.test.ts` × 9).

## 0.0.1 — 2026-05-05 (Phase 19 launch)

WI-601 ~ WI-610. First public surface; no prior releases.

### Added

- **WI-601** — package skeleton + `types.ts` contract (camelCase pin on `InsuranceRates` keys, matching `PayrollResult.deductions`). Service interfaces forward-declared: `PayrollService`, `AttendanceService`, `LeaveService`, `NomuConsultationService`.
- **WI-602** — Korean 4대보험 rates 2025 (officially confirmed) + 2026 (forward-projected) + `getInsuranceRatesForYear(year)` with nearest-known fallback. 15 unit tests.
- **WI-603** — `calculatePayroll` synchronous calculator + 10 pinned fixtures spanning `{FULL_TIME, CONTRACT, DAILY, PART_TIME} × {일반, 연장, 공휴}`. Simplified income-tax bracket approximation in `deductions.ts` (full 간이세액표 lookup is a follow-up). 65 unit tests.
- **WI-604** — Per-`AttendanceMethod` verification (QR / IP / GPS via haversine / MANUAL) + `createAttendanceService` with LATE precedence + in-memory store. FlowTeams enum mapping verifier (`verifyFlowTeamsAttendanceEnumMapping`). 51 unit tests.
- **WI-605** — `createKoreanLeavePolicy` (KLSA baseline: <1y → 11d, ≥1y → 15d + 2년당 1d, 25d cap; 출산 90, 배우자 출산 10, 경조 5, 병가/기타 0) + `createLeaveService` (request → PENDING, approve → APPROVED, reject with non-empty reason, balance with per-`LeaveType` `byType`). 29 unit tests.
- **WI-606** — Nomu (노무자문) consultation service: `redactNomuPii` (주민번호/휴대폰/이메일), `classifyNomuTopic` (8 카테고리 keyword heuristic), `validateNomuAnswer` (length / banned phrase / 9 statute citation / 단정 표현 warning), `NomuAiClient` boundary, `createNomuConsultationService` orchestration. 41 unit tests.
- **WI-607** — Prisma store adapters (`createPrismaAttendanceStore`, `createPrismaLeaveStore`, `createPrismaNomuConsultationStore`) backed by structural `PrismaXxxDelegateLike` types so the package doesn't take a hard `@prisma/client` dependency. New "HR Payroll Domain" section appended to `packages/db/prisma/schema.prisma` with 7 enums + 8 models + 6 named back-relations on User / Organization. 16 unit tests.
- **WI-608** — `apps/flowteams` thin-shell scaffold (Next.js 16 + React 19 + 5 demo routes + port 3001). `lib/services.ts` re-exports the deterministic functions and ships `createFlowTeamsServices(opts)` which wires Korean leave policy + Prisma store adapters with `organizationId` automatically stamped. `createPlaceholderNomuAiClient` returns deterministic citation-bearing answers per topic until `packages/ai` ships the production chain (FlowTeams v1 stabilisation gate). 5 unit tests.
- **WI-609** — E2E payroll scenario **deferred**: `claude -p` worker cannot drive a browser; recorded the skip + scenario outline in `.flowset/guardrails.md` for the upcoming interactive Playwright session.
- **WI-610** — README + Korean labor-law mapping table at `docs/specs/meta-platform/pbc-hr-payroll-law-mapping.md`. The mapping is the single source of truth for the regulatory baseline (clause → constant → fixture).

### Notes

- The 2026 insurance rates are provisional pending Ministry of Health & Welfare / NPS announcements (typically Nov–Dec). Update `src/payroll/insuranceRates/2026.ts` and re-run the fixture regeneration when the official figures land.
- The income-tax approximation in `calculateMonthlyIncomeTax` is a stand-in for the full 간이세액표 lookup (thousands of rows × dependent count); replace the bracket function with a table lookup when the consumer needs sub-percent fidelity for monthly withholding.
- The placeholder `NomuAiClient` in `apps/flowteams` MUST be swapped for the real `@axle/ai` chain before going live.
