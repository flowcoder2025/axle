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
import { Sparkles } from "lucide-react";

interface AiJob {
  id: string;
  projectId: string | null;
  type: string;
  tier: string;
  status: string;
  cost: number | string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ProjectAiJobListProps {
  projectId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

const TYPE_LABEL: Record<string, string> = {
  BUSINESS_PLAN: "사업계획서",
  RESEARCH: "리서치",
  OCR: "OCR",
  TRANSCRIBE: "전사",
  SUMMARY: "요약",
  JOURNAL_DRAFT: "연구일지 초안",
  FINANCIAL_ANALYSIS: "재무분석",
  GAP_DIAGNOSIS: "갭 진단",
  EVALUATION: "평가",
  MATCHING: "매칭",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  QUEUED: { label: "대기", variant: "secondary" },
  RUNNING: { label: "실행중", variant: "outline" },
  COMPLETED: { label: "완료", variant: "default" },
  FAILED: { label: "실패", variant: "destructive" },
};

export function ProjectAiJobList({ projectId }: ProjectAiJobListProps) {
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ai/jobs?projectId=${projectId}&pageSize=50`
      );
      if (!res.ok) {
        throw new Error("AI 작업 목록을 불러오지 못했습니다");
      }
      const json = await res.json();
      setJobs(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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
          onClick={fetchJobs}
          className="text-sm text-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          이 프로젝트에 AI 작업 이력이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">총 {total}건</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>유형</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>티어</TableHead>
            <TableHead>소요시간</TableHead>
            <TableHead>비용</TableHead>
            <TableHead>생성일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const statusCfg = STATUS_CONFIG[job.status] ?? {
              label: job.status,
              variant: "secondary" as const,
            };
            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {TYPE_LABEL[job.type] ?? job.type}
                </TableCell>
                <TableCell>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground uppercase">
                  {job.tier}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDuration(job.durationMs)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {job.cost != null ? `${Number(job.cost).toLocaleString()}원` : "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(job.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
