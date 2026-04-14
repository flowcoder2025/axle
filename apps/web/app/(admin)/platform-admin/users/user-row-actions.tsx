"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { changeUserRole, setUserActive } from "./actions";

type UserRowActionsProps = {
  userId: string;
  currentUserId: string;
  platformRole: "USER" | "PLATFORM_ADMIN";
  isActive: boolean;
};

type PendingAction =
  | { type: "promote" }
  | { type: "demote" }
  | { type: "activate" }
  | { type: "deactivate" }
  | null;

const CONFIRM_TEXT: Record<NonNullable<PendingAction>["type"], string> = {
  promote:
    "이 사용자를 플랫폼 관리자로 승격하시겠습니까? 관리자는 전체 플랫폼에 접근할 수 있습니다.",
  demote: "이 사용자의 플랫폼 관리자 권한을 해제하시겠습니까?",
  activate: "이 사용자를 활성화하시겠습니까?",
  deactivate: "이 사용자를 비활성화하시겠습니까? 로그인이 차단됩니다.",
};

export function UserRowActions({
  userId,
  currentUserId,
  platformRole,
  isActive,
}: UserRowActionsProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();

  const isSelf = userId === currentUserId;

  const handleConfirm = () => {
    if (!pending) return;
    startTransition(async () => {
      let result;
      if (pending.type === "promote") {
        result = await changeUserRole(userId, "PLATFORM_ADMIN");
      } else if (pending.type === "demote") {
        result = await changeUserRole(userId, "USER");
      } else if (pending.type === "activate") {
        result = await setUserActive(userId, true);
      } else {
        result = await setUserActive(userId, false);
      }

      if (result.ok) {
        toast.success("변경되었습니다");
      } else {
        toast.error(result.error);
      }
      setPending(null);
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {platformRole === "USER" ? (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "promote" })}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              관리자로 승격
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "demote" })}
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              관리자 권한 해제
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isActive ? (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "deactivate" })}
            >
              <UserX className="mr-2 h-4 w-4" />
              비활성화
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setPending({ type: "activate" })}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              활성화
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작업 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? CONFIRM_TEXT[pending.type] : ""}
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
