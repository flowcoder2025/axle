"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Video, Activity } from "lucide-react";

interface ActivityEvent {
  id: string;
  type: "document" | "meeting";
  title: string;
  date: string;
  subtitle: string;
}

interface ApiResponse {
  data: ActivityEvent[];
  total: number;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${diffDays}일 전`;
}

function ActivityIcon({ type }: { type: "document" | "meeting" }) {
  if (type === "document") {
    return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  return <Video className="h-4 w-4 text-green-500 shrink-0" />;
}

function getActivityLink(event: ActivityEvent): string {
  if (event.type === "document") {
    return `/documents/${event.id}`;
  }
  return `/meetings/${event.id}`;
}

export function RecentActivityWidget() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/recent-activity");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "최근 활동을 불러오지 못했습니다"
        );
      }
      const json: ApiResponse = await res.json();
      setEvents(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">최근 활동</h3>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          불러오는 중...
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">
            최근 활동이 없습니다
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <ul className="divide-y">
          {events.map((event) => (
            <li key={`${event.type}-${event.id}`}>
              <Link
                href={getActivityLink(event)}
                className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <ActivityIcon type={event.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {event.subtitle}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {formatRelativeTime(event.date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
