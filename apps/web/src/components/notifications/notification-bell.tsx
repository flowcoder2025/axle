"use client";

import { useEffect, useCallback, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStream } from "../../hooks/use-notification-stream";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@axle/ui";

// Matches Prisma NotificationType enum — keep in sync
// (Cannot import Prisma types directly in a client component.)
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
  unreadCount: number;
  loading: boolean;
}

type Action =
  | { type: "FETCH_SUCCESS"; notifications: Notification[]; unreadCount: number }
  | { type: "MARK_READ"; id: string }
  | { type: "MARK_ALL_READ" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_SUCCESS":
      return {
        ...state,
        notifications: action.notifications,
        unreadCount: action.unreadCount,
        loading: false,
      };
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function NotificationBell() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    notifications: [],
    unreadCount: 0,
    loading: true,
  });

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?pageSize=10", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      dispatch({
        type: "FETCH_SUCCESS",
        notifications: json.data ?? [],
        unreadCount: json.unreadCount ?? 0,
      });
    } catch {
      // silently ignore — bell is non-critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useNotificationStream(fetchNotifications);

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

  const { notifications, unreadCount } = state;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`알림 ${unreadCount > 0 ? `(${unreadCount}개 읽지 않음)` : ""}`}
          className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell size={20} className="text-foreground/70" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-[480px] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            알림
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck size={13} />
              전체 읽음
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Bell size={28} className="opacity-30" />
            <p className="text-sm">알림이 없습니다</p>
          </div>
        ) : (
          <>
            {notifications.map((notification) => {
              const Icon = TYPE_ICON[notification.type] ?? Bell;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => handleClickNotification(notification)}
                  className="flex cursor-pointer items-start gap-3 rounded-none px-4 py-3 focus:bg-accent data-[highlighted]:bg-accent"
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      notification.isRead
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <p
                      className={`truncate text-sm leading-snug ${
                        notification.isRead
                          ? "font-normal text-foreground/80"
                          : "font-semibold text-foreground"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <span className="mt-1.5 ml-auto flex h-2 w-2 shrink-0 rounded-full bg-destructive" />
                  )}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuItem asChild className="justify-center rounded-none px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground focus:bg-accent">
              <a href="/notifications">알림 더보기</a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
