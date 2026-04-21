"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@axle/ui";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div>
        <div className="space-y-2 mb-6">
          <h1 className="text-xl font-bold text-foreground">유효하지 않은 링크</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            재설정 링크가 올바르지 않거나 만료되었습니다. 비밀번호 찾기를 다시 요청해 주세요.
          </p>
        </div>
        <a
          href="/forgot-password"
          className="block w-full text-center h-10 leading-10 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          비밀번호 찾기로 이동
        </a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "재설정 중 오류가 발생했습니다.");
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div>
        <div className="space-y-2 mb-6">
          <h1 className="text-xl font-bold text-foreground">비밀번호가 재설정되었습니다</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            이제 새 비밀번호로 로그인하실 수 있습니다.
          </p>
        </div>
        <a
          href="/login"
          className="block w-full text-center h-10 leading-10 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          로그인으로 이동
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-accent">
          <span className="text-accent text-lg font-extrabold">A</span>
        </div>
        <span className="text-lg font-bold tracking-widest">AXLE</span>
      </div>

      <div className="space-y-1 mb-6">
        <h1 className="text-xl font-bold text-foreground">새 비밀번호 설정</h1>
        <p className="text-sm text-muted-foreground">
          8자 이상의 새 비밀번호를 입력해 주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium">
            새 비밀번호
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            minLength={8}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-xs font-medium">
            새 비밀번호 확인
          </Label>
          <Input
            id="confirm"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-10"
          disabled={loading || !password || !confirm}
        >
          {loading ? "재설정 중..." : "비밀번호 재설정"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
