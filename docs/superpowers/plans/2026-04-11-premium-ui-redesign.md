# Premium UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AXLE's entire visual layer with a Premium Corporate design (Navy #0A1628 + Gold #C9A96E + Cool White #F8FAFC) without breaking any API connections, data fetching, or auth flows.

**Architecture:** CSS variables in `packages/ui/src/globals.css` drive all colors via Tailwind's HSL system. We update tokens first, then restyle shared components, then update page-level layouts (auth, app shell, landing). All Prisma queries, signIn/signOut calls, and server actions remain untouched — only JSX structure and Tailwind classes change.

**Tech Stack:** Next.js 16, Tailwind CSS 4, shadcn/ui (Radix + CVA), Pretendard font (new), Inter font (keep)

**CRITICAL CONSTRAINT:** Do NOT modify any data fetching code (Prisma queries, `getCurrentUser()`, `signIn()`, `signOut()`, server actions, API routes). Only change JSX structure and Tailwind/CSS classes.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/ui/src/globals.css` | Design tokens (CSS variables) |
| Modify | `packages/ui/src/components/button.tsx` | Button variant styles |
| Modify | `packages/ui/src/components/card.tsx` | Card styles |
| Modify | `packages/ui/src/components/input.tsx` | Input styles |
| Modify | `packages/ui/src/components/badge.tsx` | Badge + status variants |
| Modify | `packages/ui/src/components/sidebar.tsx` | Dark sidebar styles |
| Modify | `packages/ui/src/components/table.tsx` | Table styles |
| Modify | `apps/web/app/layout.tsx` | Root layout (font, metadata) |
| Modify | `apps/web/app/(auth)/layout.tsx` | Auth split layout |
| Modify | `apps/web/app/(auth)/login/page.tsx` | Login page redesign |
| Create | `apps/web/app/(auth)/signup/page.tsx` | New signup page |
| Modify | `apps/web/app/(app)/layout.tsx` | App shell (dark sidebar + light content) |
| Modify | `apps/web/app/(app)/dashboard/page.tsx` | Dashboard restyle |
| Modify | `apps/web/src/components/app-sidebar.tsx` | Sidebar branding + nav styles |
| Modify | `apps/web/src/components/user-menu.tsx` | User menu styles |
| Modify | `apps/web/src/components/mobile-sidebar.tsx` | Mobile sidebar styles |
| Create | `apps/web/app/(marketing)/page.tsx` | Landing page |
| Create | `apps/web/app/(marketing)/layout.tsx` | Marketing layout (no sidebar) |
| Modify | `apps/web/app/page.tsx` | Root redirect (point unauthenticated to landing) |

---

### Task 1: Update Design Tokens (globals.css)

**Files:**
- Modify: `packages/ui/src/globals.css`

- [ ] **Step 1: Replace CSS variables with Premium Corporate palette**

Replace the entire content of `packages/ui/src/globals.css` with:

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 210 20% 98.8%;
    --foreground: 218 80% 9%;
    --card: 0 0% 100%;
    --card-foreground: 218 80% 9%;
    --popover: 0 0% 100%;
    --popover-foreground: 218 80% 9%;
    --primary: 218 80% 9%;
    --primary-foreground: 39 41% 61%;
    --secondary: 210 20% 96%;
    --secondary-foreground: 218 80% 9%;
    --muted: 210 20% 96%;
    --muted-foreground: 220 9% 46%;
    --accent: 39 41% 61%;
    --accent-foreground: 218 80% 9%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --success: 142 71% 45%;
    --success-foreground: 0 0% 100%;
    --info: 217 91% 60%;
    --info-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 39 41% 61%;
    --radius: 0.5rem;
    --sidebar-background: 218 80% 9%;
    --sidebar-foreground: 210 20% 98%;
    --sidebar-primary: 39 41% 61%;
    --sidebar-primary-foreground: 218 80% 9%;
    --sidebar-accent: 220 60% 16%;
    --sidebar-accent-foreground: 39 41% 61%;
    --sidebar-border: 220 60% 16%;
    --sidebar-ring: 39 41% 61%;
    --sidebar-muted: 220 9% 46%;
  }

  .dark {
    --background: 218 80% 9%;
    --foreground: 210 20% 98%;
    --card: 220 60% 16%;
    --card-foreground: 210 20% 98%;
    --popover: 220 60% 16%;
    --popover-foreground: 210 20% 98%;
    --primary: 39 41% 61%;
    --primary-foreground: 218 80% 9%;
    --secondary: 220 60% 16%;
    --secondary-foreground: 210 20% 98%;
    --muted: 220 60% 16%;
    --muted-foreground: 215 20% 65%;
    --accent: 39 41% 61%;
    --accent-foreground: 218 80% 9%;
    --destructive: 0 63% 31%;
    --destructive-foreground: 210 20% 98%;
    --success: 142 71% 45%;
    --success-foreground: 0 0% 100%;
    --info: 217 91% 60%;
    --info-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --border: 220 60% 16%;
    --input: 220 60% 16%;
    --ring: 39 41% 61%;
    --sidebar-background: 218 85% 6%;
    --sidebar-foreground: 210 20% 98%;
    --sidebar-primary: 39 41% 61%;
    --sidebar-primary-foreground: 218 80% 9%;
    --sidebar-accent: 220 60% 12%;
    --sidebar-accent-foreground: 39 41% 61%;
    --sidebar-border: 220 60% 12%;
    --sidebar-ring: 39 41% 61%;
    --sidebar-muted: 215 20% 65%;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=@axle/ui`
