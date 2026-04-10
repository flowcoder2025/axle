"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@axle/ui";
import { Pencil, ShieldPlus, Trash2 } from "lucide-react";
import { CertificateForm, type Certificate } from "./certificate-form";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CertificateListProps {
  clientId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function isExpired(validTo: string | null | undefined): boolean {
  if (!validTo) return false;
  return new Date(validTo) < new Date();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CertificateList({ clientId }: CertificateListProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Certificate | undefined>(undefined);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/certificates?pageSize=100`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "인증서 목록을 불러오지 못했습니다"
        );
      }
      const json = await res.json();
      setCertificates((json as { data: Certificate[] }).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleAddClick() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function handleEditClick(cert: Certificate) {
    setEditing(cert);
    setFormOpen(true);
  }

  async function handleDeleteClick(cert: Certificate) {
    if (!confirm(`"${cert.subjectName}" 인증서를 삭제하시겠습니까?`)) return;

    setDeletingId(cert.id);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/certificates/${cert.id}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "삭제에 실패했습니다"
        );
      }
      await fetchCertificates();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "삭제에 실패했습니다"
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">인증서 목록</h3>
          {!loading && !error && (
            <p className="text-xs text-muted-foreground mt-0.5">
              총 {certificates.length}건
            </p>
          )}
        </div>
        <Button size="sm" onClick={handleAddClick}>
          <ShieldPlus className="mr-1.5 h-4 w-4" />
          인증서 등록
        </Button>
      </div>

      {/* Error states */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          불러오는 중...
        </div>
      )}

      {/* Empty */}
      {!loading && !error && certificates.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            등록된 인증서가 없습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleAddClick}
          >
            <ShieldPlus className="mr-1.5 h-4 w-4" />
            첫 인증서 등록
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && certificates.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>유형</TableHead>
              <TableHead>주체</TableHead>
              <TableHead>일련번호</TableHead>
              <TableHead>유효기간</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-20 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((cert) => {
              const expired = isExpired(cert.validTo);
              return (
                <TableRow key={cert.id}>
                  {/* 유형 */}
                  <TableCell className="font-medium">{cert.type}</TableCell>

                  {/* 주체 */}
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {cert.subjectName}
                  </TableCell>

                  {/* 일련번호 */}
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {cert.serialNumber ?? "-"}
                  </TableCell>

                  {/* 유효기간 */}
                  <TableCell className="text-muted-foreground text-sm">
                    {cert.validFrom || cert.validTo ? (
                      <>
                        {formatDate(cert.validFrom)}
                        {" ~ "}
                        {formatDate(cert.validTo)}
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>

                  {/* 상태 */}
                  <TableCell>
                    {cert.validTo ? (
                      <Badge
                        variant={expired ? "destructive" : "default"}
                        className={
                          expired
                            ? undefined
                            : "bg-green-100 text-green-800 hover:bg-green-100"
                        }
                      >
                        {expired ? "만료" : "유효"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="편집"
                        onClick={() => handleEditClick(cert)}
                        disabled={deletingId === cert.id}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">편집</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="삭제"
                        onClick={() => handleDeleteClick(cert)}
                        disabled={deletingId === cert.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">삭제</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Form dialog */}
      <CertificateForm
        clientId={clientId}
        certificate={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchCertificates}
      />
    </div>
  );
}
