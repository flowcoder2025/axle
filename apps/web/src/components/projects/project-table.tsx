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
  Input,
} from "@axle/ui";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectTypeBadge } from "./project-type-badge";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import type { ProjectType, ProjectStatus } from "@prisma/client";

export interface ProjectRow {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  assignedTo: string | null;
  dueDate: string | null;
  client: { name: string };
}

interface ProjectTableProps {
  projects: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
  currentQ?: string;
  currentType?: string;
  currentStatus?: string;
  currentSortBy?: string;
  currentSortOrder?: string;
}

type SortBy = "title" | "createdAt" | "updatedAt" | "status" | "dueDate";
type SortOrder = "asc" | "desc";

export function ProjectTable({
  projects,
  total,
  page,
  pageSize,
  currentQ = "",
  currentType = "",
  currentStatus = "",
  currentSortBy = "createdAt",
  currentSortOrder = "desc",
}: ProjectTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentQ);

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: searchInput || undefined, page: "1" });
  }

  function handleSort(column: SortBy) {
    const newOrder =
      currentSortBy === column && currentSortOrder === "asc" ? "desc" : "asc";
    navigate({ sortBy: column, sortOrder: newOrder, page: "1" });
  }

  function SortIcon({ column }: { column: SortBy }) {
    if (currentSortBy !== column) return null;
    return currentSortOrder === "asc" ? (
      <ChevronUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-1" />
    );
  }

  function formatDate(iso: string | null) {
    if (!iso) return "-";
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-56"
              placeholder="프로젝트명 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            검색
          </Button>
        </form>

        <div className="flex gap-2 flex-wrap">
          <select
            value={currentType}
            onChange={(e) => navigate({ type: e.target.value || undefined, page: "1" })}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">전체 유형</option>
            <option value="BUSINESS_PLAN">사업계획서</option>
            <option value="VENTURE_CERT">벤처인증</option>
            <option value="SOBOOJANG_CERT">소부장인증</option>
            <option value="RESEARCH_INSTITUTE">연구소설립</option>
            <option value="PATENT">특허</option>
            <option value="FINANCIAL_ANALYSIS">재무분석</option>
            <option value="RESEARCH_TASK">연구과제</option>
            <option value="BUNDLE">통합패키지</option>
          </select>
          <select
            value={currentStatus}
            onChange={(e) => navigate({ status: e.target.value || undefined, page: "1" })}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">전체 상태</option>
            <option value="INTAKE">접수</option>
            <option value="DOC_COLLECTING">서류 수집 중</option>
            <option value="IN_PROGRESS">진행 중</option>
            <option value="REVIEW">검토 중</option>
            <option value="SUBMITTED">제출 완료</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
            <option value="COMPLETED">완료</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("title")}
              >
                프로젝트명
                <SortIcon column="title" />
              </TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>유형</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                상태
                <SortIcon column="status" />
              </TableHead>
              <TableHead>담당자</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("dueDate")}
              >
                마감일
                <SortIcon column="dueDate" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  프로젝트가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium hover:underline"
                    >
                      {project.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.client.name}
                  </TableCell>
                  <TableCell>
                    <ProjectTypeBadge type={project.type} />
                  </TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={project.status} />
                  </TableCell>
                  <TableCell>{project.assignedTo ?? "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(project.dueDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1">…</span>
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
