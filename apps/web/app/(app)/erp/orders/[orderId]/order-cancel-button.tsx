"use client";

/**
 * Cancel-order button (Client Component).
 *
 * POSTs to /api/erp/orders/[orderId]/cancel after a confirm() prompt. On
 * success, refreshes the current route so the server-rendered detail page
 * picks up the new CANCELLED status. On 409 (already cancelled / DRAFT)
 * we surface the server message — the parent page rerenders and hides
 * this button on the next round-trip.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@axle/ui";

interface OrderCancelButtonProps {
  orderId: string;
}

export function OrderCancelButton({ orderId }: OrderCancelButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (submitting) return;
    if (!window.confirm("이 주문을 취소하시겠어요? 재고 이동이 역방향으로 자동 생성됩니다.")) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/erp/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || `취소 실패 (${res.status})`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      ) : null}
      <Button
        type="button"
        variant="destructive"
        onClick={onClick}
        disabled={submitting}
      >
        {submitting ? "취소 중..." : "주문 취소"}
      </Button>
    </div>
  );
}
