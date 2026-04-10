"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";
import { Sparkles } from "lucide-react";

interface AiDraftButtonProps {
  journalId: string;
  disabled?: boolean;
}

export function AiDraftButton({ journalId, disabled = false }: AiDraftButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  async function handleAiDraft() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/journals/${journalId}/ai-draft`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message ?? "AI 초안 생성 중 오류가 발생했습니다.");
        return;
      }

      setJobId(json.data?.jobId);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleAiDraft}
        disabled={disabled || loading}
        className="gap-1.5"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {loading ? "AI 초안 생성 중..." : "AI 초안 생성"}
      </Button>
      {jobId && (
        <p className="text-xs text-muted-foreground">
          작업 ID: {jobId} — Phase 14에서 자동 완성됩니다.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
