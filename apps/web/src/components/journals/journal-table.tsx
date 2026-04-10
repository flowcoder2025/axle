"use client";

import { useState } from "react";
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
import { Search } from "lucide-react";

export interface JournalRow {
  id: string;
  title: string;
  date: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  hours: number | null;
  approvedAt: string | null;
  client: { id: string; name: string };
  researcher: { id: string; name: string; position: string | null };
}

interface JournalTableProps {
  journals: JournalRow[];
  total: number;
  page: number;
  pageSize: number;
  currentClientId?: string;
  currentResearcherId?: string;
  currentStatus?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안",
  SUBMITTED: "제출됨",
  APPROVED: "승인됨",
};

const STATUS_VARIANTS: Record<
  string,
  "outline" | "secondary" | "default" | "destructive"
> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  APPROVED: "default",
};

const selectCn =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function JournalTable({
  journals,
  total,
  page,
  pageSize,
  currentClientId = "",
  currentResearcherId = "",
  currentStatus = "",
  currentDateFrom = "",
  currentDateTo = "",
}: JournalTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dateFrom, setDateFrom] = useState(currentDateFrom);
  const [dateTo, setDateTo] = useState(currentDateTo);

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

  function handleDateFilter(e: React.FormEvent) {
    e.preventDefault();
    navigate({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: "1",
    });
  }

  const hasActiveFilters =
    currentDateFrom ||
    currentDateTo ||
    currentClientId ||
    currentResearcherId ||
    currentStatus;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <form onSubmit={handleDateFilter} className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">시작일</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={selectCn}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">종료일</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={selectCn}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            <Search className="mr-1 h-4 w-4" />
            필터 적용
          </Button>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate({
                  dateFrom: undefined,
                  dateTo: undefined,
                  clientId: undefined,
                  researcherContactId: undefined,
                  status: undefined,
                  page: "1",
                })
              }
            >
              초기화
            </Button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제목</TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>연구자</TableHead>
              <TableHead>날짜</TableHead>
              <TableHead>시간(h)</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  연구일지 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              journals.map((journal) => (
                <TableRow key={journal.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Link
                      href={`/journals/${journal.id}`}
                      className="font-medium hover:underline"
                    >
                      {journal.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {journal.client.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {journal.researcher.name}
                    {journal.researcher.position && (
                      <span className="text-xs ml-1 text-muted-foreground/70">
                        ({journal.researcher.position})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(journal.date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {journal.hours !== null ? (
                      <span>{journal.hours}h</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[journal.status] ?? "outline"}>
                      {STATUS_LABELS[journal.status] ?? journal.status}
                    </Badge>
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
            총 {total}개 중 {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)}개 표시
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => navigate({ page: String(page - 1) })}
            >
              이전
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - page) <= 2
              )
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                  acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1">
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => navigate({ page: String(p) })}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => navigate({ page: String(page + 1) })}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
