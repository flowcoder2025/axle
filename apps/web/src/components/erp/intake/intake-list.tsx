/**
 * IntakeList — Status-filter tabs + table of intake drafts.
 *
 * Server Component: tab state is encoded entirely in the URL (`?status=...`),
 * so no client-side reactivity is needed. Tabs are plain `<Link>`s.
 *
 * Caller (apps/web/app/(app)/erp/intake/page.tsx) hands us already-serialized
 * rows so we don't deal with Prisma types or Decimal here.
 */

import Link from "next/link";
import type { ReceiptData } from "@axle/ocr";

export interface IntakeListItem {
  id: string;
  status: string;
  blobUrl: string;
  parsed: Partial<ReceiptData> | null;
  confirmedOrderId: string | null;
  createdAt: string;
}

interface IntakeListProps {
  items: IntakeListItem[];
  currentStatus: "PENDING" | "CONFIRMED" | "DISCARDED" | undefined;
}

const TABS: Array<{
  label: string;
  status: "PENDING" | "CONFIRMED" | "DISCARDED" | undefined;
}> = [
  { label: "전체", status: undefined },
  { label: "대기", status: "PENDING" },
  { label: "완료", status: "CONFIRMED" },
  { label: "폐기", status: "DISCARDED" },
];

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  PENDING: { text: "대기", className: "bg-amber-100 text-amber-800" },
  CONFIRMED: { text: "완료", className: "bg-green-100 text-green-800" },
  DISCARDED: { text: "폐기", className: "bg-muted text-muted-foreground" },
};

const CURRENCY_FMT = new Intl.NumberFormat("ko-KR");
const DATE_FMT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatTotal(total: unknown): string {
  if (typeof total !== "number" || !Number.isFinite(total)) return "-";
  return CURRENCY_FMT.format(total);
}

function tabHref(status: IntakeListProps["currentStatus"]): string {
  return status ? `/erp/intake?status=${status}` : "/erp/intake";
}

export function IntakeList({ items, currentStatus }: IntakeListProps) {
  return (
    <div className="space-y-3">
      <nav
        aria-label="영수증 상태 필터"
        className="flex items-center gap-1 border-b text-sm"
      >
        {TABS.map((tab) => {
          const active = currentStatus === tab.status;
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.status)}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "border-b-2 border-foreground px-3 py-2 font-medium"
                  : "border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">썸네일</th>
              <th className="px-3 py-2">등록일자</th>
              <th className="px-3 py-2">거래처</th>
              <th className="px-3 py-2 text-right">품목수</th>
              <th className="px-3 py-2 text-right">총액 (KRW)</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  등록된 영수증이 없습니다. 우측 상단의 &quot;새 영수증&quot; 버튼으로 추가하세요.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const itemCount = Array.isArray(item.parsed?.items)
                  ? item.parsed!.items!.length
                  : 0;
                const vendor =
                  (item.parsed?.vendor && item.parsed.vendor.trim()) || "-";
                const statusBadge = STATUS_LABEL[item.status] ?? {
                  text: item.status,
                  className: "bg-muted text-muted-foreground",
                };
                const createdAt = new Date(item.createdAt);

                return (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.blobUrl}
                        alt="영수증 썸네일"
                        className="h-12 w-12 rounded border object-cover"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {DATE_FMT.format(createdAt)}
                    </td>
                    <td className="px-3 py-2">{vendor}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{itemCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatTotal(item.parsed?.total)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${statusBadge.className}`}
                      >
                        {statusBadge.text}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.status === "PENDING" ? (
                        <Link
                          href={`/erp/intake/${item.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          검토
                        </Link>
                      ) : item.status === "CONFIRMED" && item.confirmedOrderId ? (
                        <Link
                          href={`/erp/orders/${item.confirmedOrderId}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          보기
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
