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
import { FileText } from "lucide-react";
import Link from "next/link";

interface Document {
  id: string;
  name: string;
  fileType: string | null;
  category: string;
  ocrStatus: string;
  expiresAt: string | null;
  version: number;
  createdAt: string;
}

interface ProjectDocumentListProps {
  projectId: string;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const CATEGORY_LABEL: Record<string, string> = {
  INPUT: "입력",
  OUTPUT: "산출",
  TEMPLATE: "템플릿",
  ISSUED: "발급",
};

const OCR_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  NONE: { label: "-", variant: "secondary" },
  PENDING: { label: "대기", variant: "secondary" },
  PROCESSING: { label: "처리중", variant: "outline" },
  DONE: { label: "완료", variant: "default" },
  FAILED: { label: "실패", variant: "secondary" },
  SKIPPED: { label: "건너뜀", variant: "secondary" },
};

export function ProjectDocumentList({ projectId }: ProjectDocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/documents?projectId=${projectId}&pageSize=50`
      );
      if (!res.ok) {
        throw new Error("서류 목록을 불러오지 못했습니다");
      }
      const json = await res.json();
      setDocuments(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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
          onClick={fetchDocuments}
          className="text-sm text-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          이 프로젝트에 연결된 서류가 없습니다.
        </p>
        <Link
          href="/documents"
          className="mt-3 text-sm text-primary hover:underline"
        >
          서류 관리에서 추가하기
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
            <TableHead>서류명</TableHead>
            <TableHead>구분</TableHead>
            <TableHead>파일 형식</TableHead>
            <TableHead>OCR</TableHead>
            <TableHead>만료일</TableHead>
            <TableHead>등록일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const ocr = OCR_LABEL[doc.ocrStatus] ?? {
              label: doc.ocrStatus,
              variant: "secondary" as const,
            };
            return (
              <TableRow key={doc.id}>
                <TableCell className="font-medium max-w-[250px] truncate">
                  {doc.name}
                  {doc.version > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      v{doc.version}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {CATEGORY_LABEL[doc.category] ?? doc.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs uppercase">
                  {doc.fileType ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={ocr.variant}>{ocr.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(doc.expiresAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(doc.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
