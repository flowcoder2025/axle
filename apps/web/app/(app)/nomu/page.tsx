export default function NomuDemoPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>노무 자문 데모</h1>
      <p>
        노무 자문은{" "}
        <code>createFlowTeamsServices(opts).nomu</code>로 주입한 PBC
        서비스에서 결정됩니다. PBC 는 PII redact + 8-topic 분류 +
        법령 인용 검증을 담당하고, 실제 LLM 호출은{" "}
        <code>NomuAiClient</code> 인터페이스를 통해{" "}
        <code>packages/ai</code>가 제공합니다.
      </p>
      <p>
        v1 안정화 전에는 placeholder NomuAiClient 가 결정론적
        citation-bearing 응답을 반환하므로 검증 파이프라인을 그대로
        smoke-test 할 수 있습니다.
      </p>
      <p>
        구현 위치:{" "}
        <code>packages/pbc-hr-payroll/src/nomu/consultation.ts</code>
      </p>
    </main>
  );
}
