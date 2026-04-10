"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";
import { Download, Send, Trash2 } from "lucide-react";
import type { ContractStatus } from "@prisma/client";

interface ContractActionsProps {
  contractId: string;
  status: ContractStatus;
  contractNumber: string;
}

export function ContractActions({
  contractId,
  status,
  contractNumber,
}: ContractActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading("send");
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/send`, {
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
      const res = await fetch(`/api/contracts/${contractId}/download`);
      if (!res.ok) {
        setError("다운로드 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contractNumber}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`계약서 ${contractNumber}을 삭제하시겠습니까?`)) return;
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "삭제 실패");
        return;
      }
      router.push("/contracts");
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
