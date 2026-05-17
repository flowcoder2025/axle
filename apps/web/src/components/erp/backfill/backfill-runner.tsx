"use client";

/**
 * Client island for the backfill staging page (Phase 21 WI-723b).
 *
 * Handles two interactions:
 *   1. "백필 1청크 실행" — POSTs /api/erp/backfill, prints the chunk result.
 *      Keeps invoking until the server reports `finished=true` so the
 *      whole backlog can be drained from the UI without dropping to the CLI.
 *   2. "이 거래처로 연결" — POSTs /api/erp/backfill/resolve for a pending
 *      group. On success the row disappears from the staging table on reload.
 *
 *  Server components render the read views; this component only owns mutation
 *  state to keep the page mostly server-rendered (see /erp/backfill/page.tsx).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";

interface ChunkResult {
  processed: number;
  matched: number;
  pendingReview: number;
  finished: boolean;
  lastOrderId: string | null;
  lockBusy: boolean;
}

interface PendingGroup {
  normalizedName: string;
  sampleName: string;
  orderCount: number;
}

interface CounterpartyOption {
  id: string;
  name: string;
  bizRegNo: string | null;
}

interface Props {
  pendingGroups: PendingGroup[];
  counterparties: CounterpartyOption[];
}

export function BackfillRunner({ pendingGroups, counterparties }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [lastResult, setLastResult] = useState<ChunkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runOnce(): Promise<ChunkResult | null> {
    const res = await fetch("/api/erp/backfill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun, chunkSize: 1000 }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { chunk: ChunkResult };
    return data.chunk;
  }

  async function handleRunAll() {
    setRunning(true);
    setError(null);
    try {
      let safety = 0;
      while (safety < 1000) {
        const r = await runOnce();
        setLastResult(r);
        if (!r || r.finished || r.lockBusy) break;
        // For dry-run a chunk is a single observation, do not loop.
        if (dryRun) break;
        safety += 1;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      startTransition(() => router.refresh());
    }
  }

  async function handleResolve(normalizedName: string, counterpartyId: string) {
    setError(null);
    try {
      const res = await fetch("/api/erp/backfill/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ normalizedName, counterpartyId }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error?.message ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6" data-testid="backfill-runner">
      <section className="rounded-md border p-4">
        <h2 className="text-base font-semibold">백필 실행</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          기존 주문의 거래처 텍스트를 ErpCounterparty 마스터에 자동 연결합니다.
          bizRegNo가 있는 마스터에 유일하게 매칭된 경우만 자동 연결되며, 그
          외에는 아래 &quot;수동 검토&quot; 목록에 표시됩니다.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            onClick={handleRunAll}
            disabled={running || isPending}
            data-testid="backfill-run-button"
          >
            {running ? "실행 중..." : dryRun ? "Dry-run 1청크" : "백필 실행"}
          </Button>
          <label className="flex items-center gap-1 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              data-testid="backfill-dry-run-toggle"
            />
            Dry-run (DB 변경 없음)
          </label>
        </div>

        {error ? (
          <div
            className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
            data-testid="backfill-error"
          >
            {error}
          </div>
        ) : null}

        {lastResult ? (
          <dl
            className="mt-4 grid grid-cols-4 gap-3 text-sm"
            data-testid="backfill-last-result"
          >
            <div>
              <dt className="text-muted-foreground">처리</dt>
              <dd className="text-lg tabular-nums">{lastResult.processed}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">자동 매칭</dt>
              <dd className="text-lg tabular-nums">{lastResult.matched}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">검토 대기</dt>
              <dd className="text-lg tabular-nums">{lastResult.pendingReview}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">상태</dt>
              <dd className="text-sm">
                {lastResult.finished ? "완료" : lastResult.lockBusy ? "대기" : "진행 중"}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="rounded-md border">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">수동 검토 ({pendingGroups.length})</h2>
          <p className="text-xs text-muted-foreground">
            동일하게 정규화된 거래처명별로 묶인 미연결 주문입니다.
          </p>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">정규화된 이름</th>
              <th className="px-3 py-2">원본 표시</th>
              <th className="px-3 py-2 text-right">주문 수</th>
              <th className="px-3 py-2">연결할 거래처</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {pendingGroups.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                  data-testid="backfill-pending-empty"
                >
                  검토 대기 중인 그룹이 없습니다.
                </td>
              </tr>
            ) : (
              pendingGroups.map((g) => (
                <PendingRow
                  key={g.normalizedName}
                  group={g}
                  counterparties={counterparties}
                  onResolve={handleResolve}
                  disabled={isPending || running}
                />
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function PendingRow({
  group,
  counterparties,
  onResolve,
  disabled,
}: {
  group: PendingGroup;
  counterparties: CounterpartyOption[];
  onResolve: (normalizedName: string, counterpartyId: string) => void;
  disabled: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  return (
    <tr className="border-t" data-testid={`backfill-pending-row-${group.normalizedName}`}>
      <td className="px-3 py-2 font-mono text-xs">{group.normalizedName}</td>
      <td className="px-3 py-2">{group.sampleName}</td>
      <td className="px-3 py-2 text-right tabular-nums">{group.orderCount}</td>
      <td className="px-3 py-2">
        <select
          className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          data-testid={`backfill-pending-select-${group.normalizedName}`}
        >
          <option value="">— 선택 —</option>
          {counterparties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.bizRegNo ? ` (${c.bizRegNo})` : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedId || disabled}
          onClick={() => selectedId && onResolve(group.normalizedName, selectedId)}
          data-testid={`backfill-pending-resolve-${group.normalizedName}`}
        >
          연결
        </Button>
      </td>
    </tr>
  );
}
