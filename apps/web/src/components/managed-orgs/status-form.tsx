"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@axle/ui";
import { setManagedOrgStatusAction } from "../../../app/(app)/settings/managed-orgs/actions";

type Status = "ACTIVE" | "PAUSED" | "TERMINATED";

const NEXT_LABEL: Record<Status, Array<{ label: string; next: Status }>> = {
  ACTIVE: [
    { label: "일시정지", next: "PAUSED" },
    { label: "종료", next: "TERMINATED" },
  ],
  PAUSED: [
    { label: "다시 활성화", next: "ACTIVE" },
    { label: "종료", next: "TERMINATED" },
  ],
  TERMINATED: [
    { label: "재활성화", next: "ACTIVE" },
  ],
};

export function ManagedOrgStatusForm({
  managedOrgId,
  current,
}: {
  managedOrgId: string;
  current: Status;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = (next: Status) => {
    if (
      next === "TERMINATED" &&
      !window.confirm(
        "이 관리 조직을 종료하면 사이드바 스위처에서 제외되고 다시 활성화하기 전까지 데이터 접근이 차단됩니다.\n\n계속하시겠습니까?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setManagedOrgStatusAction(managedOrgId, next);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2" data-testid="status-form">
      {NEXT_LABEL[current].map((opt) => (
        <Button
          key={opt.next}
          variant={opt.next === "TERMINATED" ? "destructive" : "outline"}
          size="sm"
          disabled={pending}
          onClick={() => handleClick(opt.next)}
          data-testid={`status-action-${opt.next}`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
