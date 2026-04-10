"use client";

import { useState, useCallback } from "react";
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
import { ClientStatusBadge } from "./client-status-badge";
import { ChevronUp, ChevronDown, Search, MoreHorizontal } from "lucide-react";

type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";
type SortBy = "name" | "createdAt" | "updatedAt" | "status";
type SortOrder = "asc" | "desc";

export interface ClientRow {
  id: string;
  name: string;
  ceoName?: string | null;
  status: ClientStatus;
  assignedTo?: string | null;
  updatedAt: string;
  industry?: string | null;
  region?: string | null;
}

interface ClientTableProps {
  clients: ClientRow[];
  total: number;
  page: number;
  pageSize: number;
  currentQ?: string;
  currentStatus?: string;
  currentSortBy?: SortBy;
  currentSortOrder?: SortOrder;
}

export function ClientTable({
  clients,
  total,
  page,
  pageSize,
  currentQ = "",
  currentStatus = "",
  currentSortBy = "createdAt",
  currentSortOrder = "desc",
}: ClientTableProps) {
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

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigate({ q: searchInput || undefined, page: "1" });
    },
    [searchInput]
  );

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

  return (
    <div className="space-y-4">
      {/* Search and filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder="고객사명 또는 사업자번호 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            검색
          </Button>
        </form>

        <div className="flex gap-2">
          {/* Status filter */}
          <select
            value={currentStatus}
            onChange={(e) =>
              navigate({ status: e.target.value || undefined, page: "1" })
            }
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">전체 상태</option>
            <option value="ACTIVE">활성</option>
            <option value="INACTIVE">비활성</option>
            <option value="PROSPECT">잠재</option>
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
                이름
                <SortIcon column="name" />
              </TableHead>
              <TableHead>대표자</TableHead>
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
                onClick={() => handleSort("updatedAt")}
              >
                업데이트일
                <SortIcon column="updatedAt" />
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  고객사가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium hover:underline"
                    >
                      {client.name}
                    </Link>
                    {client.industry && (
                      <p className="text-xs text-muted-foreground">{client.industry}</p>
                    )}
                  </TableCell>
                  <TableCell>{client.ceoName ?? "-"}</TableCell>
                  <TableCell>
                    <ClientStatusBadge status={client.status} />
                  </TableCell>
                  <TableCell>{client.assignedTo ?? "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(client.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">메뉴 열기</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}`}>상세 보기</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}/edit`}>수정</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
