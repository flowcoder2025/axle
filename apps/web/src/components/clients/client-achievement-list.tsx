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
import { Plus, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Achievement {
  id: string;
  clientId: string;
  type: string;
  title: string;
  date: string | null;
  amount: number | null;
  description: string | null;
  documentId: string | null;
}

interface ClientAchievementListProps {
  clientId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ACHIEVEMENT_TYPE_LABELS: Record<string, string> = {
  PATENT: "특허",
  AWARD: "수상",
  CONTRACT: "계약",
  INVESTMENT: "투자",
  CERTIFICATION: "인증",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ClientAchievementList({ clientId }: ClientAchievementListProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/achievements?pageSize=100`,
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "성과 목록을 불러오지 못했습니다",
        );
      }
      const json = await res.json();
      setAchievements((json as { data: Achievement[] }).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  async function handleDeleteClick(achievement: Achievement) {
    if (!confirm(`"${achievement.title}" 성과를 삭제하시겠습니까?`)) return;

    setDeletingId(achievement.id);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/achievements/${achievement.id}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "삭제에 실패했습니다",
        );
      }
      await fetchAchievements();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "삭제에 실패했습니다",
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
          <h3 className="text-base font-semibold">성과 목록</h3>
          {!loading && !error && (
            <p className="text-xs text-muted-foreground mt-0.5">
              총 {achievements.length}건
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => {
            // Navigate to add achievement — POST via API
            const type = prompt(
              "성과 유형을 선택하세요:\nPATENT(특허), AWARD(수상), CONTRACT(계약), INVESTMENT(투자), CERTIFICATION(인증)",
            );
            if (!type) return;
            const title = prompt("성과 제목을 입력하세요:");
            if (!title) return;
            const description = prompt("설명 (선택사항):");

            fetch(`/api/clients/${clientId}/achievements`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: type.toUpperCase(),
                title,
                description: description || undefined,
                date: new Date().toISOString(),
              }),
            })
              .then((res) => {
                if (!res.ok) throw new Error("등록에 실패했습니다");
                return fetchAchievements();
              })
              .catch((err) => {
                setError(
                  err instanceof Error
                    ? err.message
                    : "등록에 실패했습니다",
                );
              });
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          성과 등록
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
      {!loading && !error && achievements.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            등록된 성과가 없습니다.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && achievements.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>유형</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>일자</TableHead>
              <TableHead>금액</TableHead>
              <TableHead>설명</TableHead>
              <TableHead className="w-16 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {achievements.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Badge variant="outline">
                    {ACHIEVEMENT_TYPE_LABELS[item.type] ?? item.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(item.date)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatAmount(item.amount)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                  {item.description ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="삭제"
                    onClick={() => handleDeleteClick(item)}
                    disabled={deletingId === item.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">삭제</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
