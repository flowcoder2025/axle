import {
  createFlowTeamsServices,
  renderStatementMarkdown,
} from "../../../src/modules/hr/services";

// `payroll.calculate` performs a real prisma.payroll.create insert, so this
// route must run per-request — opt out of prerendering and ISR.
export const dynamic = "force-dynamic";

const DEMO_ORG_ID = "demo_org";
const DEMO_USER_ID = "demo_user";
const DEMO_PERIOD = { year: 2026, month: 5 } as const;

export default async function PayrollDemoPage() {
  const services = createFlowTeamsServices({ organizationId: DEMO_ORG_ID });

  let result;
  let error: string | null = null;
  try {
    result = await services.payroll.calculate({
      userId: DEMO_USER_ID,
      orgId: DEMO_ORG_ID,
      period: DEMO_PERIOD,
      employmentType: "FULL_TIME",
      salaryType: "MONTHLY",
      baseSalary: 3_500_000,
      overtimeHours: 10,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const statementMarkdown = result
    ? renderStatementMarkdown(
        { result },
        {
          userId: DEMO_USER_ID,
          period: DEMO_PERIOD,
          organizationName: "FlowTeams Demo",
        },
      )
    : null;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>급여 계산 데모</h1>
      <p>
        이 페이지는 <code>@axle/pbc-hr-payroll</code>의{" "}
        <code>createPayrollService</code> 팩토리로 구성한 payroll 서비스를 호출합니다.
        PBC 추상화 (서비스 경유)를 사용하며 PBC 내부 함수를 직접 호출하지 않습니다.
      </p>
      {error ? (
        <pre style={{ background: "#fee", padding: 12, borderRadius: 4 }}>
          저장 실패: {error}
        </pre>
      ) : (
        <>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
          {statementMarkdown && (
            <pre style={{ background: "#fafafa", padding: 12, borderRadius: 4 }}>
              {statementMarkdown}
            </pre>
          )}
        </>
      )}
    </main>
  );
}
