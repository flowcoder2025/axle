"use client";

import { useCallback, useState } from "react";
import { Button, toast } from "@axle/ui";
import { Rocket } from "lucide-react";

interface ClientOnboardButtonProps {
  clientId: string;
  initialOnboardedAt?: string | null;
}

/**
 * Triggers the onboarding checklist dispatch for an existing client and
 * renders a brief "onboarded at" timestamp once complete.
 */
export function ClientOnboardButton({
  clientId,
  initialOnboardedAt,
}: ClientOnboardButtonProps) {
  const [loading, setLoading] = useState(false);
  const [onboardedAt, setOnboardedAt] = useState<string | null>(
    initialOnboardedAt ?? null,
  );

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboard`, {
        method: "POST",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error?.message ?? "온보딩 시작에 실패했습니다");
      }
      const json = (await res.json()) as {
        data: { onboardedAt: string | null };
      };
      setOnboardedAt(json.data.onboardedAt);
      toast.success("온보딩 체크리스트를 발송했습니다");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={loading}
        data-testid="client-onboard-button"
      >
        <Rocket className="mr-1.5 h-3.5 w-3.5" />
        {loading
          ? "시작 중..."
          : onboardedAt
            ? "온보딩 재발송"
            : "온보딩 시작"}
      </Button>
      {onboardedAt && (
        <span className="text-xs text-muted-foreground">
          최근 발송: {new Date(onboardedAt).toLocaleString("ko-KR")}
        </span>
      )}
    </div>
  );
}
