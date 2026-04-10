"use client";

import { useEffect, useCallback, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  FileText,
  Upload,
  AlertTriangle,
  Calendar,
  Video,
  BookOpen,
  CheckSquare,
  Clock,
  FolderKanban,
  Sparkles,
  Zap,
  ZapOff,
  Handshake,
  Receipt,
  Package,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Button, Badge } from "@axle/ui";

type NotificationType =
  | "DOC_REQUESTED"
  | "DOC_UPLOADED"
  | "DOC_EXPIRING"
  | "DEADLINE"
  | "MEETING_NOTIFY"
  | "JOURNAL_DUE"
  | "ACTION_ITEM"
  | "ACTION_ITEM_DUE"
  | "PROJECT_ASSIGNED"
  | "MATCHING_RESULT"
  | "AI_JOB_COMPLETE"
  | "AI_JOB_FAILED"
  | "PORTAL_COMPLETE"
  | "HANDOFF"
  | "ESTIMATE_SENT"
  | "BUNDLE_COMPLETE";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface State {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  loading: boolean;
  page: number;
  isReadFilter: "all" | "read" | "unread";
}

type Action =
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      notifications: Notification[];
      total: number;
      unreadCount: number;
      page: number;
    }
  | { type: "SET_FILTER"; isReadFilter: "all" | "read" | "unread" }
  | { type: "SET_PAGE"; page: number }
  | { type: "MARK_READ"; id: string }
  | { type: "MARK_ALL_READ" }
  | { type: "DELETE"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true };
    case "FETCH_SUCCESS":
      return {
        ...state,
        loading: false,
        notifications: action.notifications,
        total: action.total,
        unreadCount: action.unreadCount,
        page: action.page,
      };
    case "SET_FILTER":
      return { ...state, isReadFilter: action.isReadFilter, page: 1 };
    case "SET_PAGE":
      return { ...state, page: action.page };
    case "MARK_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            (state.notifications.find((n) => n.id === action.id && !n.isRead)
              ? 1
              : 0)
        ),
      };
    case "MARK_ALL_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      };
    case "DELETE":
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.id),
        total: Math.max(0, state.total - 1),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            (state.notifications.find((n) => n.id === action.id && !n.isRead)
              ? 1
              : 0)
        ),
      };
    default:
      return state;
  }
}

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  DOC_REQUESTED: FileText,
  DOC_UPLOADED: Upload,
  DOC_EXPIRING: AlertTriangle,
  DEADLINE: Clock,
  MEETING_NOTIFY: Video,
  JOURNAL_DUE: BookOpen,
  ACTION_ITEM: CheckSquare,
  ACTION_ITEM_DUE: CheckSquare,
  PROJECT_ASSIGNED: FolderKanban,
  MATCHING_RESULT: Sparkles,
  AI_JOB_COMPLETE: Zap,
  AI_JOB_FAILED: ZapOff,
  PORTAL_COMPLETE: Calendar,
  HANDOFF: Handshake,
  ESTIMATE_SENT: Receipt,
  BUNDLE_COMPLETE: Package,
};

const TYPE_LABEL: Record<NotificationType, string> = {
  DOC_REQUESTED: "서류 요청",
  DOC_UPLOADED: "서류 업로드",
  DOC_EXPIRING: "서류 만료",
  DEADLINE: "마감",
  MEETING_NOTIFY: "미팅",
  JOURNAL_DUE: "연구일지",
  ACTION_ITEM: "액션 아이템",
  ACTION_ITEM_DUE: "액션 기한",
  PROJECT_ASSIGNED: "프로젝트",
  MATCHING_RESULT: "매칭 결과",
  AI_JOB_COMPLETE: "AI 완료",
  AI_JOB_FAILED: "AI 실패",
  PORTAL_COMPLETE: "포털 완료",
  HANDOFF: "핸드오프",
  ESTIMATE_SENT: "견적 발송",
  BUNDLE_COMPLETE: "번들 완료",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, dispatch] = useReducer(reducer, {
    notifications: [],
    total: 0,
    unreadCount: 0,
    loading: true,
    page: Number(searchParams.get("page") ?? 1),
    isReadFilter: (searchParams.get("filter") as State["isReadFilter"]) ?? "all",
  });

  const fetchNotifications = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        pageSize: String(PAGE_SIZE),
      });
      if (state.isReadFilter === "read") params.set("isRead", "true");
      if (state.isReadFilter === "unread") params.set("isRead", "false");

      const res = await fetch(`/api/notifications?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      dispatch({
        type: "FETCH_SUCCESS",
        notifications: json.data ?? [],
        total: json.total ?? 0,
        unreadCount: json.unreadCount ?? 0,
        page: json.page ?? state.page,
      });
    } catch {
      dispatch({
        type: "FETCH_SUCCESS",
        notifications: [],
        total: 0,
        unreadCount: 0,
        page: state.page,
      });
    }
  }, [state.page, state.isReadFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleClickNotification = useCallback(
    async (notification: Notification) => {
      if (!notification.isRead) {
        dispatch({ type: "MARK_READ", id: notification.id });
        fetch(`/api/notifications/${notification.id}`, {
          method: "PATCH",
        }).catch(() => {});
      }
      if (notification.link) {
        router.push(notification.link);
      }
    },
    [router]
  );

  const handleMarkAllRead = useCallback(async () => {
    dispatch({ type: "MARK_ALL_READ" });
    fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
  }, []);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      dispatch({ type: "DELETE", id });
      fetch(`/api/notifications/${id}`, { method: "DELETE" }).catch(() => {});
    },
    []
  );

  const totalPages = Math.ceil(state.total / PAGE_SIZE);
  const { notifications, loading, isReadFilter, page, unreadCount } = state;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">알림</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              읽지 않은 알림 {unreadCount}개
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="gap-1.5"
          >
            <CheckCheck size={15} />
            전체 읽음
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            onClick={() => dispatch({ type: "SET_FILTER", isReadFilter: f })}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              isReadFilter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "전체" : f === "unread" ? "안 읽음" : "읽음"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-lg border divide-y bg-card">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-4 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Bell size={32} className="opacity-30" />
            <p className="text-sm">알림이 없습니다</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = TYPE_ICON[notification.type] ?? Bell;
            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleClickNotification(notification)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleClickNotification(notification);
                  }
                }}
                className={`group flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  !notification.isRead ? "bg-primary/5" : ""
                }`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    notification.isRead
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p
                      className={`truncate text-sm leading-snug ${
                        notification.isRead
                          ? "font-normal text-foreground/80"
                          : "font-semibold text-foreground"
                      }`}
                    >
                      {notification.title}
                    </p>
                    <Badge variant="outline" className="shrink-0 text-[10px] py-0 px-1.5">
                      {TYPE_LABEL[notification.type]}
                    </Badge>
                  </div>
                  {notification.body && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.body}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60">
                    {timeAgo(notification.createdAt)}
                  </p>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  {!notification.isRead && (
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                  )}
                  <button
                    onClick={(e) => handleDelete(e, notification.id)}
                    aria-label="알림 삭제"
                    className="hidden rounded p-1 text-muted-foreground hover:text-destructive group-hover:flex transition-colors focus-visible:flex"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => dispatch({ type: "SET_PAGE", page: page - 1 })}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => dispatch({ type: "SET_PAGE", page: page + 1 })}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
