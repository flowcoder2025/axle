"use client";

import { useState } from "react";
import { Button, Input } from "@axle/ui";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { toast } from "@axle/ui";

interface FeedbackFormProps {
  matchId: string;
  initialIsRelevant: boolean | null;
  initialNote: string | null;
  onSaved?: (matchId: string, isRelevant: boolean) => void;
}

export function FeedbackForm({
  matchId,
  initialIsRelevant,
  initialNote,
  onSaved,
}: FeedbackFormProps) {
  const [isRelevant, setIsRelevant] = useState<boolean | null>(initialIsRelevant);
  const [note, setNote] = useState(initialNote ?? "");
  const [showNote, setShowNote] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submitFeedback(relevant: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/matching/${matchId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRelevant: relevant, feedbackNote: note || undefined }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        toast.error("피드백 저장 실패", { description: error?.message ?? "오류가 발생했습니다." });
        return;
      }

      setIsRelevant(relevant);
      onSaved?.(matchId, relevant);
      toast.success("피드백 저장됨", {
        description: relevant ? "관련 있음으로 표시했습니다." : "관련 없음으로 표시했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${isRelevant === true ? "text-green-600" : "text-muted-foreground"}`}
          disabled={loading}
          onClick={() => {
            if (isRelevant === true) {
              setShowNote((p) => !p);
            } else {
              submitFeedback(true);
              setShowNote(false);
            }
          }}
          title="관련 있음"
        >
          {loading && isRelevant !== true ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsUp className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${isRelevant === false ? "text-destructive" : "text-muted-foreground"}`}
          disabled={loading}
          onClick={() => {
            if (isRelevant === false) {
              setShowNote((p) => !p);
            } else {
              submitFeedback(false);
              setShowNote(true);
            }
          }}
          title="관련 없음"
        >
          {loading && isRelevant !== false ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {showNote && (
        <div className="flex gap-1">
          <Input
            className="h-7 text-xs"
            placeholder="피드백 메모 (선택)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitFeedback(isRelevant ?? false);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={loading}
            onClick={() => submitFeedback(isRelevant ?? false)}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "저장"}
          </Button>
        </div>
      )}
    </div>
  );
}
