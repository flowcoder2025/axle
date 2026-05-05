import { calculatePayroll } from "../../lib/services";

export default function PayrollDemoPage() {
  const result = calculatePayroll({
    userId: "demo_user",
    orgId: "demo_org",
    period: { year: 2026, month: 5 },
    employmentType: "FULL_TIME",
    salaryType: "MONTHLY",
    baseSalary: 3_500_000,
    overtimeHours: 10,
  });

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>급여 계산 데모</h1>
      <p>
        이 페이지는 <code>@axle/pbc-hr-payroll</code>의{" "}
        <code>calculatePayroll</code>을 직접 호출한 결과를 표시합니다. 데이터
        흐름은 모두 PBC 안에서 결정됩니다.
      </p>
      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </main>
  );
}
