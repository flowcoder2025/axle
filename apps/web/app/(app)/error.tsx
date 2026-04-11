"use client";

import { useEffect } from "react";
import { Button } from "@axle/ui";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">문제가 발생했습니다</h2>
        <p className="text-muted-foreground max-w-sm">
          페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.
        </p>
      </div>
      <Button onClick={reset}>재시도</Button>
    </div>
  );
}
