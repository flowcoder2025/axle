export default function LeaveDemoPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>연차 데모</h1>
      <p>
        연차 신청 / 승인 / 잔여 계산은{" "}
        <code>createFlowTeamsServices(opts).leave</code>로 주입한 PBC
        서비스에서 결정됩니다. 기본 정책은{" "}
        <code>createKoreanLeavePolicy()</code> (KLSA 베이스라인). 실제 UI는
        FlowTeams v1 안정화 후에 구체화됩니다.
      </p>
      <p>
        구현 위치: <code>packages/pbc-hr-payroll/src/leave/service.ts</code>
      </p>
    </main>
  );
}
