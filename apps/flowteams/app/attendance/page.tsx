export default function AttendanceDemoPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>근태 데모</h1>
      <p>
        근태 처리는 <code>createFlowTeamsServices(opts).attendance</code>로
        주입한 PBC 서비스에서 결정됩니다 (QR / IP / GPS / MANUAL 검증 +
        스케줄 기반 LATE/EARLY_LEAVE 판정). 실제 UI는 FlowTeams v1
        안정화 후에 구체화됩니다.
      </p>
      <p>
        구현 위치:{" "}
        <code>packages/pbc-hr-payroll/src/attendance/service.ts</code>
      </p>
    </main>
  );
}
