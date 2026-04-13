"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@axle/ui";
import { Video, Calendar } from "lucide-react";

interface UpcomingMeeting {
  id: string;
  title: string;
  date: string;
  location: string | null;
  clientName: string;
}

interface ApiResponse {
  data: UpcomingMeeting[];
  total: number;
}

function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

export function UpcomingMeetingsWidget() {
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/upcoming-meetings");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "미팅 목록을 불러오지 못했습니다"
        );
      }
      const json: ApiResponse = await res.json();
      setMeetings(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">예정 미팅</h3>
          {!loading && !error && (
            <Badge variant="secondary" className="text-xs">
              {meetings.length}
            </Badge>
          )}
        </div>
        <Link
          href="/meetings"
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

      {!loading && !error && meetings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">
            예정된 미팅이 없습니다
          </p>
        </div>
      )}

      {!loading && !error && meetings.length > 0 && (
        <ul className="divide-y">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Link
                href={`/meetings/${meeting.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {meeting.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {meeting.clientName}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {formatMeetingDate(meeting.date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