Expected: Build succeeds. All existing components now render with new color tokens.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m "WI-chore style: update design tokens to Premium Corporate palette"
```

---

### Task 2: Update Root Layout (Fonts)

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Add Pretendard font and update metadata**

Replace the full file content. Keep the same structure — only change font setup and metadata:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const pretendard = localFont({
  src: [
    {
      path: "../public/fonts/PretendardVariable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AXLE — 컨설팅 자동화 플랫폼",
  description: "정부 지원사업, 벤처인증, 연구소 인증, 특허, 재무 컨설팅 업무를 자동화합니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${inter.variable} ${pretendard.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Download Pretendard font**

Run:
```bash
mkdir -p /Volumes/포터블/AXLE/apps/web/public/fonts
curl -L -o /Volumes/포터블/AXLE/apps/web/public/fonts/PretendardVariable.woff2 \
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/woff2/PretendardVariable.woff2"
```

- [ ] **Step 3: Update Tailwind font-family config**

Check if `apps/web/tailwind.config.ts` exists. If not, check `packages/ui/tailwind.config.ts` or the CSS file. Add font-family to the Tailwind theme. If using Tailwind CSS 4 with `@import "tailwindcss"` (no config file), add to globals.css at the end of `@layer base`:

```css
  * {
    font-family: var(--font-pretendard), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  }
```

- [ ] **Step 4: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds with new font configuration.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/public/fonts/ packages/ui/src/globals.css
git commit -m "WI-chore style: add Pretendard font and update root layout metadata"
```

---

### Task 3: Update Base UI Components

**Files:**
- Modify: `packages/ui/src/components/button.tsx`
- Modify: `packages/ui/src/components/card.tsx`
- Modify: `packages/ui/src/components/input.tsx`
- Modify: `packages/ui/src/components/badge.tsx`
- Modify: `packages/ui/src/components/table.tsx`

- [ ] **Step 1: Update button.tsx — add `accent` variant**

In `packages/ui/src/components/button.tsx`, add an `accent` variant to the `buttonVariants` CVA. The `accent` variant is for Gold CTA buttons. Change the `variant` object inside `buttonVariants`:

```typescript
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground",
        link: "text-accent underline-offset-4 hover:underline",
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90 font-semibold",
      },
```

