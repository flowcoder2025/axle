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
import type { ContractStatus } from "@prisma/client";

const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "초안",
  SENT: "발송",
  SIGNED: "서명완료",
  EXPIRED: "만료",
};

const STATUS_VARIANTS: Record<ContractStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "default",
  SIGNED: "default",
  EXPIRED: "destructive",
};

export interface ContractRow {
  id: string;
  contractNumber: string;
  clientId: string;
  projectId: string | null;
  title: string;
  totalAmount: string | number | null;
  status: ContractStatus;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  createdAt: string;
  client: { name: string };
}

interface ContractTableProps {
  contracts: ContractRow[];
  total: number;
  page: number;
  pageSize: number;
  currentStatus?: string;
}

function formatKRW(amount: string | number | null): string {
  if (amount == null) return "-";
  return Number(amount).toLocaleString("ko-KR") + "원";
}

export function ContractTable({
  contracts,
  total,
  page,
  pageSize,
  currentStatus = "",
}: ContractTableProps) {
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
          <option value="SIGNED">서명완료</option>
          <option value="EXPIRED">만료</option>
        </select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>계약번호</TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>제목</TableHead>
              <TableHead className="text-right">계약금액</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>계약기간</TableHead>
              <TableHead>서명일</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  계약서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-mono text-sm">
                    {contract.contractNumber}
                  </TableCell>
                  <TableCell>{contract.client.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {contract.title}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatKRW(contract.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[contract.status]}>
                      {STATUS_LABELS[contract.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contract.startDate && contract.endDate
                      ? `${new Date(contract.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(contract.endDate).toLocaleDateString("ko-KR")}`
                      : contract.startDate
                        ? new Date(contract.startDate).toLocaleDateString("ko-KR")
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {contract.signedAt
                      ? new Date(contract.signedAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/contracts/${contract.id}`}>상세</Link>
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
