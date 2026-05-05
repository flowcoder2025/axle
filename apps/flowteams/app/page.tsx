import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>FlowTeams (apps/flowteams)</h1>
      <p>
        AXLE 메타플랫폼의 HR / Payroll 도메인 앱. 모든 비즈니스 로직은{" "}
        <code>@axle/pbc-hr-payroll</code> 패키지에 있고, 이 앱은 thin shell
        으로 동작합니다.
      </p>
      <ul>
        <li>
          <Link href="/payroll">/payroll</Link> — 급여 계산 데모 (
          <code>calculatePayroll</code>)
        </li>
        <li>
          <Link href="/attendance">/attendance</Link> — 근태 정책 데모 (
          <code>AttendanceService</code>)
        </li>
        <li>
          <Link href="/leave">/leave</Link> — 연차 잔여 데모 (
          <code>LeaveService</code>)
        </li>
        <li>
          <Link href="/nomu">/nomu</Link> — 노무 자문 데모 (
          <code>NomuConsultationService</code>)
        </li>
      </ul>
      <p>
        상세 명세: <code>docs/specs/meta-platform/pbc-hr-payroll.md</code>
      </p>
    </main>
  );
}
