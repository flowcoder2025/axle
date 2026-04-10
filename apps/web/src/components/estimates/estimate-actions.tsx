"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";
import { Download, Send, ArrowRight, Trash2 } from "lucide-react";
import type { EstimateStatus } from "@prisma/client";

interface EstimateActionsProps {
  estimateId: string;
  status: EstimateStatus;
  estimateNumber: string;
}

export function EstimateActions({
  estimateId,
  status,
  estimateNumber,
}: EstimateActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading("send");
    setError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "발송 실패");
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDownload() {
    setLoading("download");
    setError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/download`);
      if (!res.ok) {
        setError("다운로드 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${estimateNumber}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleConvert() {
    setLoading("convert");
    setError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "전환 실패");
        return;
      }
      const data = await res.json();
      router.push(`/contracts/${data.data.id}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`견적서 ${estimateNumber}을 삭제하시겠습니까?`)) return;
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "삭제 실패");
        return;
      }
      router.push("/estimates");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={loading !== null}
        >
          <Download className="mr-1.5 h-4 w-4" />
          {loading === "download" ? "처리 중..." : "다운로드"}
        </Button>

        {status === "DRAFT" && (
          <Button
            size="sm"
            onClick={handleSend}
            disabled={loading !== null}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {loading === "send" ? "발송 중..." : "이메일 발송"}
          </Button>
        )}

        {status === "ACCEPTED" && (
          <Button
            size="sm"
            onClick={handleConvert}
            disabled={loading !== null}
          >
            <ArrowRight className="mr-1.5 h-4 w-4" />
            {loading === "convert" ? "처리 중..." : "계약서 전환"}
          </Button>
        )}

        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={loading !== null}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          삭제
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
