"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@axle/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemberUser {
  id: string;
  name: string | null;
  email: string;
}

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  user: MemberUser | null;
}

interface MemberListProps {
  projectId: string;
  /** If true, shows remove buttons (LEAD privilege). */
  canManage?: boolean;
}

// ---------------------------------------------------------------------------
// Role badge styling
// ---------------------------------------------------------------------------

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  LEAD: {
    label: "리더",
    className: "bg-primary/10 text-primary",
  },
  MEMBER: {
    label: "멤버",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  VIEWER: {
    label: "뷰어",
    className: "bg-muted text-muted-foreground",
  },
};

function roleBadge(role: string) {
  const badge = ROLE_BADGE[role] ?? {
    label: role,
    className: "bg-muted text-muted-foreground",
  };
  return badge;
}

// ---------------------------------------------------------------------------
// Avatar initial
// ---------------------------------------------------------------------------

function avatarInitial(name: string | null | undefined, email: string): string {
  if (name && name.trim().length > 0) return name.trim()[0]!.toUpperCase();
  return email[0]!.toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberList({ projectId, canManage = false }: MemberListProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "멤버 목록을 불러오지 못했습니다",
        );
      }
      const json = (await res.json()) as { data: ProjectMember[] };
      setMembers(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "멤버 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  async function handleRemove(memberId: string) {
    if (!confirm("이 멤버를 프로젝트에서 제거하시겠습니까?")) return;

    setRemovingId(memberId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${memberId}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "멤버 제거에 실패했습니다",
        );
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "멤버 제거에 실패했습니다");
    } finally {
      setRemovingId(null);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        멤버 목록을 불러오는 중...
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
            void fetchMembers();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  // Empty state
  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        아직 프로젝트에 멤버가 없습니다.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {members.map((member) => {
        const badge = roleBadge(member.role);
        const name = member.user?.name ?? null;
        const email = member.user?.email ?? "unknown";
        const initial = avatarInitial(name, email);

        return (
          <li
            key={member.id}
            className="flex items-center gap-3 px-4 py-3"
          >
            {/* Avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {initial}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {name ?? email}
              </p>
              {name && (
                <p className="truncate text-xs text-muted-foreground">
                  {email}
                </p>
              )}
            </div>

            {/* Role badge */}
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                badge.className,
              ].join(" ")}
            >
              {badge.label}
            </span>

            {/* Remove button (LEAD only) */}
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                disabled={removingId === member.id}
                onClick={() => void handleRemove(member.id)}
                aria-label={`${name ?? email} 제거`}
              >
                {removingId === member.id ? (
                  <span className="text-xs">...</span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                )}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