Also update the `ButtonProps` type to include `accent` — this happens automatically since it's CVA-driven.

- [ ] **Step 2: Update badge.tsx — add status variants**

Replace the `badgeVariants` in `packages/ui/src/components/badge.tsx`:

```typescript
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        outline: "text-foreground",
        accent:
          "border-transparent bg-accent/15 text-accent",
        success:
          "border-transparent bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
        info:
          "border-transparent bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]",
        warning:
          "border-transparent bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
```

- [ ] **Step 3: Update card.tsx — refined border**

In `packages/ui/src/components/card.tsx`, update the Card's className from:
```
rounded-lg border bg-card text-card-foreground shadow-sm
```
to:
```
rounded-xl border bg-card text-card-foreground shadow-none
```

- [ ] **Step 4: Update input.tsx — gold focus ring**

In `packages/ui/src/components/input.tsx`, replace the className string:
```
flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50
```
with:
```
flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-accent disabled:opacity-50
```

- [ ] **Step 5: Update table.tsx — lighter header**

In `packages/ui/src/components/table.tsx`, update TableHead className from:
```
h-12 px-4 text-left align-middle font-medium text-muted-foreground
```
to:
```
h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground
```

- [ ] **Step 6: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=@axle/ui`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/button.tsx packages/ui/src/components/badge.tsx packages/ui/src/components/card.tsx packages/ui/src/components/input.tsx packages/ui/src/components/table.tsx
git commit -m "WI-chore style: update base UI components for Premium Corporate theme"
```

---

### Task 4: Restyle Sidebar Component

**Files:**
- Modify: `packages/ui/src/components/sidebar.tsx`

- [ ] **Step 1: Update Sidebar and SidebarItem styles**

The CSS variables already map to Navy/Gold via Task 1. We need structural changes for the premium look.

In `packages/ui/src/components/sidebar.tsx`, update the SidebarItem active state classes. Change lines 74-76 from:
```typescript
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
```
to:
```typescript
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
```

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=@axle/ui`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/sidebar.tsx
git commit -m "WI-chore style: update sidebar active states for Premium Corporate theme"
```

---

### Task 5: Restyle Auth Layout + Login Page

