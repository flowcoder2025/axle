"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@axle/ui";
import { MoreHorizontal, Download, ScanText, Trash2 } from "lucide-react";
import { DocumentVersionList } from "./document-version-list";

type DocCategory = "INPUT" | "OUTPUT" | "TEMPLATE" | "ISSUED";
type OcrStatus = "NONE" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface DocumentRow {
  id: string;
  name: string;
  fileType: string;
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

const CATEGORY_CONFIG: Record<
  DocCategory,
  { label: string; className: string }
> = {
  INPUT: {
    label: "입력",
    className:
      "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  OUTPUT: {
    label: "출력",
    className:
      "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  TEMPLATE: {
    label: "템플릿",
    className:
      "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  ISSUED: {
    label: "발급",
    className:
      "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

const OCR_CONFIG: Record<OcrStatus, { label: string; className: string }> = {
  NONE: {
    label: "없음",
    className:
      "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  PROCESSING: {
    label: "처리중",
    className:
      "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  COMPLETED: {
    label: "완료",
    className:
      "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  FAILED: {
    label: "실패",
    className:
      "border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

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

  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

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

  async function handleDownload(docId: string, docName: string) {
    setLoadingAction(`download-${docId}`);
    try {
      const res = await fetch(`/api/documents/${docId}/download`);
      if (!res.ok) throw new Error("다운로드 실패");
      const json = await res.json();
      const a = document.createElement("a");
      a.href = json.data.url;
      a.download = docName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("다운로드에 실패했습니다.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleOcr(docId: string) {
    setLoadingAction(`ocr-${docId}`);
    try {
      const res = await fetch(`/api/documents/${docId}/ocr`, { method: "POST" });
      if (!res.ok) throw new Error("OCR 실패");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("OCR 실행에 실패했습니다.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("이 서류를 삭제하시겠습니까?")) return;
    setLoadingAction(`delete-${docId}`);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("삭제에 실패했습니다.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-2">
        <select
          value={currentClientId}
          onChange={(e) =>
            navigate({ clientId: e.target.value || undefined, page: "1" })
          }
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
          value={currentCategory}
          onChange={(e) =>
            navigate({ category: e.target.value || undefined, page: "1" })
          }
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">전체 카테고리</option>
          <option value="INPUT">입력</option>
          <option value="OUTPUT">출력</option>
          <option value="TEMPLATE">템플릿</option>
          <option value="ISSUED">발급</option>
        </select>

        <select
          value={currentOcrStatus}
          onChange={(e) =>
            navigate({ ocrStatus: e.target.value || undefined, page: "1" })
          }
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">전체 OCR 상태</option>
          <option value="NONE">없음</option>
          <option value="PROCESSING">처리중</option>
          <option value="COMPLETED">완료</option>
          <option value="FAILED">실패</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>파일명</TableHead>
              <TableHead>고객사</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>OCR 상태</TableHead>
              <TableHead>만료일</TableHead>
              <TableHead>버전</TableHead>
              <TableHead>업로드일</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground"
                >
                  서류가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const categoryConfig = CATEGORY_CONFIG[doc.category];
                const ocrConfig = OCR_CONFIG[doc.ocrStatus];
                const isExpanded = expandedVersionId === doc.id;

                return (
                  <>
                    <TableRow key={doc.id} className="hover:bg-muted/30">
                      <TableCell>
                        <button
                          className="font-medium hover:underline text-left"
                          onClick={() =>
                            setExpandedVersionId(isExpanded ? null : doc.id)
                          }
                        >
                          {doc.name}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {doc.fileType}
                        </p>
                      </TableCell>
                      <TableCell>{doc.client.name}</TableCell>
                      <TableCell>
                        <Badge className={categoryConfig.className}>
                          {categoryConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ocrConfig.className}>
                          {ocrConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.expiresAt ? formatDate(doc.expiresAt) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        v{doc.version}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={loadingAction !== null}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">메뉴 열기</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDownload(doc.id, doc.name)}
                              disabled={loadingAction === `download-${doc.id}`}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              다운로드
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOcr(doc.id)}
                              disabled={
                                doc.ocrStatus === "PROCESSING" ||
                                loadingAction === `ocr-${doc.id}`
                              }
                            >
                              <ScanText className="mr-2 h-4 w-4" />
                              OCR 실행
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(doc.id)}
                              disabled={loadingAction === `delete-${doc.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${doc.id}-versions`}>
                        <TableCell colSpan={8} className="bg-muted/20 p-0">
                          <DocumentVersionList documentId={doc.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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
                    ...
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
