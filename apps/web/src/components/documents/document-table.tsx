"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
import { ExpiryIndicator } from "./expiry-indicator";
import { ChevronUp, ChevronDown } from "lucide-react";

type DocCategory = "INPUT" | "OUTPUT" | "TEMPLATE" | "ISSUED";
type OcrStatus = "NONE" | "PROCESSING" | "COMPLETED" | "FAILED";

const CATEGORY_LABELS: Record<DocCategory, string> = {
  INPUT: "입력",
  OUTPUT: "출력",
  TEMPLATE: "템플릿",
  ISSUED: "발급",
};

const OCR_STATUS_LABELS: Record<OcrStatus, string> = {
  NONE: "-",
  PROCESSING: "처리 중",
  COMPLETED: "완료",
  FAILED: "실패",
};

export interface DocumentRow {
  id: string;
  name: string;
  fileType: string | null;
  category: DocCategory;
  ocrStatus: OcrStatus;
  expiresAt: string | null;
  version: number;
  createdAt: string;
  clientId: string;
  client: { id: string; name: string };
}

interface ClientOption {
  id: string;
  name: string;
}

interface DocumentTableProps {
  documents: DocumentRow[];
  total: number;
  page: number;
  pageSize: number;
  clients: ClientOption[];
  currentClientId?: string;
  currentCategory?: string;
  currentOcrStatus?: string;
}

type SortBy = "name" | "createdAt" | "expiresAt";
type SortOrder = "asc" | "desc";

export function DocumentTable({
  documents,
  total,
  page,
  pageSize,
  clients,
  currentClientId = "",
  currentCategory = "",
  currentOcrStatus = "",
}: DocumentTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSortBy = (searchParams.get("sortBy") as SortBy) ?? "createdAt";
  const currentSortOrder = (searchParams.get("sortOrder") as SortOrder) ?? "desc";

  const [clientFilter, setClientFilter] = useState(currentClientId);
  const [categoryFilter, setCategoryFilter] = useState(currentCategory);
  const [ocrFilter, setOcrFilter] = useState(currentOcrStatus);

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

  function formatDate(iso: string | null | undefined) {
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
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value);
            navigate({ clientId: e.target.value || undefined, page: "1" });
          }}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">전체 고객사</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            navigate({ category: e.target.value || undefined, page: "1" });
          }}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">전체 분류</option>
          {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>

        <select
          value={ocrFilter}
          onChange={(e) => {
            setOcrFilter(e.target.value);
            navigate({ ocrStatus: e.target.value || undefined, page: "1" });
          }}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">전체 OCR</option>
          {(Object.keys(OCR_STATUS_LABELS) as OcrStatus[]).map((s) => (
            <option key={s} value={s}>
              {OCR_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
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
                파일명
                <SortIcon column="name" />
              </TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>분류</TableHead>
              <TableHead>OCR</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("expiresAt")}
              >
                만료일
                <SortIcon column="expiresAt" />
              </TableHead>
              <TableHead>만료 상태</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort("createdAt")}
              >
                등록일
                <SortIcon column="createdAt" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  서류가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {doc.name}
                    {doc.version > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        v{doc.version}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.client.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {OCR_STATUS_LABELS[doc.ocrStatus] ?? doc.ocrStatus}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(doc.expiresAt)}
                  </TableCell>
                  <TableCell>
                    <ExpiryIndicator
                      expiresAt={doc.expiresAt}
                      autoRenew={false}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(doc.createdAt)}
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
