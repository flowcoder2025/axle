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
import { FolderOpen } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignedToUser: { name: string | null; email: string } | null;
  dueDate: string | null;
  createdAt: string;
}

interface ClientProjectListProps {
  clientId: string;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INTAKE: { label: "접수", variant: "secondary" },
  DOC_COLLECTING: { label: "서류 수집 중", variant: "secondary" },
  IN_PROGRESS: { label: "진행 중", variant: "default" },
  REVIEW: { label: "검토 중", variant: "outline" },
  SUBMITTED: { label: "제출 완료", variant: "outline" },
  APPROVED: { label: "선정", variant: "default" },
  REJECTED: { label: "탈락", variant: "destructive" },
  COMPLETED: { label: "완료", variant: "default" },
};

const TYPE_LABEL: Record<string, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처인증",
  SOBOOJANG_CERT: "소부장인증",
  RESEARCH_INSTITUTE: "연구소설립",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무분석",
  RESEARCH_TASK: "연구과제",
  BUNDLE: "번들",
};

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: "긴급",
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

export function ClientProjectList({ clientId }: ClientProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects?clientId=${clientId}&pageSize=50`
      );
      if (!res.ok) {
        throw new Error("프로젝트 목록을 불러오지 못했습니다");
      }
      const json = await res.json();
      setProjects(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
          onClick={fetchProjects}
          className="text-sm text-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <FolderOpen className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          이 고객사에 등록된 프로젝트가 없습니다.
        </p>
        <Link
          href="/projects/new"
          className="mt-3 text-sm text-primary hover:underline"
        >
          새 프로젝트 추가하기
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
            <TableHead>프로젝트명</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>우선순위</TableHead>
            <TableHead>담당자</TableHead>
            <TableHead>마감일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => {
            const statusCfg = STATUS_CONFIG[p.status] ?? {
              label: p.status,
              variant: "secondary" as const,
            };
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium max-w-[250px] truncate">
                  <Link
                    href={`/projects/${p.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {p.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TYPE_LABEL[p.type] ?? p.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {PRIORITY_LABEL[p.priority] ?? p.priority}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.assignedToUser?.name ?? "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(p.dueDate)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
