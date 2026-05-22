/**
 * /erp/reports — ERP 레포팅 대시보드 (Phase 21 WI-733-feat).
 *
 * Three reports in a tabbed view, sharing a single month-range filter:
 *   1. 거래처별 매출/매입 (WI-728-feat)
 *   2. 손익계산서 간이판 (WI-729-feat)
 *   3. 재고 회전·데드재고 (WI-730-feat)
 *
 * A common export button kicks off a WI-731-feat job (CSV in this
 * iteration; DOCX/PDF land as a follow-up swap behind the same jobId
 * pattern).
 *
 * Auth: erp:read. Users without the scope hit the standard
 * `requireErpScope` 401/403 surface (RED AC #4).
 */

import { requireErpScope } from "@/lib/erp/auth";
import { ReportsDashboard } from "@/src/components/erp/reports/reports-dashboard";

export const metadata = {
  title: "ERP 레포팅 대시보드 | AXLE",
};

export default async function ErpReportsPage(): Promise<React.JSX.Element> {
  await requireErpScope("erp:read");

  // Default filter window: trailing 5 months ending the current month.
  const now = new Date();
  const to = formatMonth(now);
  const fromDate = new Date(now);
  fromDate.setMonth(fromDate.getMonth() - 4);
  const from = formatMonth(fromDate);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-xs text-muted-foreground">
          AXLE › ERP › 리포트
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          ERP 레포팅 대시보드
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          거래처별 손익 · 손익계산서 · 재고 회전을 한 화면에서 검토합니다.
        </p>
      </div>
      <ReportsDashboard initialFrom={from} initialTo={to} />
    </div>
  );
}

function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
