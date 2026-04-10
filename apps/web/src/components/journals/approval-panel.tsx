"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@axle/ui";
import { CheckCircle, Clock, FileText } from "lucide-react";

interface ApprovalPanelProps {
  journalId: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  approvedBy: string | null;
  approvedAt: string | null;
}

const STATUS_INFO: Record<
  string,
  { label: string; description: string; variant: "outline" | "secondary" | "default" }
> = {
  DRAFT: {
    label: "초안",
    description: "연구일지가 작성 중입니다. 제출하면 승인을 요청할 수 있습니다.",
    variant: "outline",
  },
  SUBMITTED: {
    label: "제출됨",
    description: "승인 대기 중입니다. 담당 컨설턴트가 검토 후 승인합니다.",
    variant: "secondary",
  },
  APPROVED: {
    label: "승인됨",
    description: "연구일지가 승인되었습니다.",
    variant: "default",
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ApprovalPanel({
  journalId,
  status,
  approvedBy,
  approvedAt,
}: ApprovalPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = STATUS_INFO[status] ?? STATUS_INFO.DRAFT;

  async function handleAction(action: "submit" | "approve") {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/journals/${journalId}/${action}`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message ?? "처리 중 오류가 발생했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          승인 상태
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={info.variant}>{info.label}</Badge>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>

        {status === "APPROVED" && approvedAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{formatDate(approvedAt)} 승인됨</span>
            {approvedBy && <span className="text-xs">(ID: {approvedBy})</span>}
          </div>
        )}

        {status === "SUBMITTED" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span>승인 대기 중</span>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          {status === "DRAFT" && (
            <Button
              size="sm"
              onClick={() => handleAction("submit")}
              disabled={loading}
            >
              {loading ? "처리 중..." : "제출하기"}
            </Button>
          )}
          {status === "SUBMITTED" && (
            <Button
              size="sm"
              onClick={() => handleAction("approve")}
              disabled={loading}
            >
              {loading ? "처리 중..." : "승인하기"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
