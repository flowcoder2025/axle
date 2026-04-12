"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@axle/ui";
import { MemberRoleSelect } from "./member-role-select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSearchResult {
  id: string;
  name: string | null;
  email: string;
}

interface AddMemberDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a member is successfully added. */
  onAdded?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddMemberDialog({
  projectId,
  open,
  onClose,
  onAdded,
}: AddMemberDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [role, setRole] = useState("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Search users (debounced)
  // -----------------------------------------------------------------------

  const searchUsers = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/users?search=${encodeURIComponent(query.trim())}`,
      );
      if (!res.ok) {
        setResults([]);
        return;
      }
      const json = (await res.json()) as { data: UserSearchResult[] };
      setResults(json.data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (search.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void searchUsers(search);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchUsers]);

  // -----------------------------------------------------------------------
  // Reset state on close
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSelectedUser(null);
      setRole("MEMBER");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  async function handleSubmit() {
    if (!selectedUser) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, role }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (json as { error?: { message?: string } }).error?.message ??
          "멤버 추가에 실패했습니다";
        throw new Error(msg);
      }

      onAdded?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "멤버 추가에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Close on backdrop click
  // -----------------------------------------------------------------------

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) {
      onClose();
    }
  }

  // -----------------------------------------------------------------------
  // Close on Escape
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="멤버 추가"
    >
      <div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">멤버 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="닫기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="member-search" className="text-sm font-medium">
              사용자 검색
            </label>
            <input
              id="member-search"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedUser(null);
                setError(null);
              }}
              placeholder="이름 또는 이메일로 검색 (2자 이상)"
              disabled={submitting}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>

          {/* Search results */}
          {searching && (
            <p className="text-xs text-muted-foreground">검색 중...</p>
          )}

          {!searching && search.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground">
              검색 결과가 없습니다.
            </p>
          )}

          {results.length > 0 && !selectedUser && (
            <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedUser(user);
                      setSearch("");
                      setResults([]);
                    }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {(user.name?.[0] ?? user.email[0])!.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {user.name ?? user.email}
                      </p>
                      {user.name && (
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Selected user */}
          {selectedUser && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {(selectedUser.name?.[0] ?? selectedUser.email[0])!.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedUser.name ?? selectedUser.email}
                </p>
                {selectedUser.name && (
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedUser.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedUser(null)}
                aria-label="선택 해제"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          )}

          {/* Role select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">역할</label>
            <MemberRoleSelect
              value={role}
              onChange={setRole}
              disabled={submitting}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedUser || submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "추가 중..." : "멤버 추가"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
