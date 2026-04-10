import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { EstimateActions } from "../../../../src/components/estimates/estimate-actions";
import type { EstimateStatus } from "@prisma/client";

export const metadata = {
  title: "견적서 상세 | AXLE",
};

const STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: "초안",
  SENT: "발송",
  ACCEPTED: "수락",
  REJECTED: "거절",
};

interface PageProps {
  params: Promise<{ estimateId: string }>;
}

function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

export default async function EstimateDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.orgId) notFound();

  const { estimateId } = await params;
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, client: { orgId: user.orgId } },
    include: { client: { select: { id: true, name: true, email: true } } },
  });
  if (!estimate) notFound();

  const items = Array.isArray(estimate.items)
    ? (estimate.items as Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        amount: number;
      }>)
    : [];

  const totalAmount = Number(estimate.totalAmount);
  const taxAmount = estimate.taxAmount ? Number(estimate.taxAmount) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {estimate.estimateNumber}
            </h1>
            <Badge>{STATUS_LABELS[estimate.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            고객사: {estimate.client.name}
          </p>
        </div>
        <EstimateActions
          estimateId={estimateId}
          status={estimate.status}
          estimateNumber={estimate.estimateNumber}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">견적번호</dt>
              <dd className="font-mono mt-0.5">{estimate.estimateNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">고객사</dt>
              <dd className="mt-0.5">
                <Link
                  href={`/clients/${estimate.client.id}`}
                  className="text-primary hover:underline"
                >
                  {estimate.client.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">상태</dt>
              <dd className="mt-0.5">
                <Badge>{STATUS_LABELS[estimate.status]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">유효기간</dt>
              <dd className="mt-0.5">
                {estimate.validUntil
                  ? new Date(estimate.validUntil).toLocaleDateString("ko-KR")
                  : "-"}
              </dd>
            </div>
            {estimate.sentAt && (
              <div>
                <dt className="text-muted-foreground">발송일</dt>
                <dd className="mt-0.5">
                  {new Date(estimate.sentAt).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">생성일</dt>
              <dd className="mt-0.5">
                {new Date(estimate.createdAt).toLocaleDateString("ko-KR")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>견적 항목</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left font-medium">품목명</th>
                  <th className="pb-2 text-right font-medium">수량</th>
                  <th className="pb-2 text-right font-medium">단가</th>
                  <th className="pb-2 text-right font-medium">금액</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{formatKRW(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">
                      {formatKRW(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={3} className="pt-3 text-right text-muted-foreground">
                    공급가액
                  </td>
                  <td className="pt-3 text-right font-medium">
                    {formatKRW(totalAmount)}
                  </td>
                </tr>
                {taxAmount !== null && (
                  <tr>
                    <td colSpan={3} className="py-1 text-right text-muted-foreground">
                      부가세
                    </td>
                    <td className="py-1 text-right text-muted-foreground">
                      {formatKRW(taxAmount)}
                    </td>
                  </tr>
                )}
                <tr className="border-t">
                  <td colSpan={3} className="pt-2 text-right font-bold">
                    합계
                  </td>
                  <td className="pt-2 text-right font-bold text-primary">
                    {formatKRW(totalAmount + (taxAmount ?? 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
