"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@axle/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSearchResult {
  id: string;
  name: string | null;
  email: string;
}

interface HandoffFormProps {
  projectId: string;
  /** Called after a successful handoff. */
  onHandoffComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HandoffForm({ projectId, onHandoffComplete }: HandoffFormProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // Submit handoff
  // -----------------------------------------------------------------------

  async function handleSubmit() {
    if (!selectedUser || !reason.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newAssigneeId: selectedUser.id,
          reason: reason.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (json as { error?: { message?: string } }).error?.message ??
          "인수인계에 실패했습니다";
        throw new Error(msg);
      }

      // Reset form
      setSelectedUser(null);
      setSearch("");
      setReason("");
      setConfirmOpen(false);
      onHandoffComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "인수인계에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h4 className="font-medium">프로젝트 인수인계</h4>

      {/* Assignee search */}
      <div className="space-y-2">
        <label htmlFor="handoff-search" className="text-sm font-medium">
          새 담당자
        </label>

        {selectedUser ? (
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
              onClick={() => {
                setSelectedUser(null);
                setConfirmOpen(false);
              }}
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
        ) : (
          <>
            <input
              id="handoff-search"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setError(null);
              }}
              placeholder="이름 또는 이메일로 검색 (2자 이상)"
              disabled={submitting}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />

            {searching && (
              <p className="text-xs text-muted-foreground">검색 중...</p>
            )}

            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground">
                검색 결과가 없습니다.
              </p>
            )}

            {results.length > 0 && (
              <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
                {results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
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
          </>
        )}
      </div>

      {/* Reason textarea */}
      <div className="space-y-2">
        <label htmlFor="handoff-reason" className="text-sm font-medium">
          인수인계 사유
        </label>
        <textarea
          id="handoff-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          placeholder="인수인계 사유를 입력하세요..."
          rows={3}
          maxLength={1000}
          disabled={submitting}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Two-phase submit */}
      {!confirmOpen ? (
        <Button
          type="button"
          size="sm"
          disabled={!selectedUser || !reason.trim() || submitting}
          onClick={() => setConfirmOpen(true)}
        >
          인수인계 실행
        </Button>
      ) : (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3">
          <p className="mb-2 text-sm font-medium text-destructive">
            이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "처리 중..." : "확인"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
