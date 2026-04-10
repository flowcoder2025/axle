"use client";

import { useEffect, useState, useCallback } from "react";

/** Simple relative-time formatter without external deps */
function formatRelative(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return `${Math.floor(diffMonth / 12)}년 전`;
}

export interface ActivityEvent {
  id: string;
  type: "DOCUMENT_ADDED" | "MEMBER_ADDED" | "MEETING_SCHEDULED" | "COMMENT";
  timestamp: string;
  payload: Record<string, unknown>;
}

interface ActivityFeedProps {
  projectId: string;
}

const EVENT_LABELS: Record<ActivityEvent["type"], string> = {
  DOCUMENT_ADDED: "문서 추가",
  MEMBER_ADDED: "멤버 추가",
  MEETING_SCHEDULED: "미팅 예약",
  COMMENT: "댓글",
};

function EventIcon({ type }: { type: ActivityEvent["type"] }) {
  const icons: Record<ActivityEvent["type"], string> = {
    DOCUMENT_ADDED: "📄",
    MEMBER_ADDED: "👤",
    MEETING_SCHEDULED: "📅",
    COMMENT: "💬",
  };
  return <span className="text-lg">{icons[type]}</span>;
}

function EventBody({ event }: { event: ActivityEvent }) {
  const p = event.payload;
  switch (event.type) {
    case "DOCUMENT_ADDED":
      return (
        <p className="text-sm text-foreground">
          <span className="font-medium">{String(p.name ?? "문서")}</span>{" "}
          <span className="text-muted-foreground">가 추가되었습니다</span>
        </p>
      );
    case "MEMBER_ADDED": {
      const u = p.user as { name?: string; email?: string } | null;
      return (
        <p className="text-sm text-foreground">
          <span className="font-medium">{u?.name ?? u?.email ?? "사용자"}</span>{" "}
          <span className="text-muted-foreground">가 {String(p.role)} 역할로 추가되었습니다</span>
        </p>
      );
    }
    case "MEETING_SCHEDULED":
      return (
        <p className="text-sm text-foreground">
          <span className="font-medium">{String(p.title ?? "미팅")}</span>{" "}
          <span className="text-muted-foreground">이 예약되었습니다</span>
        </p>
      );
    case "COMMENT": {
      const a = p.author as { name?: string; email?: string } | null;
      return (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            {a?.name ?? a?.email ?? "사용자"}
          </p>
          <p className="text-sm text-foreground line-clamp-2">{String(p.body ?? "")}</p>
        </div>
      );
    }
    default:
      return null;
  }
}

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/activity`);
      if (!res.ok) throw new Error("Failed to load activity");
      const json = await res.json() as { data: ActivityEvent[] };
      setEvents(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 활동이 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <EventIcon type={event.type} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                {EVENT_LABELS[event.type]}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelative(new Date(event.timestamp))}
              </span>
            </div>
            <EventBody event={event} />
          </div>
        </div>
      ))}
    </div>
  );
}
