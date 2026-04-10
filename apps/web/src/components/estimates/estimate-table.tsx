"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Button,
  Badge,
} from "@axle/ui";
import type { EstimateStatus } from "@prisma/client";

const STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: "초안",
  SENT: "발송",
  ACCEPTED: "수락",
  REJECTED: "거절",
};

const STATUS_VARIANTS: Record<EstimateStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "default",
  REJECTED: "destructive",
};

export interface EstimateRow {
  id: string;
  estimateNumber: string;
  clientId: string;
  projectId: string | null;
  totalAmount: string | number;
  taxAmount: string | number | null;
  status: EstimateStatus;
  validUntil: string | null;
  sentAt: string | null;
  createdAt: string;
  client: { name: string };
}

interface EstimateTableProps {
  estimates: EstimateRow[];
  total: number;
  page: number;
  pageSize: number;
  currentStatus?: string;
  currentClientId?: string;
}

function formatKRW(amount: string | number): string {
  return Number(amount).toLocaleString("ko-KR") + "원";
}

export function EstimateTable({
  estimates,
  total,
  page,
  pageSize,
  currentStatus = "",
  currentClientId = "",
}: EstimateTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);

  function buildParams(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    return params.toString();
  }

  function navigate(overrides: Record<string, string | undefined>) {
    const qs = buildParams(overrides);
    router.push(`${pathname}?${qs}`);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={currentStatus}
          onChange={(e) => navigate({ status: e.target.value || undefined, page: "1" })}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">전체 상태</option>
          <option value="DRAFT">초안</option>
          <option value="SENT">발송</option>
          <option value="ACCEPTED">수락</option>
          <option value="REJECTED">거절</option>
        </select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>견적번호</TableHead>
              <TableHead>고객사</TableHead>
              <TableHead className="text-right">총액</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>유효기간</TableHead>
              <TableHead>발송일</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  견적서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              estimates.map((estimate) => (
                <TableRow key={estimate.id}>
                  <TableCell className="font-mono text-sm">
                    {estimate.estimateNumber}
                  </TableCell>
                  <TableCell>{estimate.client.name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatKRW(estimate.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[estimate.status]}>
                      {STATUS_LABELS[estimate.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {estimate.validUntil
                      ? new Date(estimate.validUntil).toLocaleDateString("ko-KR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {estimate.sentAt
                      ? new Date(estimate.sentAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(estimate.createdAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/estimates/${estimate.id}`}>상세</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total}건 중 {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)}건
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ page: String(page - 1) })}
              disabled={page <= 1}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ page: String(page + 1) })}
              disabled={page >= totalPages}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
