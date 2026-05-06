# Sprint Contract — WI-612-feat pbc-hr-payroll createPayrollService 팩토리 + generateStatement

## 계약 상태
- [x] 리드 초안 작성
- [x] 자율 루프 진입 승인 (사용자, 2026-05-07)

## 배경
`docs/specs/meta-platform/pbc-hr-payroll.md` §3.2 Public API가 명시한
`createPayrollService(deps): PayrollService` 팩토리와 `PayrollService.generateStatement` 메서드가
미구현이다. 현재는 stateless `calculatePayroll`만 export되어 있어, 다른 PBC가 의존성 주입을 통해
PayrollService를 사용할 수 없다.

`PayrollService` 인터페이스 타입은 이미 `src/types.ts`에 정의돼 있다 — 이 인터페이스를 만족하는 구현을 제공하면 된다.

## 수용 기준 (Acceptance Criteria)
- [ ] 1. `packages/pbc-hr-payroll/src/payroll/service.ts` 신규 작성:
  - `export function createPayrollService(deps: PayrollServiceDeps): PayrollService`
  - `PayrollServiceDeps`: `{ prisma: PrismaPayrollDelegateLike; ai?: AiClient }` (Prisma 직접 의존 회피 위해 delegate-like 인터페이스 사용 — attendance/prismaStore.ts 패턴 참고)
  - `PayrollServiceImpl.calculate(input)`: 내부에서 기존 `calculatePayroll` 호출 후 prisma에 PayrollResult 저장 (저장 실패 시 throw)
  - `PayrollServiceImpl.generateStatement({ userId, period })`: 해당 기간 PayrollResult를 prisma에서 조회 → `PayrollStatement` 형태로 변환하여 반환. 데이터 없으면 throw
- [ ] 2. `packages/pbc-hr-payroll/src/payroll/statement.ts` 신규 작성:
  - `export function renderStatementMarkdown(statement: PayrollStatement): string` — 한국어 급여명세서 markdown 포맷 (지급항목/공제항목/실수령액 표)
  - `export function renderStatementHtml(statement: PayrollStatement): string` — markdown 기반 또는 직접 HTML 생성 (XSS 안전: 사용자 입력값 escape)
  - PDF 생성은 본 WI 범위 외 (후속 WI에서 처리)
- [ ] 3. `packages/pbc-hr-payroll/src/payroll/prismaStore.ts` 신규 작성 (또는 기존 attendance/prismaStore.ts 패턴 차용):
  - `PrismaPayrollDelegateLike` interface — `findMany`, `create` 메서드만 의존
  - `createPrismaPayrollStore(prisma)` 헬퍼
- [ ] 4. `src/index.ts`에 다음 export 추가:
  - `createPayrollService`, `PayrollServiceDeps`, `PayrollServiceImpl`
  - `renderStatementMarkdown`, `renderStatementHtml`
  - `createPrismaPayrollStore`, `PrismaPayrollDelegateLike`
- [ ] 5. 단위 테스트 `__tests__/payroll-service.test.ts`:
  - mock prisma delegate 사용
  - `calculate`: 결과가 PayrollResult 시그니처 만족 + delegate.create 호출 검증
  - `generateStatement`: 저장된 결과 조회 시 PayrollStatement 반환
  - 데이터 없을 때 throw
  - 최소 5개 case
- [ ] 6. 단위 테스트 `__tests__/statement.test.ts`:
  - markdown/html 렌더링 결과에 한국어 라벨("기본급", "4대보험", "실수령액") 포함
  - 음수/0 값 안전 처리
  - HTML 출력에 `<script>` 등 위험 토큰 없음(XSS 검증)
- [ ] 7. **`apps/flowteams/app/payroll/page.tsx`가 `calculatePayroll` 직접 호출에서 `createPayrollService(...).calculate(...)`로 전환** — 사양 §3.2 PBC 추상화 준수. `apps/flowteams/lib/services.ts`에 PayrollService wiring 추가
- [ ] 8. `npx turbo lint build typecheck test --filter=@axle/pbc-hr-payroll` 전체 통과
- [ ] 9. `npx turbo build --filter=flowteams` 통과 (flowteams 사용 측 회귀 없음)

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=@axle/pbc-hr-payroll --filter=flowteams`
2. `grep -n "calculatePayroll" apps/flowteams/app/payroll/page.tsx` — 0건이어야 함 (서비스 경유)
3. `node -e "const m=require('./packages/pbc-hr-payroll/dist/index.js'); console.log(typeof m.createPayrollService, typeof m.renderStatementMarkdown)"` — 모두 `function`
4. evaluator: types.ts의 PayrollService 인터페이스와 구현체 시그니처 정합성 확인

## 산출물
| # | 파일 경로 | 설명 |
|---|---------|------|
| 1 | packages/pbc-hr-payroll/src/payroll/service.ts | createPayrollService 팩토리 |
| 2 | packages/pbc-hr-payroll/src/payroll/statement.ts | markdown/html 렌더러 |
| 3 | packages/pbc-hr-payroll/src/payroll/prismaStore.ts | Prisma store 헬퍼 |
| 4 | packages/pbc-hr-payroll/src/index.ts | export 추가 |
| 5 | packages/pbc-hr-payroll/__tests__/payroll-service.test.ts | 단위 테스트 |
| 6 | packages/pbc-hr-payroll/__tests__/statement.test.ts | 단위 테스트 |
| 7 | apps/flowteams/lib/services.ts | PayrollService wiring |
| 8 | apps/flowteams/app/payroll/page.tsx | createPayrollService 사용으로 전환 |
| 9 | packages/pbc-hr-payroll/CHANGELOG.md | "Add createPayrollService factory + statement renderers" |

## 제약
- PDF/HWPX 생성은 본 WI 범위 외 — markdown + HTML만
- 새로운 prisma model 추가 금지 (기존 PayrollResult/PayrollStatement 모델 사용)
- AI client 호출 금지 (deps.ai는 옵션, 본 WI에서 사용 안 함 — 후속 WI에서 활용)
- HTML 렌더러는 외부 라이브러리(react-dom/server 등) 사용 금지 — string template로 충분

## 평가 기준 유형
type: code
