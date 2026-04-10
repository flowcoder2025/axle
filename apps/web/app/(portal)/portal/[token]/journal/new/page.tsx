"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NewPortalJournalPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${token}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: { message?: string } };
        throw new Error(json.error?.message ?? "일지 등록에 실패했습니다");
      }

      router.push(`/portal/${token}/journal`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <a href={`/portal/${token}/journal`} className="text-sm text-primary hover:underline">
          ← 일지 목록
        </a>
        <h1 className="text-2xl font-bold mt-2">새 연구 일지 작성</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            제목 <span className="text-destructive">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일지 제목을 입력해 주세요"
            maxLength={500}
            required
            disabled={submitting}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="content" className="text-sm font-medium">
            내용 <span className="text-destructive">*</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="연구 내용, 진행 사항, 결과 등을 자유롭게 기록하세요"
            rows={10}
            maxLength={10000}
            required
            disabled={submitting}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
          <p className="text-xs text-muted-foreground text-right">{content.length} / 10,000</p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !title.trim() || !content.trim()}
            className="flex-1 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "등록 중..." : "일지 등록"}
          </button>
          <a
            href={`/portal/${token}/journal`}
            className="rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            취소
          </a>
        </div>
      </form>
    </div>
  );
}
