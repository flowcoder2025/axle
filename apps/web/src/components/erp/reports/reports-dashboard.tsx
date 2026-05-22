"use client";

/**
 * ERP 레포팅 대시보드 Client 컴포넌트 (Phase 21 WI-733-feat).
 *
 * Hosts three tabs that each fetch from one of the M2 report API
 * endpoints, plus a shared export button that submits a WI-731-feat
 * job and polls for completion.
 *
 * State model:
 *   - `from`/`to` (YYYY-MM) + `type` (SALE | PURCHASE) live in the
 *     dashboard state, applied on "조회" button click.
 *   - Each tab owns its own fetch state (loading/error/data + dataAsOf).
 *     Tabs are mounted lazily on first activation to avoid hitting an
 *     endpoint a user never opens.
 *   - Export button creates an export job for the currently active tab,
 *     polls /api/erp/reports/export/[jobId] every 1.5s until COMPLETED
 *     or FAILED, then surfaces the Blob URL.
 */

import * as React from "react";
import { Button, Input } from "@axle/ui";

type TabId = "counterparty" | "income-statement" | "inventory";

interface ReportsDashboardProps {
  initialFrom: string;
  initialTo: string;
}

interface ExportState {
  status: "idle" | "queued" | "running" | "completed" | "failed";
  jobId?: string;
  blobUrl?: string;
  filename?: string;
  error?: string;
}

const TAB_LABEL: Record<TabId, string> = {
  counterparty: "거래처별 매출/매입",
  "income-statement": "손익계산서 간이판",
  inventory: "재고 회전·데드재고",
};

const TAB_REPORT_TYPE: Record<TabId, string> = {
  counterparty: "counterparty",
  "income-statement": "income-statement",
  inventory: "inventory-turnover",
};

