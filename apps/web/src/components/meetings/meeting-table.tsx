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

export interface MeetingRow {
  id: string;
  title: string;
  date: string;
  location: string | null;
  client: { id: string; name: string };
  project: { id: string; title: string } | null;
  _count: { attendees: number; actionItems: number };
  hasTranscript: boolean;
  hasSummary: boolean;
}

interface MeetingTableProps {
  meetings: MeetingRow[];
  total: number;
  page: number;
  pageSize: number;
  currentClientId?: string;
  currentProjectId?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const selectCn =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function MeetingTable({
  meetings,
  total,
  page,
  pageSize,
  currentClientId = "",
  currentProjectId = "",
  currentDateFrom = "",
  currentDateTo = "",
}: MeetingTableProps) {
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <form onSubmit={handleDateFilter} className="flex items-end gap-2">
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
          {(currentDateFrom || currentDateTo || currentClientId || currentProjectId) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate({
                  dateFrom: undefined,
                  dateTo: undefined,
                  clientId: undefined,
                  projectId: undefined,
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
              <TableHead>일시</TableHead>
              <TableHead>참석자</TableHead>
              <TableHead>전사 상태</TableHead>
              <TableHead>액션 아이템</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  미팅 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              meetings.map((meeting) => (
                <TableRow key={meeting.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="font-medium hover:underline"
                    >
                      {meeting.title}
                    </Link>
                    {meeting.project && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meeting.project.title}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {meeting.client.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(meeting.date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {meeting._count.attendees}명
                  </TableCell>
                  <TableCell>
                    {meeting.hasSummary ? (
                      <Badge variant="default">요약 완료</Badge>
                    ) : meeting.hasTranscript ? (
                      <Badge variant="secondary">전사 있음</Badge>
                    ) : (
                      <Badge variant="outline">미등록</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {meeting._count.actionItems > 0 ? (
                      <span>{meeting._count.actionItems}개</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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
