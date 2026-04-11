"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Label } from "@axle/ui";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "회원가입에 실패했습니다.");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("서버 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
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
        <h1 className="text-xl font-bold text-foreground">회원가입</h1>
        <p className="text-sm text-muted-foreground">계정을 만들어 시작하세요</p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-3 font-medium mb-4"
        onClick={handleGoogle}
        disabled={loading}
      >
        <GoogleIcon className="h-5 w-5" />
        Google로 가입하기
      </Button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">또는</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium">이름</Label>
            <Input
              id="name"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company" className="text-xs font-medium">회사명</Label>
            <Input
              id="company"
              placeholder="ABC컨설팅"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-email" className="text-xs font-medium">이메일</Label>
          <Input
            id="signup-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-password" className="text-xs font-medium">비밀번호</Label>
          <Input
            id="signup-password"
            type="password"
            placeholder="8자 이상"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
          />
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}
        <Button type="submit" className="w-full h-10" disabled={loading}>
          {loading ? "가입 중..." : "가입하기"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        이미 계정이 있으신가요?{" "}
        <a href="/login" className="text-accent font-semibold hover:underline">
          로그인
        </a>
      </p>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