export function ReportsDashboard({
  initialFrom,
  initialTo,
}: ReportsDashboardProps): React.JSX.Element {
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [type, setType] = React.useState<"SALE" | "PURCHASE">("SALE");
  const [appliedFilters, setAppliedFilters] = React.useState({
    from: initialFrom,
    to: initialTo,
    type: "SALE" as "SALE" | "PURCHASE",
  });
  const [activeTab, setActiveTab] = React.useState<TabId>("counterparty");
  const [exportState, setExportState] = React.useState<ExportState>({
    status: "idle",
  });

  function applyFilters(): void {
    setAppliedFilters({ from, to, type });
    setExportState({ status: "idle" });
  }

  async function startExport(): Promise<void> {
    const params = buildExportParams(activeTab, appliedFilters);
    setExportState({ status: "queued" });
    try {
      const res = await fetch("/api/erp/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: TAB_REPORT_TYPE[activeTab],
          format: "csv",
          params,
        }),
      });
      if (!res.ok) {
        const payload = (await safeJson(res)) as {
          error?: { message?: string };
        } | null;
        setExportState({
          status: "failed",
          error: payload?.error?.message ?? `export start failed (${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as { jobId: string };
      setExportState({ status: "running", jobId: body.jobId });
      pollExport(body.jobId);
    } catch (err) {
      setExportState({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function pollExport(jobId: string): void {
    let canceled = false;
    const cancel = (): void => {
      canceled = true;
    };
    const interval = setInterval(async () => {
      if (canceled) return;
      const res = await fetch(`/api/erp/reports/export/${jobId}`);
      if (!res.ok) {
        clearInterval(interval);
        setExportState({
          status: "failed",
          jobId,
          error: `poll failed (${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as {
        status: string;
        output?: { blobUrl: string; filename: string };
        error?: string;
      };
      if (body.status === "COMPLETED" && body.output) {
        clearInterval(interval);
        setExportState({
          status: "completed",
          jobId,
          blobUrl: body.output.blobUrl,
          filename: body.output.filename,
        });
      } else if (body.status === "FAILED") {
        clearInterval(interval);
        setExportState({
          status: "failed",
          jobId,
          error: body.error ?? "render failed",
        });
      }
    }, 1500);
    // 60s safety timeout — clear interval and mark failed.
    setTimeout(() => {
      cancel();
      clearInterval(interval);
      setExportState((s) =>
        s.status === "running"
          ? { ...s, status: "failed", error: "timeout" }
          : s,
      );
    }, 60_000);
  }

  return (
    <div className="space-y-4" data-testid="page-erp-reports">
      <div
        className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3"
        data-testid="report-filters"
      >
        <Field label="시작 월">
          <Input
            type="month"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="filter-from"
            aria-label="시작 월"
          />
        </Field>
        <span className="pb-2 text-sm">~</span>
        <Field label="종료 월">
          <Input
            type="month"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-testid="filter-to"
            aria-label="종료 월"
          />
        </Field>
        <Field label="거래 유형">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "SALE" | "PURCHASE")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="거래 유형"
            data-testid="filter-type"
          >
            <option value="SALE">매출</option>
            <option value="PURCHASE">매입</option>
          </select>
        </Field>
        <Button
          type="button"
          onClick={applyFilters}
          data-testid="filter-apply"
        >
          조회
        </Button>
      </div>

      <div className="flex gap-1 border-b" role="tablist">
        {(Object.keys(TAB_LABEL) as TabId[]).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm border-b-2 ${
              activeTab === id
                ? "border-blue-500 text-blue-600 font-semibold"
                : "border-transparent text-muted-foreground"
            }`}
            data-testid={`tab-${id}`}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>

      <div data-testid={`panel-${activeTab}`}>
        {activeTab === "counterparty" && (
          <CounterpartyPanel filters={appliedFilters} />
        )}
        {activeTab === "income-statement" && (
          <IncomeStatementPanel filters={appliedFilters} />
        )}
        {activeTab === "inventory" && <InventoryPanel />}
      </div>

      <div
        className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
        data-testid="export-bar"
      >
        <span className="text-xs text-muted-foreground" data-testid="export-job-status">
          {exportState.status === "idle" && "대기 중"}
          {exportState.status === "queued" && "대기열 등록…"}
          {exportState.status === "running" && "생성 중…"}
          {exportState.status === "completed" && (
            <>
              완료 ·{" "}
              <a
                className="text-blue-600 underline"
                href={exportState.blobUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="export-download-link"
              >
                {exportState.filename ?? "다운로드"}
              </a>
            </>
          )}
          {exportState.status === "failed" && (
            <span className="text-destructive" data-testid="export-error">
              실패: {exportState.error}
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            onClick={startExport}
            disabled={
              exportState.status === "queued" || exportState.status === "running"
            }
            data-testid="export-csv-button"
          >
            CSV 내보내기
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildExportParams(
  tab: TabId,
  filters: { from: string; to: string; type: "SALE" | "PURCHASE" },
): Record<string, unknown> {
  if (tab === "counterparty") {
    return { from: filters.from, to: filters.to, type: filters.type };
  }
  if (tab === "income-statement") {
    const [y] = filters.to.split("-").map((p) => Number(p));
    return { year: y };
  }
  // inventory uses ISO dates over a 90-day window — use the from month
  // start and the to month end for the export.
  return { from: `${filters.from}-01`, to: `${filters.to}-31` };
}

// ---------------- Panels ----------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

type Filters = { from: string; to: string; type: "SALE" | "PURCHASE" };

function CounterpartyPanel({ filters }: { filters: Filters }): React.JSX.Element {
  const { data, loading, error } = useFetchJson<{
    rows: Array<{
      counterpartyId: string | null;
      counterpartyName: string | null;
      totalAmount: string;
      totalQty: number;
      lineCount: number;
    }>;
    totalAmount: string;
    dataAsOf: string | null;
  }>(
    `/api/erp/reports/counterparty?from=${filters.from}&to=${filters.to}&type=${filters.type}&limit=10`,
  );
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  if (!data) return <PanelEmpty />;
  return (
    <div className="space-y-2">
      <DataAsOfBanner value={data.dataAsOf} />
      <table className="w-full text-sm" data-testid="counterparty-report-table">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 w-10">#</th>
            <th className="py-2 pr-3">거래처</th>
            <th className="py-2 pr-3 text-right">합계</th>
            <th className="py-2 pr-3 text-right">수량</th>
            <th className="py-2 pr-3 text-right">라인 수</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-muted-foreground">
                결과가 없습니다.
              </td>
            </tr>
          ) : (
            data.rows.map((row, idx) => (
              <tr key={row.counterpartyId ?? `null-${idx}`} className="border-b last:border-0">
                <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                <td className="py-2 pr-3">
                  {row.counterpartyName ?? "(미지정 거래처)"}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.totalAmount}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.totalQty}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.lineCount}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td colSpan={2} className="py-2 pr-3">총합</td>
            <td className="py-2 pr-3 text-right tabular-nums">{data.totalAmount}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function IncomeStatementPanel({ filters }: { filters: Filters }): React.JSX.Element {
  const [y] = filters.to.split("-").map((p) => Number(p));
  const { data, loading, error } = useFetchJson<{
    categories: Record<
      string,
      { total: string; rows: Array<{ code: string; name: string; total: string }> }
    >;
    operatingIncome: string;
    netIncome: string;
    dataAsOf: string | null;
  }>(`/api/erp/reports/income-statement?year=${y}`);
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  if (!data) return <PanelEmpty />;
  return (
    <div className="space-y-2">
      <DataAsOfBanner value={data.dataAsOf} />
      <table className="w-full text-sm" data-testid="income-statement-table">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">카테고리</th>
            <th className="py-2 pr-3 text-right">합계</th>
          </tr>
        </thead>
        <tbody>
          {(["REVENUE", "COGS", "OPEX", "NON_OPERATING", "OTHER"] as const).map(
            (cat) => (
              <tr key={cat} className="border-b last:border-0">
                <td className="py-2 pr-3">{cat}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {data.categories[cat]?.total ?? "0.00"}
                </td>
              </tr>
            ),
          )}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold text-green-700">
            <td className="py-2 pr-3" data-testid="operating-profit-row">
              영업이익
            </td>
            <td className="py-2 pr-3 text-right tabular-nums">
              {data.operatingIncome}
            </td>
          </tr>
          <tr className="font-semibold">
            <td className="py-2 pr-3">당기순이익</td>
            <td className="py-2 pr-3 text-right tabular-nums">{data.netIncome}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function InventoryPanel(): React.JSX.Element {
  const { data, loading, error } = useFetchJson<{
    rows: Array<{
      productId: string;
      productName: string;
      sku: string | null;
      totalIn: number;
      totalOut: number;
      turnoverPerDay: string;
      lastMovementAt: string | null;
    }>;
    from: string;
    to: string;
  }>("/api/erp/reports/inventory-turnover?limit=20");
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  if (!data) return <PanelEmpty />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        기간: {data.from} ~ {data.to}
      </p>
      <table className="w-full text-sm" data-testid="inventory-table">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">상품</th>
            <th className="py-2 pr-3">SKU</th>
            <th className="py-2 pr-3 text-right">입고</th>
            <th className="py-2 pr-3 text-right">출고</th>
            <th className="py-2 pr-3 text-right">일평균 회전</th>
            <th className="py-2 pr-3">마지막 이동</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                기간 내 이동이 없습니다.
              </td>
            </tr>
          ) : (
            data.rows.map((r) => (
              <tr key={r.productId} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{r.productName}</td>
                <td className="py-2 pr-3 text-muted-foreground">{r.sku ?? "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.totalIn}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.totalOut}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {r.turnoverPerDay}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {r.lastMovementAt?.slice(0, 10) ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DataAsOfBanner({ value }: { value: string | null }): React.JSX.Element {
  return (
    <p className="text-xs text-muted-foreground" data-testid="data-as-of">
      데이터 기준: {value ?? "초기화 전 (cron 첫 실행 대기)"}
    </p>
  );
}

function PanelLoading(): React.JSX.Element {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      불러오는 중…
    </div>
  );
}

function PanelError({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      className="py-6 text-center text-sm text-destructive"
      data-testid="panel-error"
    >
      오류: {message}
    </div>
  );
}

function PanelEmpty(): React.JSX.Element {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      데이터가 없습니다.
    </div>
  );
}

// ---------------- helpers ----------------

function useFetchJson<T>(
  url: string,
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const payload = (await safeJson(res)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            payload?.error?.message ?? `request failed (${res.status})`,
          );
        }
        return (await res.json()) as T;
      })
      .then((d) => {
        if (!canceled) setData(d);
      })
      .catch((e: unknown) => {
        if (!canceled)
          setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [url]);

  return { data, loading, error };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
