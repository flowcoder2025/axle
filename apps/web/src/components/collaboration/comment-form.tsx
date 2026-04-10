"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

interface CommentFormProps {
  projectId: string;
  orgUsers?: OrgUser[];
  onCommentAdded?: () => void;
}

/**
 * CommentForm — textarea with @mention autocomplete dropdown.
 *
 * @mention pattern: "@" triggers a dropdown of org users filtered by
 * the text typed after "@". Selecting a user inserts their ID as "@userId".
 * The server resolves IDs to user records and creates MENTION notifications.
 */
export function CommentForm({ projectId, orgUsers = [], onCommentAdded }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect @mention trigger in the textarea
  const handleBodyChange = useCallback((value: string) => {
    setBody(value);
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart ?? 0;
    const textUpToCursor = value.slice(0, cursorPos);

    // Find the last @ before cursor that is either at start or preceded by whitespace
    const atIndex = textUpToCursor.lastIndexOf("@");
    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }
    const charBeforeAt = atIndex > 0 ? textUpToCursor[atIndex - 1] : " ";
    if (!/\s/.test(charBeforeAt) && atIndex !== 0) {
      setMentionQuery(null);
      return;
    }
    const query = textUpToCursor.slice(atIndex + 1);
    if (/\s/.test(query)) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(query);
    setMentionStart(atIndex);
  }, []);

  const filteredUsers =
    mentionQuery !== null
      ? orgUsers.filter((u) => {
          const display = (u.name ?? u.email).toLowerCase();
          return display.includes(mentionQuery.toLowerCase());
        }).slice(0, 6)
      : [];

  const insertMention = useCallback(
    (user: OrgUser) => {
      const display = user.name ?? user.email;
      const before = body.slice(0, mentionStart);
      const after = body.slice(
        textareaRef.current?.selectionStart ?? mentionStart + 1,
      );
      const newBody = `${before}@${user.id} `;
      const withAfter = newBody + after;
      setBody(withAfter);
      setMentionQuery(null);
      // Restore focus
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = newBody.length;
        }
      }, 0);
      // Show display name inline (visual only, server sees user IDs)
      // We use a replace so the visible text shows the name but body holds the ID
      const displayBody = `${before}@${display} ${after}`;
      setBody(displayBody);
    },
    [body, mentionStart],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        e.target !== textareaRef.current
      ) {
        setMentionQuery(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!body.trim()) return;

      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim() }),
        });
        if (!res.ok) {
          const json = await res.json() as { error?: { message?: string } };
          throw new Error(json.error?.message ?? "댓글 등록에 실패했습니다");
        }
        setBody("");
        onCommentAdded?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      } finally {
        setSubmitting(false);
      }
    },
    [body, projectId, onCommentAdded],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder="댓글을 입력하세요. @를 입력해 멤버를 언급할 수 있습니다."
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          disabled={submitting}
          aria-label="댓글 입력"
        />
        {/* @mention autocomplete dropdown */}
        {mentionQuery !== null && filteredUsers.length > 0 && (
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="멤버 선택"
            className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          >
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep textarea focus
                  insertMention(u);
                }}
              >
                <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                  {(u.name ?? u.email).charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{u.name ?? u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "등록 중..." : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}
