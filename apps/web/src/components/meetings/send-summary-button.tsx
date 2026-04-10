"use client";

import { useState } from "react";
import { Button } from "@axle/ui";
import { Mail } from "lucide-react";

interface SendSummaryButtonProps {
  meetingId: string;
  hasSummary: boolean;
}

export function SendSummaryButton({ meetingId, hasSummary }: SendSummaryButtonProps) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!confirm("미팅 요약을 모든 참석자에게 이메일로 발송하시겠습니까?")) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/send-summary`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "발송에 실패했습니다.");
        return;
      }
      setResult(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSend}
        disabled={sending || !hasSummary}
        title={!hasSummary ? "요약이 생성된 후 발송할 수 있습니다" : undefined}
      >
        <Mail className="mr-1.5 h-4 w-4" />
        {sending ? "발송 중..." : "요약 메일 발송"}
      </Button>
      {result && (
        <span className="text-sm text-green-600">
          {result.sent}명에게 발송되었습니다.
        </span>
      )}
      {error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
    </div>
  );
}
