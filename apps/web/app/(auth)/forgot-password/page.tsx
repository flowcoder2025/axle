"use client";

import { useState } from "react";
import { Button, Input, Label } from "@axle/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "요청 처리 중 오류가 발생했습니다.");
        setLoading(false);
        return;
      }
      // 성공/미등록 이메일 여부 모두 동일 화면 (enumeration 방지)
      setSubmitted(true);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-accent">
            <span className="text-accent text-lg font-extrabold">A</span>
          </div>
          <span className="text-lg font-bold tracking-widest">AXLE</span>
        </div>

        <div className="space-y-2 mb-6">
          <h1 className="text-xl font-bold text-foreground">이메일을 확인해 주세요</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            입력하신 이메일이 AXLE에 등록되어 있다면, 비밀번호 재설정 링크가 포함된 메일이 곧 도착합니다. 받은편지함과 스팸함을 확인해 주세요.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            링크는 발송 후 <strong>30분</strong> 동안만 유효합니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full h-10"
            onClick={() => {
              setSubmitted(false);
              setEmail("");
            }}
          >
            다른 이메일로 다시 요청
          </Button>
          <a
            href="/login"
            className="text-center text-sm text-accent font-semibold hover:underline"
          >
            로그인으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile-only logo */}
      <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-accent">
          <span className="text-accent text-lg font-extrabold">A</span>
        </div>
        <span className="text-lg font-bold tracking-widest">AXLE</span>
      </div>

      <div className="space-y-1 mb-6">
        <h1 className="text-xl font-bold text-foreground">비밀번호 찾기</h1>
        <p className="text-sm text-muted-foreground">
          가입하신 이메일을 입력하시면 재설정 링크를 보내드립니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">
            이메일
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        <Button type="submit" className="w-full h-10" disabled={loading || !email}>
          {loading ? "전송 중..." : "재설정 링크 보내기"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        <a href="/login" className="text-accent font-semibold hover:underline">
          로그인으로 돌아가기
        </a>
      </p>
    </div>
  );
}
