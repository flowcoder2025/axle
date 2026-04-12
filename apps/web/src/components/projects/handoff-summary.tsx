"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@axle/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HandoffRecord {
  id: string;
  timestamp: string;
  payload: {
    fromUserId?: string;
    fromUserName?: string;
    toUserId?: string;
    toUserName?: string;
    reason?: string;
  };
}

interface HandoffSummaryProps {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HandoffSummary({ projectId }: HandoffSummaryProps) {
  const [records, setRecords] = useState<HandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHandoffs = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/activity?type=HANDOFF`,
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "인수인계 이력을 불러오지 못했습니다",
        );
      }
      const json = (await res.json()) as { data: HandoffRecord[] };
      setRecords(json.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "인수인계 이력을 불러오지 못했습니다",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchHandoffs();
  }, [fetchHandoffs]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        인수인계 이력을 불러오는 중...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            setLoading(true);
            void fetchHandoffs();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  // Empty state
  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        인수인계 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <div key={record.id} className="rounded-lg border p-3">
          {/* From → To */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {record.payload.fromUserName ?? "이전 담당자"}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 01.75-.75h10.638l-3.175-2.838a.75.75 0 011.002-1.114l4.5 4.025a.75.75 0 010 1.114l-4.5 4.025a.75.75 0 01-1.002-1.114l3.175-2.838H3.75A.75.75 0 013 10z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">
              {record.payload.toUserName ?? "새 담당자"}
            </span>
          </div>

          {/* Reason */}
          {record.payload.reason && (
            <p className="mt-1 text-sm text-muted-foreground">
              {record.payload.reason}
            </p>
          )}

          {/* Timestamp */}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(record.timestamp).toLocaleString("ko-KR")}
          </p>
        </div>
      ))}
    </div>
  );
}
