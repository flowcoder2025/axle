/**
 * /erp/backfill — Counterparty backfill staging UI (Phase 21 WI-723b).
 *
 * Org admins drive the WI-721 → WI-723c transition from here: kick off the
 * automatic linker, watch progress, and resolve ambiguous Counterparty name
 * groups by hand (those that the auto-matcher refused for safety).
 *
 * Auth: `erp:read` to view; mutations check `erp:write` server-side.
 */

import { prisma } from "@axle/db";
import { requireErpScope } from "@/lib/erp/auth";
import { listPendingGroups, serializeBatch } from "@/lib/erp/backfill";
import { BackfillRunner } from "@/src/components/erp/backfill/backfill-runner";

export const metadata = {
  title: "거래처 백필 | AXLE",
};

const MAX_BATCH_HISTORY = 10;
const MAX_COUNTERPARTY_PICKER = 500;

export default async function ErpBackfillPage() {
  const ctx = await requireErpScope("erp:read");

  const [batches, pendingGroups, counterpartyRows, nullCount] = await Promise.all([
    prisma.counterpartyBackfillBatch.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { startedAt: "desc" },
      take: MAX_BATCH_HISTORY,
    }),
    listPendingGroups({ orgId: ctx.orgId, limit: 200 }, prisma),
    prisma.erpCounterparty.findMany({
      where: { orgId: ctx.orgId, deletedAt: null },
      orderBy: { name: "asc" },
      take: MAX_COUNTERPARTY_PICKER,
      select: { id: true, name: true, bizRegNo: true },
    }),
    prisma.order.count({ where: { orgId: ctx.orgId, counterpartyId: null } }),
  ]);

  const batchList = batches.map(serializeBatch);

  return (
    <div className="space-y-6" data-testid="page-erp-backfill">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">거래처 백필</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase 21 WI-723b — 기존 주문의 거래처 텍스트를 ErpCounterparty 마스터로
          연결합니다. bizRegNo가 있는 마스터에 유일하게 매칭될 때만 자동 처리되며,
          그 외에는 수동 검토로 표시됩니다.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="미연결 주문" value={nullCount} testId="backfill-stat-null-orders" />
        <Stat
          label="검토 대기 그룹"
          value={pendingGroups.length}
          testId="backfill-stat-pending-groups"
        />
        <Stat
          label="등록된 거래처"
          value={counterpartyRows.length}
          testId="backfill-stat-counterparties"
        />
      </section>

      <BackfillRunner
        pendingGroups={pendingGroups}
        counterparties={counterpartyRows.map((c) => ({
          id: c.id,
          name: c.name,
          bizRegNo: c.bizRegNo,
        }))}
      />

      <section className="rounded-md border">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">최근 배치</h2>
          <p className="text-xs text-muted-foreground">
            최대 {MAX_BATCH_HISTORY}개까지 표시됩니다.
          </p>
        </header>
        <table className="w-full text-sm" data-testid="backfill-batch-history">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">시작</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2 text-right">총 주문</th>
              <th className="px-3 py-2 text-right">처리</th>
              <th className="px-3 py-2 text-right">자동 매칭</th>
              <th className="px-3 py-2 text-right">검토 대기</th>
              <th className="px-3 py-2">완료</th>
            </tr>
          </thead>
          <tbody>
            {batchList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  실행된 배치가 없습니다. 상단의 &quot;백필 실행&quot;을 눌러 시작하세요.
                </td>
              </tr>
            ) : (
              batchList.map((b) => (
                <tr key={b.id} className="border-t" data-testid={`backfill-batch-row-${b.id}`}>
                  <td className="px-3 py-2 tabular-nums">{formatTime(b.startedAt)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.totalOrders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.processedOrders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.matchedCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.pendingReview}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {b.completedAt ? formatTime(b.completedAt) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div className="rounded-md border p-4" data-testid={testId}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "COMPLETED"
      ? "bg-green-100 text-green-800"
      : status === "RUNNING"
        ? "bg-blue-100 text-blue-800"
        : status === "FAILED"
          ? "bg-red-100 text-red-800"
          : "bg-muted text-muted-foreground";
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 19).replace("T", " ");
}
