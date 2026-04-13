"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@axle/ui";
import { Video } from "lucide-react";
import Link from "next/link";

interface Meeting {
  id: string;
  title: string;
  date: string;
  location: string | null;
  _count: { attendees: number; actionItems: number };
  hasTranscript: boolean;
  hasSummary: boolean;
}

interface ProjectMeetingListProps {
  projectId: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }) + " " + d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectMeetingList({ projectId }: ProjectMeetingListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/meetings?projectId=${projectId}&pageSize=50`
      );
      if (!res.ok) {
        throw new Error("미팅 목록을 불러오지 못했습니다");
      }
      const json = await res.json();
      setMeetings(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
        <button
          type="button"
          onClick={fetchMeetings}
          className="text-sm text-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <Video className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          이 프로젝트에 연결된 미팅이 없습니다.
        </p>
        <Link
          href="/meetings/new"
          className="mt-3 text-sm text-primary hover:underline"
        >
          새 미팅 등록하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">총 {total}건</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>미팅명</TableHead>
            <TableHead>일시</TableHead>
            <TableHead>장소</TableHead>
            <TableHead className="text-center">참석자</TableHead>
            <TableHead className="text-center">액션 아이템</TableHead>
            <TableHead>전사/요약</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meetings.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium max-w-[250px] truncate">
                <Link
                  href={`/meetings/${m.id}`}
                  className="hover:text-primary hover:underline"
                >
                  {m.title}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {formatDateTime(m.date)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {m.location ?? "-"}
              </TableCell>
              <TableCell className="text-center text-sm">
                {m._count.attendees}명
              </TableCell>
              <TableCell className="text-center text-sm">
                {m._count.actionItems}건
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {m.hasTranscript && (
                    <Badge variant="outline" className="text-xs">전사</Badge>
                  )}
                  {m.hasSummary && (
                    <Badge variant="outline" className="text-xs">요약</Badge>
                  )}
                  {!m.hasTranscript && !m.hasSummary && (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
