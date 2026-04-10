"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@axle/ui";
import { RefreshCw, FileWarning } from "lucide-react";

interface ExpiringDocument {
  id: string;
  name: string;
  category: string;
  expiresAt: string;
  autoRenew: boolean;
  daysRemaining: number;
  clientId: string;
  clientName: string;
}

interface ApiResponse {
  data: ExpiringDocument[];
  total: number;
  days: number;
}

function UrgencyBadge({ days }: { days: number }) {
  if (days <= 7) {
    return (
      <Badge variant="destructive" className="text-xs">
        D-{days}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-yellow-400 bg-yellow-50 text-yellow-700 text-xs hover:bg-yellow-50"
    >
      D-{days}
    </Badge>
  );
}

export function ExpiringDocumentsWidget() {
  const [documents, setDocuments] = useState<ExpiringDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpiring = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/expiring?days=30");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "만료 서류를 불러오지 못했습니다"
        );
      }
      const json: ApiResponse = await res.json();
      setDocuments(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpiring();
  }, [fetchExpiring]);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">만료 예정 서류</h3>
          {!loading && !error && (
            <span className="text-xs text-muted-foreground">
              30일 이내 {documents.length}건
            </span>
          )}
        </div>
        <Link
          href="/documents"
          className="text-xs text-primary hover:underline"
        >
          전체 보기
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          불러오는 중...
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">
            30일 이내 만료되는 서류가 없습니다.
          </p>
        </div>
      )}

      {!loading && !error && documents.length > 0 && (
        <ul className="divide-y">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.clientName}
                </p>
              </div>
              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                <UrgencyBadge days={doc.daysRemaining} />
                {doc.autoRenew && (
                  <RefreshCw
                    className="h-3 w-3 text-muted-foreground"
                    title="자동 갱신"
                    aria-label="자동 갱신"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
