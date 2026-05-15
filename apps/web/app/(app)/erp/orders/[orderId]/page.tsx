/**
 * /erp/orders/[orderId] — Order detail (Server Component).
 *
 * Shows counterparty / date / status / totals + line items. If the order
 * was created from a receipt intake (source = RECEIPT_INTAKE), we surface
 * a link back to the intake review page.
 *
 * The "취소" button is a small Client Component (`OrderCancelButton`)
 * that POSTs to the cancel route and refreshes the page on success. It
 * is rendered only when status === "CONFIRMED".
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@axle/db";
import { requireErpScope } from "@/lib/erp/auth";
import { serializeOrder } from "@/lib/erp/serialize";
import { OrderCancelButton } from "./order-cancel-button";

export const metadata = {
  title: "주문 상세 | AXLE",
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

function statusBadge(status: string): { label: string; className: string } {
  if (status === "CONFIRMED")
    return { label: "확정", className: "bg-green-100 text-green-800" };
  if (status === "CANCELLED")
    return { label: "취소", className: "bg-red-100 text-red-800" };
  return { label: "초안", className: "bg-muted text-muted-foreground" };
}

function typeLabel(type: string): string {
  return type === "PURCHASE" ? "구매" : type === "SALE" ? "판매" : type;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const ctx = await requireErpScope("erp:read");
  const { orderId } = await params;

  const row = await prisma.order.findFirst({
    where: { id: orderId, orgId: ctx.orgId },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, sku: true } } },
      },
    },
  });
  if (!row) notFound();
  const order = serializeOrder(row);

  const badge = statusBadge(order.status);
  const isCancellable = order.status === "CONFIRMED";
  const intakeLink =
    order.source === "RECEIPT_INTAKE" && order.sourceId
      ? `/erp/intake/${order.sourceId}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {order.counterpartyName}
            </h1>
            <span className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {typeLabel(order.type)} · {order.occurredAt?.slice(0, 10) ?? "-"}
            {" · "}주문 ID <span className="font-mono">{order.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/erp/orders"
            className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm hover:bg-muted"
          >
            목록으로
          </Link>
          {isCancellable ? <OrderCancelButton orderId={order.id} /> : null}
        </div>
      </div>

      {/* Summary card */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">총액</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{order.total}</div>
          <div className="text-xs text-muted-foreground">KRW</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">부가세</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{order.tax}</div>
          <div className="text-xs text-muted-foreground">KRW</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">품목수</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {order.items?.length ?? 0}
          </div>
          <div className="text-xs text-muted-foreground">건</div>
        </div>
      </div>

      {/* Intake link */}
      {intakeLink ? (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          이 주문은 영수증 인테이크에서 생성되었습니다.{" "}
          <Link className="underline" href={intakeLink}>
            원본 영수증 보기
          </Link>
        </div>
      ) : null}

      {/* Items */}
      <div className="rounded-md border">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
          품목 ({order.items?.length ?? 0}건)
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">상품</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">수량</th>
              <th className="px-3 py-2 text-right">단가</th>
              <th className="px-3 py-2 text-right">소계</th>
            </tr>
          </thead>
          <tbody>
            {!order.items || order.items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  품목이 없습니다.
                </td>
              </tr>
            ) : (
              order.items.map((it) => {
                const productMeta = row.items.find((r) => r.id === it.id)?.product;
                return (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      {productMeta ? (
                        <Link
                          className="font-medium hover:underline"
                          href={`/erp/products/${productMeta.id}`}
                        >
                          {it.productName}
                        </Link>
                      ) : (
                        <span>{it.productName}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {productMeta?.sku ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.unitPrice}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.lineTotal}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {order.note ? (
        <div className="rounded-md border bg-card p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">메모</div>
          <div className="mt-1 whitespace-pre-wrap">{order.note}</div>
        </div>
      ) : null}
    </div>
  );
}
