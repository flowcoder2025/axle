"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Input, Label } from "@axle/ui";

// Auth.js OAuth error codes → user-facing Korean messages
function getOAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "이 이메일은 이미 다른 방식(이메일/비밀번호)으로 가입되어 있습니다. 아래 이메일 로그인으로 진행해 주세요. 계정 보안을 위해 Google 연결은 로그인 후 설정에서 진행할 수 있습니다.";
    case "OAuthCallback":
    case "OAuthSignin":
      return "Google 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    case "AccessDenied":
      return "접근이 거부되었습니다. 다른 계정으로 시도하거나 관리자에게 문의해 주세요.";
    case "Verification":
      return "인증 링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요.";
    case "Configuration":
      return "로그인 구성에 문제가 있습니다. 지원팀에 문의해 주세요.";
    default:
      return "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.";
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const urlErrorCode = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const oauthNotice = noticeDismissed ? null : getOAuthErrorMessage(urlErrorCode);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setNoticeDismissed(true);
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
        <h1 className="text-xl font-bold text-foreground">로그인</h1>
        <p className="text-sm text-muted-foreground">계정에 로그인하세요</p>
      </div>

      {/* OAuth redirect error notice — 계정 탈취 방지로 차단된 경우 포함 */}
      {oauthNotice && (
        <div
          role="status"
          data-testid="oauth-error-notice"
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900"
        >
          {oauthNotice}
        </div>
      )}

      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-3 font-medium mb-4"
        onClick={handleGoogle}
        disabled={loading}
      >
        <GoogleIcon className="h-5 w-5" />
        Google로 계속하기
      </Button>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">또는</span>
        </div>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleCredentials} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">이메일</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-xs font-medium">비밀번호</Label>
            <a
              href="/forgot-password"
              className="text-xs text-accent hover:underline"
            >
              비밀번호 찾기
            </a>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}
        <Button type="submit" className="w-full h-10" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        계정이 없으신가요?{" "}
        <a href="/signup" className="text-accent font-semibold hover:underline">
          회원가입
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
