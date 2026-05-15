/**
 * MovementTimeline — Server Component.
 *
 * Renders inventory movements as a table sorted desc by `occurredAt`. The
 * caller is responsible for fetching and serializing rows (we accept the
 * already-serialized shape so Date/Decimal are strings, not raw values).
 */

import type { SerializedInventoryMovement } from "@/lib/erp/serialize";

interface MovementTimelineProps {
  movements: SerializedInventoryMovement[];
  unit: string;
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatOccurredAt(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFormatter.format(d);
}

const typeBadge: Record<string, { label: string; className: string }> = {
  IN: {
    label: "입고",
    className: "bg-emerald-100 text-emerald-800",
  },
  OUT: {
    label: "출고",
    className: "bg-rose-100 text-rose-800",
  },
  ADJUST: {
    label: "조정",
    className: "bg-amber-100 text-amber-800",
  },
};

export function MovementTimeline({ movements, unit }: MovementTimelineProps) {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">발생 일시</th>
            <th className="px-3 py-2">유형</th>
            <th className="px-3 py-2 text-right">수량</th>
            <th className="px-3 py-2">출처</th>
            <th className="px-3 py-2">메모</th>
          </tr>
        </thead>
        <tbody>
          {movements.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                선택한 기간/유형에 해당하는 재고 이동이 없습니다.
              </td>
            </tr>
          ) : (
            movements.map((m) => {
              const badge = typeBadge[m.type] ?? {
                label: m.type,
                className: "bg-muted text-muted-foreground",
              };
              return (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatOccurredAt(m.occurredAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.qty} {unit}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {m.source ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {m.note ?? "-"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
