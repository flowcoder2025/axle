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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@axle/ui";
import { ProgramCategoryBadge } from "./program-category-badge";
import { ChevronUp, ChevronDown, Search, MoreHorizontal } from "lucide-react";
import type { ProgramCategory } from "@prisma/client";

type SortBy = "applicationEnd" | "name" | "createdAt";
type SortOrder = "asc" | "desc";

export interface ProgramRow {
  id: string;
  name: string;
  agency: string | null;
  category: ProgramCategory;
  applicationStart: string | null;
  applicationEnd: string | null;
  maxFunding: string | null;
  region: string | null;
  _count: { matchingResults: number; schedules: number };
}

interface ProgramTableProps {
  programs: ProgramRow[];
  total: number;
  page: number;
  pageSize: number;
  currentQ?: string;
  currentCategory?: string;
  currentSortBy?: string;
  currentSortOrder?: string;
}

const CATEGORY_OPTIONS: { value: ProgramCategory; label: string }[] = [
  { value: "STARTUP", label: "창업" },
  { value: "VENTURE", label: "벤처" },
  { value: "RND", label: "R&D" },
  { value: "CERTIFICATION", label: "인증" },
  { value: "EXPORT", label: "수출" },
  { value: "SMART_FACTORY", label: "스마트공장" },
  { value: "GENERAL", label: "일반" },
];

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

function formatFunding(value: string | null) {
  if (!value) return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";
  if (num >= 100_000_000) {
    return `${(num / 100_000_000).toLocaleString("ko-KR")}억원`;
  }
  if (num >= 10_000) {
    return `${(num / 10_000).toLocaleString("ko-KR")}만원`;
  }
  return `${num.toLocaleString("ko-KR")}원`;
}

function isExpired(applicationEnd: string | null) {
  if (!applicationEnd) return false;
  return new Date(applicationEnd) < new Date();
}

export function ProgramTable({
  programs,
  total,
  page,
  pageSize,
  currentQ = "",
  currentCategory = "",
  currentSortBy = "applicationEnd",
  currentSortOrder = "asc",
}: ProgramTableProps) {
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

  async function handleDelete(programId: string, programName: string) {
    if (!confirm(`"${programName}" 지원사업을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/programs/${programId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
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
              className="pl-8 w-64"
              placeholder="지원사업명 또는 기관 검색"
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
            value={currentCategory}
            onChange={(e) =>
              navigate({ category: e.target.value || undefined, page: "1" })
            }
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">전체 카테고리</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("name")}
              >
                프로그램명
                <SortIcon column="name" />
              </TableHead>
              <TableHead>기관</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("applicationEnd")}
              >
                마감일
                <SortIcon column="applicationEnd" />
              </TableHead>
              <TableHead>최대지원금</TableHead>
              <TableHead>지역</TableHead>
              <TableHead>매칭 수</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground"
                >
                  지원사업이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              programs.map((program) => {
                const expired = isExpired(program.applicationEnd);
                return (
                  <TableRow
                    key={program.id}
                    className={
                      expired
                        ? "hover:bg-muted/30 opacity-60"
                        : "hover:bg-muted/30"
                    }
                  >
                    <TableCell>
                      <Link
                        href={`/programs/${program.id}`}
                        className="font-medium hover:underline"
                      >
                        {program.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {program.agency ?? "-"}
                    </TableCell>
                    <TableCell>
                      <ProgramCategoryBadge category={program.category} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {expired ? (
                        <span className="text-muted-foreground line-through">
                          {formatDate(program.applicationEnd)}
                        </span>
                      ) : (
                        formatDate(program.applicationEnd)
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatFunding(program.maxFunding)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {program.region ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {program._count.matchingResults}건
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">메뉴 열기</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/programs/${program.id}`}>
                              상세 보기
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() =>
                              handleDelete(program.id, program.name)
                            }
                          >
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
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
                (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
              )
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                  acc.push("...");
                }
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
