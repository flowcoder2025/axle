"use client";

import { useState, useTransition } from "react";
import {
  Button,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  toast,
} from "@axle/ui";
import { toggleOrgSuspend } from "../actions";

type SuspendToggleProps = {
  orgId: string;
  isSuspended: boolean;
};

export function SuspendToggle({ orgId, isSuspended }: SuspendToggleProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await toggleOrgSuspend(orgId, !isSuspended);
      if (result.ok) {
        toast.success(isSuspended ? "해제되었습니다" : "정지되었습니다");
      } else {
        toast.error(result.error);
      }
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        variant={isSuspended ? "outline" : "destructive"}
        onClick={() => setOpen(true)}
      >
        {isSuspended ? "정지 해제" : "조직 정지"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSuspended ? "조직 정지 해제" : "조직 정지"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuspended
                ? "이 조직의 정지를 해제합니다. 모든 멤버가 다시 로그인할 수 있습니다."
                : "이 조직을 정지합니다. 정지 중에는 모든 멤버가 접근할 수 없습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending ? "처리 중..." : "확인"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