**Files:**
- Modify: `apps/web/app/(auth)/layout.tsx`
- Modify: `apps/web/app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace auth layout with split design**

Replace the entire content of `apps/web/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left: Navy branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-accent">
              <span className="text-accent text-lg font-extrabold">A</span>
            </div>
            <span className="text-accent text-lg font-bold tracking-widest">AXLE</span>
          </div>
          <h2 className="text-2xl font-bold leading-tight mb-3">
            컨설팅의 모든 과정을<br />자동화합니다
          </h2>
          <p className="text-sm text-primary-foreground/60 leading-relaxed">
            정부 ��원사업 · 벤처인증 · 연구소 인증<br />
            특허 · 재무 컨설팅
          </p>
        </div>
        <div className="bg-[hsl(220,60%,16%)] rounded-xl p-5">
          <p className="text-sm text-primary-foreground/70 italic leading-relaxed">
            &ldquo;AXLE 도입 후 서류 작성 시간이 70% 줄었습니다. 프로젝트 관리도 한눈에 됩니다.&rdquo;
          </p>
          <p className="text-accent text-sm mt-3 font-medium">— 김대표, A컨설팅</p>
        </div>
      </div>

      {/* Right: Form area */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 lg:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Restyle login page**

Replace the **entire JSX return** in `apps/web/app/(auth)/login/page.tsx`. Keep all imports, state, `handleCredentials`, `handleGoogle`, and `GoogleIcon` untouched. Only replace the `return (...)` block (lines 46-139):

```tsx
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
            <button type="button" className="text-xs text-accent hover:underline">
              비밀번호 찾기
            </button>
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
```

- [ ] **Step 3: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds. Login page renders with split layout.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/layout.tsx apps/web/app/\(auth\)/login/page.tsx
git commit -m "WI-chore style: redesign auth layout and login page with split Premium Corporate design"
```

---

### Task 6: Create Signup Page

**Files:**
- Create: `apps/web/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create signup page**

Create `apps/web/app/(auth)/signup/page.tsx`:

```tsx
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

      // Auto-login after signup
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
        <p className="text-sm text-muted-foreground">계��을 만들어 시작하세요</p>
      </div>

      {/* Google OAuth */}
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

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">또는</span>
        </div>
      </div>

      {/* Signup Form */}
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
        ��미 계정이 있으신가요?{" "}
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
```

Note: This page calls `POST /api/auth/signup` which may or may not exist. If it doesn't, the form will show an error — the signup API endpoint is a separate feature, not part of this UI task. The Google signup path works immediately via existing NextAuth.

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/signup/page.tsx
git commit -m "WI-chore feat: add signup page with Premium Corporate design"
```

---

### Task 7: Restyle App Layout + Sidebar

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx` (JSX only, keep data fetching on lines 14-17)
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/src/components/user-menu.tsx`
- Modify: `apps/web/src/components/mobile-sidebar.tsx`

- [ ] **Step 1: Update app layout — dark sidebar + light content shell**

In `apps/web/app/(app)/layout.tsx`, replace only the JSX return (lines 23-48). Keep lines 1-22 exactly as-is (imports, getCurrentUser, redirect, userMenu):

```tsx
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <AppSidebar userMenu={userMenu} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          {/* Mobile hamburger — visible only on mobile */}
          <div className="md:hidden">
            <MobileSidebar userMenu={userMenu} />
          </div>
          {/* Spacer for desktop */}
          <div className="hidden md:block" />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
```

- [ ] **Step 2: Update app-sidebar — Premium branding**

Replace the full `AppSidebar` component return in `apps/web/src/components/app-sidebar.tsx` (lines 51-83). Keep all imports and NAV_ITEMS:

```tsx
export function AppSidebar({ userMenu }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-sidebar-primary">
            <span className="text-sidebar-primary text-sm font-extrabold">A</span>
          </div>
          <span className="text-sidebar-primary text-sm font-bold tracking-widest">AXLE</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메뉴</SidebarGroupLabel>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="block">
                <SidebarItem
                  active={isActive}
                  icon={<Icon size={18} />}
                  label={item.label}
                />
              </Link>
            );
          })}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>{userMenu}</SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 3: Update user-menu styles**

In `apps/web/src/components/user-menu.tsx`, update the avatar div (line 25) from:
```
flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground overflow-hidden
```
to:
```
flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden
```

- [ ] **Step 4: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/layout.tsx apps/web/src/components/app-sidebar.tsx apps/web/src/components/user-menu.tsx
git commit -m "WI-chore style: restyle app shell with dark navy sidebar and premium branding"
```

---

### Task 8: Restyle Dashboard

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx` (JSX only, lines 51-80. Keep lines 1-49 untouched)

- [ ] **Step 1: Update dashboard JSX**

In `apps/web/app/(app)/dashboard/page.tsx`, replace only the return JSX (lines 51-80). Keep all imports, metadata, data fetching, and STAT_CARDS array exactly as-is:

```tsx
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          안녕하세요{user?.name ? `, ${user.name}님` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          오늘의 현황을 확인하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <Card key={card.title} className="border bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                {card.title}
              </CardDescription>
              <CardTitle className="text-3xl font-bold">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpiringDocumentsWidget />
      </div>
    </div>
  );
```

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds. Dashboard renders with new styling.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/page.tsx
git commit -m "WI-chore style: restyle dashboard with Premium Corporate design"
```

---

### Task 9: Create Landing Page

**Files:**
- Create: `apps/web/app/(marketing)/layout.tsx`
- Create: `apps/web/app/(marketing)/page.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Create marketing layout**

Create `apps/web/app/(marketing)/layout.tsx`:

```tsx
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create landing page**

Create `apps/web/app/(marketing)/page.tsx`:

```tsx
import Link from "next/link";
import { getCurrentUser } from "@axle/auth";
import { redirect } from "next/navigation";
import {
  FileText,
  Award,
  Building2,
  Scale,
  DollarSign,
  Sparkles,
  FolderKanban,
  Users,
  ArrowRight,
} from "lucide-react";

export const metadata = {
  title: "AXLE — 컨설팅 자동화 플랫폼",
  description: "정부 지원사업, 벤처인증, 연구소 인증, 특허, 재무 컨설팅 업무를 자동화합니다.",
};

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="bg-[#0A1628] text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px] border-[#C9A96E]">
            <span className="text-[#C9A96E] text-sm font-extrabold">A</span>
          </div>
          <span className="text-[#C9A96E] text-sm font-bold tracking-widest">AXLE</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#services" className="text-sm text-gray-400 hover:text-white transition-colors">서비스</a>
          <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">기능</a>
          <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">요금제</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">
            로그인
          </Link>
          <Link
            href="/signup"
            className="bg-[#C9A96E] text-[#0A1628] px-5 py-2 rounded-md text-sm font-semibold hover:bg-[#B8944F] transition-colors"
          >
            시작하기
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-20 md:py-32 max-w-4xl mx-auto">
        <p className="text-[#C9A96E] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
          Consulting Automation Platform
        </p>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
          컨설팅의 모든 과정을<br />자동화합니다
        </h1>
        <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
          정부 지원사업 · 벤처인증 · 연구소 인증 · 특허 · 재무 컨설팅<br className="hidden md:block" />
          AI 기반 서류 작성부터 프로젝트 관리까지, 하나의 플랫폼에서.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/signup"
            className="bg-[#C9A96E] text-[#0A1628] px-8 py-3 rounded-md text-sm font-semibold hover:bg-[#B8944F] transition-colors"
          >
            무료 체험
          </Link>
          <a
            href="#features"
            className="border border-[#C9A96E] text-[#C9A96E] px-8 py-3 rounded-md text-sm font-semibold hover:bg-[#C9A96E]/10 transition-colors"
          >
            더 알아보기
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-t border-white/10 py-12 max-w-4xl mx-auto">
        <div className="flex justify-center gap-16 md:gap-24">
          {[
            { value: "500+", label: "고객사" },
            { value: "98%", label: "성공률" },
            { value: "3,200+", label: "프로젝트" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-[#C9A96E] text-2xl md:text-3xl font-bold">{stat.value}</div>
              <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="px-6 py-20 md:py-28 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">전문 컨��팅 영역</h2>
          <p className="text-gray-400 text-sm">6개 핵심 분야를 하나의 플랫폼에서</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Award, title: "정부 지원사업", desc: "지원사업 탐색부터 신청서 작성까지 자동화" },
            { icon: Building2, title: "벤처인증", desc: "벤처기업 인증 요건 분석 및 서류 자동 생성" },
            { icon: FileText, title: "연구소 인증", desc: "기업부설연구소 인정 절차 자동 관리" },
            { icon: Scale, title: "특허", desc: "특허 출원/등록 프로세스 체계적 관리" },
            { icon: DollarSign, title: "재무 컨설팅", desc: "재무 분석, 사업계획서, 투자유치 지원" },
            { icon: Sparkles, title: "AI 매칭", desc: "고객사에 최적 지원사업 AI 자동 매칭" },
          ].map((service) => (
            <div
              key={service.title}
              className="bg-[#162040] rounded-xl p-6 border border-white/5 hover:border-[#C9A96E]/30 transition-colors"
            >
              <service.icon className="h-8 w-8 text-[#C9A96E] mb-4" />
              <h3 className="text-base font-semibold mb-2">{service.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{service.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 md:py-28 bg-[#0D1B2A] max-w-full">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">핵심 기능</h2>
            <p className="text-gray-400 text-sm">업무 효율을 극대화하는 자동화 기능</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "AI 서류 자동 작성",
                desc: "지원사업 신청서, 사업계획서 등 핵심 서류��� AI가 자동 생성합니다. 템플릿 기반으로 빠르고 정확하게.",
              },
              {
                icon: FolderKanban,
                title: "프로젝트 관리",
                desc: "컨설�� 파이프라인을 한눈에. 진행 상황, 마감일, 담당자를 실시간으로 추적합니다.",
              },
              {
                icon: Users,
                title: "고객 포털",
                desc: "고객과 실시간으로 문서를 공유하고, 진행 상황을 투명하게 전달합니다.",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A96E]/10 mx-auto mb-5">
                  <feature.icon className="h-7 w-7 text-[#C9A96E]" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 md:py-28 text-center max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          지금 시작하세요
        </h2>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          14일 무료 체험 · 카드 등록 불필��� · 모든 기능 이용 가능
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#0A1628] px-8 py-3 rounded-md text-sm font-semibold hover:bg-[#B8944F] transition-colors"
        >
          무료 체험 시작 <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-10 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#C9A96E]/50">
              <span className="text-[#C9A96E] text-xs font-extrabold">A</span>
            </div>
            <span className="text-[#C9A96E] text-xs font-bold tracking-widest">AXLE</span>
          </div>
          <div className="flex gap-6 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">이용약관</a>
            <a href="#" className="hover:text-gray-300 transition-colors">개인정보처리방침</a>
            <a href="#" className="hover:text-gray-300 transition-colors">문의하기</a>
          </div>
          <p className="text-xs text-gray-600">© 2026 AXLE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Update root page.tsx to point unauthenticated users to landing**

Replace `apps/web/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@axle/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  redirect("/");
}
```

Wait — this would cause a redirect loop since the marketing page is at `(marketing)/page.tsx` which maps to `/`. The root `page.tsx` and `(marketing)/page.tsx` both map to `/`. We need to resolve this conflict.

**Resolution:** Delete the root `page.tsx` and let `(marketing)/page.tsx` handle `/`. The marketing page already checks for auth and redirects to dashboard.

Delete `apps/web/app/page.tsx` and the `(marketing)/page.tsx` handles both authenticated (redirect to dashboard) and unauthenticated (show landing) cases.

- [ ] **Step 4: Delete root page.tsx**

Run:
```bash
rm /Volumes/포터블/AXLE/apps/web/app/page.tsx
```

- [ ] **Step 5: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds. Landing page renders at `/`. Authenticated users redirect to `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(marketing\)/layout.tsx apps/web/app/\(marketing\)/page.tsx
git rm apps/web/app/page.tsx
git commit -m "WI-chore feat: add Premium Corporate landing page and remove old root redirect"
```

---

### Task 10: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build`
Expected: All packages and apps build successfully.

- [ ] **Step 2: Lint check**

Run: `cd /Volumes/포터블/AXLE && npx turbo lint`
Expected: No new lint errors.

- [ ] **Step 3: Type check**

Run: `cd /Volumes/포터블/AXLE && npx turbo typecheck`
Expected: No type errors.

- [ ] **Step 4: Manual verification checklist**

Verify these pages render correctly:
- [ ] `/` — Landing page with Navy background, Gold accents, 7 sections
- [ ] `/login` — Split layout (Navy left + Light right)
- [ ] `/signup` — Split layout with signup form
- [ ] `/dashboard` — Dark sidebar + Light content, stat cards
- [ ] `/clients` — Table list with new styling
- [ ] Sidebar navigation works, active states show Gold
- [ ] Mobile responsive — sidebar becomes sheet
- [ ] Google OAuth button works (no API breakage)

- [ ] **Step 5: Commit any fixes**

If any issues found, fix and commit:
```bash
git add -A
git commit -m "WI-chore fix: address post-verification styling issues"
```
