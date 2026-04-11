# Post-MVP Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8 post-MVP features across schema changes, code enhancements, and deployment.

**Architecture:** Three-phase approach — (A) schema + infrastructure changes, (B) feature code, (C) deploy. Phase A lands schema changes before DB push. Phase B implements 6 independent features. Phase C deploys to Vercel.

**Tech Stack:** TypeScript, Next.js 16, Prisma 7, Auth.js v5, Anthropic SDK, SSE (ReadableStream), Radix Dialog (Sheet), AES-256-GCM encryption

---

## Phase A: Schema + Infrastructure

### Task 1: Prisma Schema — OAuthToken Model + assignedTo FK

**Files:**
- Modify: `packages/db/prisma/schema.prisma:24-38` (User model — add relations)
- Modify: `packages/db/prisma/schema.prisma:163-209` (Client model — assignedTo → FK)
- Modify: `packages/db/prisma/schema.prisma:399-438` (Project model — assignedTo → FK)
- Create: (new model OAuthToken after User)

- [ ] **Step 1: Add OAuthToken model and User relations**

In `packages/db/prisma/schema.prisma`, after the User model (line 38), add:

```prisma
model OAuthToken {
  id           String   @id @default(cuid())
  userId       String
  provider     String   // e.g. "GOOGLE"
  accessToken  String   @db.Text // AES-256-GCM encrypted
  refreshToken String?  @db.Text // AES-256-GCM encrypted
  expiresAt    DateTime?
  scope        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
}
```

Update User model (lines 24-38) — add three new relations:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?

  accounts      Account[]
  sessions      Session[]
  memberships   Membership[]
  notifications Notification[]
  oauthTokens   OAuthToken[]
  assignedClients  Client[]  @relation("ClientAssignee")
  assignedProjects Project[] @relation("ProjectAssignee")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Convert Client.assignedTo to FK**

In `packages/db/prisma/schema.prisma`, Client model (lines 163-209):

Change line 176 from:
```prisma
  assignedTo        String?
```
To:
```prisma
  assignedToId      String?
  assignedToUser    User?    @relation("ClientAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
```

Add index (after `@@index([orgId])`):
```prisma
  @@index([assignedToId])
```

- [ ] **Step 3: Convert Project.assignedTo to FK**

In `packages/db/prisma/schema.prisma`, Project model (lines 399-438):

Change line 408 from:
```prisma
  assignedTo        String?   // Display-only free text. Use ProjectMember LEAD role for actual assignment.
```
To:
```prisma
  assignedToId      String?
  assignedToUser    User?    @relation("ProjectAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
```

Add index (after `@@index([programId])`):
```prisma
  @@index([assignedToId])
```

- [ ] **Step 4: Verify schema is valid**

Run: `cd /Volumes/포터블/AXLE && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 5: Generate Prisma client**

Run: `cd /Volumes/포터블/AXLE && npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "WI-chore schema: add OAuthToken model, convert assignedTo to User FK"
```

---

### Task 2: Add Sheet Component to @axle/ui

**Files:**
- Create: `packages/ui/src/components/sheet.tsx`
- Modify: `packages/ui/src/index.ts:78` (add sheet exports)

- [ ] **Step 1: Create Sheet component**

Create `packages/ui/src/components/sheet.tsx`:

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "top" | "right" | "bottom" | "left";
}

const SIDE_CLASSES = {
  top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  bottom:
    "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  right:
    "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
};

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        SIDE_CLASSES[side],
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
```

- [ ] **Step 2: Export Sheet from index.ts**

In `packages/ui/src/index.ts`, add after the Sidebar exports (line 77):

```typescript
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./components/sheet.js";
```

- [ ] **Step 3: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=@axle/ui`
Expected: Build succeeds (Sheet uses same @radix-ui/react-dialog already in deps)

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/sheet.tsx packages/ui/src/index.ts
git commit -m "WI-chore add Sheet component to @axle/ui"
```

---

### Task 3: Add Anthropic SDK + Crypto Utility

**Files:**
- Modify: `packages/ai/package.json:19-23` (add @anthropic-ai/sdk)
- Create: `packages/ai/src/claude.ts` (Anthropic SDK wrapper)
- Create: `apps/web/lib/crypto.ts` (AES-256-GCM encrypt/decrypt)

- [ ] **Step 1: Install @anthropic-ai/sdk**

Run: `cd /Volumes/포터블/AXLE/packages/ai && npm install @anthropic-ai/sdk`

- [ ] **Step 2: Create Claude SDK wrapper**

Create `packages/ai/src/claude.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic(); // uses ANTHROPIC_API_KEY env var
  }
  return _client;
}

export interface ClaudeCompletionInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

/**
 * Send a single prompt to Claude and return the text response.
 * Throws on API errors — callers should handle gracefully.
 */
export async function complete(input: ClaudeCompletionInput): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: input.model ?? "claude-haiku-4-5-20251001",
    max_tokens: input.maxTokens ?? 2048,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
```

- [ ] **Step 3: Create crypto utility for OAuth tokens**

Create `apps/web/lib/crypto.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.OAUTH_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "OAUTH_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const data = Buffer.from(encoded, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
```

- [ ] **Step 4: Write crypto tests**

Create `apps/web/__tests__/lib/crypto.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Set test key before importing
vi.stubEnv("OAUTH_ENCRYPTION_KEY", "a".repeat(64));

const { encrypt, decrypt } = await import("@/lib/crypto");

describe("crypto", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "my-secret-token-value";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("handles unicode strings", () => {
    const plaintext = "한글 토큰 값 with emoji 🔑";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd /Volumes/포터블/AXLE && npx vitest run apps/web/__tests__/lib/crypto.test.ts`
Expected: 3 tests pass

- [ ] **Step 6: Export claude module from packages/ai**

In `packages/ai/src/index.ts`, add:
```typescript
export { complete } from "./claude.js";
export type { ClaudeCompletionInput } from "./claude.js";
```

- [ ] **Step 7: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=@axle/ai`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add packages/ai/package.json packages/ai/src/claude.ts packages/ai/src/index.ts apps/web/lib/crypto.ts apps/web/__tests__/lib/crypto.test.ts
git commit -m "WI-chore add Anthropic SDK wrapper and AES-256-GCM crypto utility"
```

---

## Phase B: Feature Implementation

### Task 4: OAuth Token Server-Side Storage (#7)

**Files:**
- Create: `apps/web/app/api/oauth/tokens/route.ts`
- Modify: `apps/web/app/api/google-calendar/callback/route.ts` (store tokens in DB)
- Modify: `apps/web/app/api/google-calendar/sync/route.ts` (read tokens from DB)
- Modify: `apps/web/src/components/settings/google-calendar-card.tsx` (remove localStorage)

- [ ] **Step 1: Write test for OAuth token API**

Create `apps/web/__tests__/api/oauth-tokens.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("OAUTH_ENCRYPTION_KEY", "a".repeat(64));

// Mock auth
vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

// Mock prisma
vi.mock("@axle/db", () => ({
  prisma: {
    oAuthToken: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";

describe("OAuth Token API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const { GET } = await import("@/app/api/oauth/tokens/route");
    const req = new Request("http://localhost/api/oauth/tokens?provider=GOOGLE");
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it("returns token status when authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      orgId: "org-1",
    } as any);
    vi.mocked(prisma.oAuthToken.findUnique).mockResolvedValue({
      id: "tok-1",
      provider: "GOOGLE",
      expiresAt: new Date("2099-01-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const { GET } = await import("@/app/api/oauth/tokens/route");
    const req = new Request("http://localhost/api/oauth/tokens?provider=GOOGLE");
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.connected).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/포터블/AXLE && npx vitest run apps/web/__tests__/api/oauth-tokens.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create OAuth token API route**

Create `apps/web/app/api/oauth/tokens/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { unauthorizedResponse, handleInternalError } from "@/lib/api-helpers";

// GET /api/oauth/tokens?provider=GOOGLE — check connection status
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const provider = new URL(req.url).searchParams.get("provider") ?? "GOOGLE";

    const token = await prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId: user.id, provider } },
      select: { id: true, provider: true, expiresAt: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      data: {
        connected: token !== null,
        provider,
        connectedAt: token?.createdAt?.toISOString() ?? null,
        lastUpdated: token?.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/oauth/tokens — store encrypted tokens
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json();
    const { provider, accessToken, refreshToken, expiresAt, scope } = body;

    if (!provider || !accessToken) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "provider and accessToken are required" } },
        { status: 400 },
      );
    }

    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: {
        userId: user.id,
        provider,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        scope: scope ?? null,
      },
      update: {
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        scope: scope ?? null,
      },
    });

    return NextResponse.json({ data: { stored: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/oauth/tokens?provider=GOOGLE — disconnect
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const provider = new URL(req.url).searchParams.get("provider") ?? "GOOGLE";

    try {
      await prisma.oAuthToken.delete({
        where: { userId_provider: { userId: user.id, provider } },
      });
    } catch (err) {
      // P2025: not found — already disconnected
      if ((err as { code?: string }).code !== "P2025") throw err;
    }

    return NextResponse.json({ data: { disconnected: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 4: Create helper to read decrypted tokens from DB**

Create `apps/web/lib/services/oauth-tokens.ts`:

```typescript
import { prisma } from "@axle/db";
import { decrypt } from "@/lib/crypto";

interface DecryptedTokens {
  accessToken: string;
  refreshToken: string | null;
}

/**
 * Fetch and decrypt OAuth tokens for a user+provider from DB.
 * Returns null if not connected.
 */
export async function getDecryptedTokens(
  userId: string,
  provider: string,
): Promise<DecryptedTokens | null> {
  const record = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!record) return null;

  return {
    accessToken: decrypt(record.accessToken),
    refreshToken: record.refreshToken ? decrypt(record.refreshToken) : null,
  };
}
```

- [ ] **Step 5: Update Google Calendar callback to store tokens in DB**

Modify `apps/web/app/api/google-calendar/callback/route.ts`:

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { exchangeCode } from "@/lib/services/google-calendar";
import { encrypt } from "@/lib/crypto";
import { unauthorizedResponse, handleInternalError } from "@/lib/api-helpers";

// GET /api/google-calendar/callback — handle Google OAuth callback, store tokens in DB
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.json(
        { error: { code: "OAUTH_DENIED", message: `Google OAuth error: ${error}` } },
        { status: 400 },
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: { code: "MISSING_CODE", message: "Missing authorization code" } },
        { status: 400 },
      );
    }

    const tokens = await exchangeCode(code);

    // Store encrypted tokens in DB
    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
      create: {
        userId: user.id,
        provider: "GOOGLE",
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        scope: "calendar",
      },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      },
    });

    // Redirect back to settings with success indicator (no tokens in URL)
    const settingsUrl = new URL("/settings", req.url);
    settingsUrl.searchParams.set("gc_connected", "true");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [ ] **Step 6: Update Google Calendar sync to read tokens from DB**

Modify `apps/web/app/api/google-calendar/sync/route.ts` — change to read tokens from DB instead of request body:

Replace the token-reading portion: instead of reading `accessToken`/`refreshToken` from `req.json()`, call:

```typescript
import { getDecryptedTokens } from "@/lib/services/oauth-tokens";

// Inside POST handler, after auth check:
const tokens = await getDecryptedTokens(user.id, "GOOGLE");
if (!tokens) {
  return NextResponse.json(
    { error: { code: "NOT_CONNECTED", message: "Google Calendar not connected" } },
    { status: 400 },
  );
}
// Use tokens.accessToken, tokens.refreshToken
```

- [ ] **Step 7: Update GoogleCalendarCard — remove localStorage**

Rewrite `apps/web/src/components/settings/google-calendar-card.tsx`:

```tsx
"use client";

import { useEffect, useReducer, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@axle/ui";

interface State {
  connected: boolean;
  connectedAt: string | null;
  syncing: boolean;
  syncResult: { pushed: number; pulled: number } | null;
  syncError: string | null;
  loading: boolean;
}

type Action =
  | { type: "LOADED"; connected: boolean; connectedAt: string | null }
  | { type: "SYNC_START" }
  | { type: "SYNC_SUCCESS"; result: { pushed: number; pulled: number } }
  | { type: "SYNC_ERROR"; message: string }
  | { type: "DISCONNECTED" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return { ...state, connected: action.connected, connectedAt: action.connectedAt, loading: false };
    case "SYNC_START":
      return { ...state, syncing: true, syncResult: null, syncError: null };
    case "SYNC_SUCCESS":
      return { ...state, syncing: false, syncResult: action.result };
    case "SYNC_ERROR":
      return { ...state, syncing: false, syncError: action.message };
    case "DISCONNECTED":
      return { ...state, connected: false, connectedAt: null, syncResult: null, syncError: null };
    default:
      return state;
  }
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function GoogleCalendarCard() {
  const [state, dispatch] = useReducer(reducer, {
    connected: false,
    connectedAt: null,
    syncing: false,
    syncResult: null,
    syncError: null,
    loading: true,
  });

  useEffect(() => {
    // Check connection status from server
    fetch("/api/oauth/tokens?provider=GOOGLE")
      .then((r) => r.json())
      .then((json) => {
        dispatch({
          type: "LOADED",
          connected: json.data?.connected ?? false,
          connectedAt: json.data?.connectedAt ?? null,
        });
      })
      .catch(() => dispatch({ type: "LOADED", connected: false, connectedAt: null }));

    // Migrate: if old localStorage tokens exist, push to server then delete
    try {
      const old = localStorage.getItem("google_calendar_tokens");
      if (old) {
        const parsed = JSON.parse(old);
        fetch("/api/oauth/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "GOOGLE",
            accessToken: parsed.accessToken,
            refreshToken: parsed.refreshToken,
          }),
        }).then(() => localStorage.removeItem("google_calendar_tokens"));
      }
    } catch { /* ignore migration errors */ }
  }, []);

  const handleConnect = useCallback(() => {
    window.location.href = "/api/google-calendar/auth";
  }, []);

  const handleSync = useCallback(async () => {
    dispatch({ type: "SYNC_START" });
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        dispatch({ type: "SYNC_ERROR", message: json?.error?.message ?? `동기화 실패 (${res.status})` });
        return;
      }
      dispatch({ type: "SYNC_SUCCESS", result: json.data });
    } catch {
      dispatch({ type: "SYNC_ERROR", message: "네트워크 오류가 발생했습니다." });
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    await fetch("/api/oauth/tokens?provider=GOOGLE", { method: "DELETE" }).catch(() => {});
    dispatch({ type: "DISCONNECTED" });
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Google Calendar</CardTitle>
          <Badge
            variant={state.connected ? "default" : "outline"}
            className={state.connected ? "border-transparent bg-green-500 text-white hover:bg-green-500/80" : undefined}
          >
            {state.loading ? "확인 중…" : state.connected ? "연결됨" : "미연결"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          일정을 Google Calendar와 동기화합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.connected ? (
          <>
            {state.connectedAt && (
              <p className="text-xs text-muted-foreground">
                연결일: <span className="text-foreground">{formatDateTime(state.connectedAt)}</span>
              </p>
            )}
            {state.syncResult && (
              <p className="text-xs text-green-600">
                동기화 완료 — 내보냄 {state.syncResult.pushed}개, 가져옴 {state.syncResult.pulled}개
              </p>
            )}
            {state.syncError && <p className="text-xs text-destructive">{state.syncError}</p>}
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={handleSync} disabled={state.syncing}>
                {state.syncing ? "동기화 중…" : "동기화"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                연결 해제
              </Button>
            </div>
          </>
        ) : (
          <Button variant="default" size="sm" onClick={handleConnect} disabled={state.loading}>
            Google Calendar 연결
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Run tests + build**

Run: `cd /Volumes/포터블/AXLE && npx vitest run apps/web/__tests__/api/oauth-tokens.test.ts && npx turbo build --filter=web`
Expected: Tests pass, build succeeds

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/api/oauth/tokens/route.ts apps/web/lib/crypto.ts apps/web/lib/services/oauth-tokens.ts apps/web/app/api/google-calendar/callback/route.ts apps/web/app/api/google-calendar/sync/route.ts apps/web/src/components/settings/google-calendar-card.tsx apps/web/__tests__/api/oauth-tokens.test.ts
git commit -m "WI-feat OAuth token server-side storage with AES-256-GCM encryption"
```

---

### Task 5: assignedTo → User FK Code Migration (#8)

**Files:**
- Modify: `apps/web/lib/validations/client.ts:16` (assignedTo → assignedToId)
- Modify: `apps/web/lib/validations/project.ts:36,51,65` (assignedTo → assignedToId)
- Modify: `apps/web/src/components/clients/client-form.tsx` (text input → user select)
- Modify: `apps/web/src/components/projects/project-form.tsx` (text input → user select)
- Modify: `apps/web/src/components/clients/client-table.tsx` (display assignedToUser.name)
- Modify: `apps/web/src/components/clients/client-kanban.tsx` (display assignedToUser.name)
- Modify: `apps/web/src/components/projects/project-table.tsx` (display assignedToUser.name)
- Modify: `apps/web/src/components/projects/project-kanban.tsx` (display assignedToUser.name)
- Modify: `apps/web/src/components/projects/project-overview.tsx` (display)
- Modify: `apps/web/src/components/projects/project-detail-tabs.tsx` (type)
- Modify: `apps/web/src/components/analytics/consultant-performance.tsx` (groupBy)
- Modify: `apps/web/app/(app)/clients/page.tsx` (select)
- Modify: `apps/web/app/(app)/projects/page.tsx` (select + filter)
- Modify: `apps/web/app/(app)/clients/[clientId]/edit/page.tsx` (field name)
- Modify: `apps/web/app/(app)/projects/[projectId]/page.tsx` (display)
- Modify: `apps/web/app/(app)/analytics/page.tsx` (groupBy)
- Modify: `apps/web/app/api/clients/route.ts` (field name)
- Modify: `apps/web/app/api/projects/route.ts` (field name)
- Modify: `apps/web/lib/services/project-handoff.ts` (field name)
- Modify: `apps/web/app/api/cron/doc-reminder/route.ts` (field name)
- Modify: `apps/web/app/api/cron/doc-expiry/route.ts` (field name)
- Modify: `apps/web/app/api/cron/deadline-alert/route.ts` (field name)
- Modify: `apps/web/app/api/cron/daily-digest/route.ts` (field name)
- Modify: `apps/web/__tests__/api/cron/cron-routes.test.ts` (field name)

**This task has ~70 references to update. The core change is mechanical: `assignedTo` → `assignedToId` everywhere, and include `assignedToUser: { select: { id: true, name: true, email: true } }` in Prisma queries.**

- [ ] **Step 1: Update validation schemas**

In `apps/web/lib/validations/client.ts`, change line 16:
```typescript
// Before: assignedTo: z.string().optional(),
assignedToId: z.string().optional(),
```

In `apps/web/lib/validations/project.ts`:
- Line 36: `assignedTo` → `assignedToId`
- Line 51: `assignedTo` → `assignedToId`
- Line 65: `assignedTo` → `assignedToId`

- [ ] **Step 2: Update API routes — clients**

In `apps/web/app/api/clients/route.ts`, line 61: change `assignedTo` to `assignedToId` in the Prisma create/update data.

Add `include: { assignedToUser: { select: { id: true, name: true, email: true } } }` to findMany/findUnique calls where clients are returned.

- [ ] **Step 3: Update API routes — projects**

In `apps/web/app/api/projects/route.ts`, lines 29, 37, 55: change all `assignedTo` references to `assignedToId`.

Add `assignedToUser: { select: { id: true, name: true, email: true } }` to include.

- [ ] **Step 4: Update project-handoff service**

In `apps/web/lib/services/project-handoff.ts`:
- Line 67: `data: { assignedTo: newAssignee.name ?? newAssignee.email }` → `data: { assignedToId: newAssignee.id }`

- [ ] **Step 5: Update cron routes**

Replace `assignedTo` with `assignedToId` in:
- `apps/web/app/api/cron/doc-reminder/route.ts:63-64` — `item.project.assignedToId`
- `apps/web/app/api/cron/doc-expiry/route.ts:26,34` — select and reference
- `apps/web/app/api/cron/deadline-alert/route.ts:59,62,67` — select and reference
- `apps/web/app/api/cron/daily-digest/route.ts:43` — where filter

- [ ] **Step 6: Update display components**

For each component, the pattern is:
- Change the type from `assignedTo: string | null` to `assignedToId: string | null; assignedToUser?: { name: string | null; email: string } | null`
- Change display from `{item.assignedTo}` to `{item.assignedToUser?.name ?? item.assignedToUser?.email ?? "-"}`

Files to update:
- `client-table.tsx:34,233` — type + display
- `client-kanban.tsx:14,174` — type + display
- `project-table.tsx:26,226` — type + display
- `project-kanban.tsx:15,195` — type + display
- `project-overview.tsx:34,68` — type + display
- `project-detail-tabs.tsx:21` — type

- [ ] **Step 7: Update form components**

In `client-form.tsx` and `project-form.tsx`, change the text input `assignedTo` to a select dropdown of org members:

```tsx
// Replace the text input with a select:
<div className="space-y-2">
  <Label htmlFor="assignedToId">담당자</Label>
  <select
    id="assignedToId"
    name="assignedToId"
    value={form.assignedToId}
    onChange={handleChange}
    disabled={submitting}
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
  >
    <option value="">선택 안 함</option>
    {members.map((m) => (
      <option key={m.id} value={m.id}>
        {m.name ?? m.email}
      </option>
    ))}
  </select>
</div>
```

The `members` list should be fetched from the org's Membership list (or passed as a prop from the parent page).

- [ ] **Step 8: Update analytics page**

In `apps/web/app/(app)/analytics/page.tsx`:
- Line 55: `by: ["assignedTo", "status"]` → `by: ["assignedToId", "status"]`
- Line 56: `assignedTo: { not: null }` → `assignedToId: { not: null }`
- Lines 62-68: Use `assignedToId` instead of `assignedTo`, then resolve names via a separate User query.

In `consultant-performance.tsx`:
- Line 4: `assignedTo: string` → `assignedToId: string; assignedToName: string`
- Line 34-36: display `stat.assignedToName`

- [ ] **Step 9: Update client/project pages**

- `apps/web/app/(app)/clients/page.tsx:82` — select `assignedToId: true, assignedToUser: { select: { name: true, email: true } }`
- `apps/web/app/(app)/projects/page.tsx:43,72,87,110` — same pattern
- `apps/web/app/(app)/clients/[clientId]/edit/page.tsx:36,76` — `assignedToId` field
- `apps/web/app/(app)/projects/[projectId]/page.tsx:64,104` — `assignedToId` + display

- [ ] **Step 10: Update tests**

In `apps/web/__tests__/api/cron/cron-routes.test.ts`: replace all `assignedTo: "user-1"` etc. with `assignedToId: "user-1"`.

- [ ] **Step 11: Run full lint + typecheck + build**

Run: `cd /Volumes/포터블/AXLE && npx turbo lint && npx turbo typecheck && npx turbo build`
Expected: All pass

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "WI-feat convert assignedTo to User FK with relation across all components"
```

---

### Task 6: Mobile Sidebar (#4)

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx` (responsive layout + hamburger)
- Modify: `apps/web/src/components/app-sidebar.tsx` (accept mobile sheet mode)

- [ ] **Step 1: Update layout with mobile sidebar**

Rewrite `apps/web/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@axle/auth";
import { Toaster } from "@axle/ui";
import { AppSidebar } from "../../src/components/app-sidebar";
import { UserMenu } from "../../src/components/user-menu";
import { NotificationBell } from "../../src/components/notifications/notification-bell";
import { MobileSidebar } from "../../src/components/mobile-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const userMenu = (
    <UserMenu name={user.name} email={user.email} image={user.image} />
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AppSidebar userMenu={userMenu} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4">
          {/* Mobile hamburger */}
          <div className="md:hidden">
            <MobileSidebar userMenu={userMenu} />
          </div>
          <div className="hidden md:block" />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 2: Create MobileSidebar component**

Create `apps/web/src/components/mobile-sidebar.tsx`:

```tsx
"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@axle/ui";
import { AppSidebar } from "./app-sidebar";

interface MobileSidebarProps {
  userMenu: React.ReactNode;
}

export function MobileSidebar({ userMenu }: MobileSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="메뉴 열기"
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
        >
          <Menu size={20} className="text-foreground/70" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">메뉴</SheetTitle>
        <AppSidebar userMenu={userMenu} />
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/layout.tsx apps/web/src/components/mobile-sidebar.tsx
git commit -m "WI-feat mobile sidebar with Sheet component and hamburger menu"
```

---

### Task 7: ReBAC Enhancement (#5)

**Files:**
- Create: `packages/db/src/project-access.ts`
- Modify: `packages/db/src/index.ts` (export new function)
- Modify: project-related API routes to use `checkProjectAccess`

- [ ] **Step 1: Write test for checkProjectAccess**

Create `packages/db/__tests__/project-access.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./src/client.js", () => ({
  prisma: {
    relationTuple: {
      findFirst: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "./src/client.js";

describe("checkProjectAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when user has LEAD role and LEAD is required", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      role: "LEAD",
    } as any);

    const { checkProjectAccess } = await import("./src/project-access.js");
    const result = await checkProjectAccess("user-1", "project-1", "LEAD");
    expect(result).toBe(true);
  });

  it("returns true when user has LEAD role and MEMBER is required (LEAD > MEMBER)", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      role: "LEAD",
    } as any);

    const { checkProjectAccess } = await import("./src/project-access.js");
    const result = await checkProjectAccess("user-1", "project-1", "MEMBER");
    expect(result).toBe(true);
  });

  it("returns false when user has VIEWER role and MEMBER is required", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      role: "VIEWER",
    } as any);

    const { checkProjectAccess } = await import("./src/project-access.js");
    const result = await checkProjectAccess("user-1", "project-1", "MEMBER");
    expect(result).toBe(false);
  });

  it("returns false when user is not a member", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);

    const { checkProjectAccess } = await import("./src/project-access.js");
    const result = await checkProjectAccess("user-1", "project-1", "VIEWER");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Implement checkProjectAccess**

Create `packages/db/src/project-access.ts`:

```typescript
import { prisma } from "./client.js";

type ProjectRole = "LEAD" | "MEMBER" | "VIEWER";

/** Role hierarchy: LEAD > MEMBER > VIEWER */
const ROLE_LEVEL: Record<ProjectRole, number> = {
  LEAD: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/**
 * Check whether a user has at least `requiredRole` on a project.
 *
 * Uses ProjectMember table (the source of truth for project-level access).
 * Org-level admins/owners bypass this check — callers should check org access first.
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
  requiredRole: ProjectRole,
): Promise<boolean> {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    if (!member) return false;
    return ROLE_LEVEL[member.role as ProjectRole] >= ROLE_LEVEL[requiredRole];
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Export from packages/db**

In `packages/db/src/index.ts`, add:
```typescript
export { checkProjectAccess } from "./project-access.js";
```

- [ ] **Step 4: Run tests**

Run: `cd /Volumes/포터블/AXLE/packages/db && npx vitest run __tests__/project-access.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Apply checkProjectAccess to project APIs**

In project API routes that modify project data (edit, delete, status transition), add after org boundary check:

```typescript
import { checkProjectAccess } from "@axle/db";

// After verifying orgId boundary:
const hasAccess = await checkProjectAccess(user.id, projectId, "LEAD");
if (!hasAccess) {
  // Fall back: org ADMIN/OWNER can still access
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: user.orgId } },
  });
  if (!membership || membership.role === "MEMBER") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient project permissions" } },
      { status: 403 },
    );
  }
}
```

Apply to:
- `apps/web/app/api/projects/[projectId]/route.ts` (PATCH, DELETE)
- `apps/web/app/api/projects/[projectId]/status/route.ts` (PATCH)

For sub-resource APIs (meetings, documents, action-items), use `MEMBER` as required role.

- [ ] **Step 6: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/project-access.ts packages/db/src/index.ts packages/db/__tests__/project-access.test.ts apps/web/app/api/projects/
git commit -m "WI-feat ReBAC project-level access control with role hierarchy"
```

---

### Task 8: SSE Real-time Notifications (#6)

**Files:**
- Create: `apps/web/app/api/notifications/stream/route.ts`
- Create: `apps/web/lib/notification-emitter.ts`
- Create: `apps/web/src/hooks/use-notification-stream.ts`
- Modify: `apps/web/src/components/notifications/notification-bell.tsx`

- [ ] **Step 1: Create notification event emitter**

Create `apps/web/lib/notification-emitter.ts`:

```typescript
import { EventEmitter } from "node:events";

/**
 * In-memory event emitter for SSE notification broadcasting.
 * One global instance per server process. For multi-instance deploys, swap to Redis pub/sub.
 */
class NotificationEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000); // support many concurrent SSE connections
  }

  notify(userId: string) {
    this.emit(`notify:${userId}`);
  }
}

// Singleton — survives HMR in dev via globalThis
const globalForEmitter = globalThis as typeof globalThis & {
  __notificationEmitter?: NotificationEmitter;
};

export const notificationEmitter =
  globalForEmitter.__notificationEmitter ??
  (globalForEmitter.__notificationEmitter = new NotificationEmitter());
```

- [ ] **Step 2: Create SSE stream endpoint**

Create `apps/web/app/api/notifications/stream/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { notificationEmitter } from "@/lib/notification-emitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/notifications/stream — SSE endpoint for real-time notifications
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      const onNotify = () => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "NEW_NOTIFICATION" })}\n\n`));
        } catch {
          // Stream closed
        }
      };

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      notificationEmitter.on(`notify:${userId}`, onNotify);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        notificationEmitter.off(`notify:${userId}`, onNotify);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Create useNotificationStream hook**

Create `apps/web/src/hooks/use-notification-stream.ts`:

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * SSE hook for real-time notification updates.
 * Falls back to polling on connection failure.
 */
export function useNotificationStream(onNewNotification: () => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) return;
    fallbackTimerRef.current = setInterval(onNewNotification, 30_000);
  }, [onNewNotification]);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    function connect() {
      const es = new EventSource("/api/notifications/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        retryCount = 0;
        stopFallbackPolling();
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "NEW_NOTIFICATION") {
            onNewNotification();
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        retryCount++;

        if (retryCount <= maxRetries) {
          // Retry with backoff
          setTimeout(connect, retryCount * 2000);
        } else {
          // Give up SSE, fall back to polling
          startFallbackPolling();
        }
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      stopFallbackPolling();
    };
  }, [onNewNotification, startFallbackPolling, stopFallbackPolling]);
}
```

- [ ] **Step 4: Update NotificationBell to use SSE**

In `apps/web/src/components/notifications/notification-bell.tsx`:

Add import:
```typescript
import { useNotificationStream } from "../../hooks/use-notification-stream";
```

Replace the polling useEffect (lines 165-169):

```typescript
// Before:
// useEffect(() => {
//   fetchNotifications();
//   const timer = setInterval(fetchNotifications, POLL_INTERVAL_MS);
//   return () => clearInterval(timer);
// }, [fetchNotifications]);

// After:
useEffect(() => {
  fetchNotifications();
}, [fetchNotifications]);

useNotificationStream(fetchNotifications);
```

Remove the `POLL_INTERVAL_MS` constant (line 138) — no longer needed.

- [ ] **Step 5: Wire emitter into notification creation**

Find where notifications are created (the `@axle/notification` package `create` function or wherever `prisma.notification.create` is called) and add:

```typescript
import { notificationEmitter } from "@/lib/notification-emitter";

// After creating a notification:
notificationEmitter.notify(userId);
```

This should be added to all notification creation points (cron routes, API routes that create notifications).

- [ ] **Step 6: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/notifications/stream/route.ts apps/web/lib/notification-emitter.ts apps/web/src/hooks/use-notification-stream.ts apps/web/src/components/notifications/notification-bell.tsx
git commit -m "WI-feat SSE real-time notifications with polling fallback"
```

---

### Task 9: AI Integration Enhancement (#1)

**Files:**
- Modify: `packages/ai/src/evaluation/engine.ts` (add Claude deep analysis)
- Modify: `packages/ai/src/diagnosis/gap-analyzer.ts` (add RAG + Claude analysis)

- [ ] **Step 1: Write test for Claude-enhanced evaluation**

Create `packages/ai/__tests__/evaluation-claude.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/db", () => ({
  prisma: {
    programInfo: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("../src/claude.js", () => ({
  complete: vi.fn().mockResolvedValue(
    JSON.stringify({
      improvements: ["시장 규모를 구체적 수치로 제시하세요.", "경쟁사 대비 차별점을 강조하세요."],
      detailedFeedback: "전반적으로 사업 목표가 명확하나, 시장 분석 섹션에서 TAM/SAM/SOM 수치가 부족합니다.",
    }),
  ),
}));

describe("evaluate with Claude enhancement", () => {
  it("includes AI-generated improvements when ANTHROPIC_API_KEY is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    const { evaluate } = await import("../src/evaluation/engine.js");
    const result = await evaluate({
      documentContent: "사업 목표는 AI 기반 교육 플랫폼을 구축하는 것입니다. 시장 규모는 크고 기술 차별화가 있습니다. 팀 역량이 뛰어나며 재무 계획이 적정합니다. ".repeat(20),
    });

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.grade).toBeDefined();
    // AI improvements should be appended
    expect(result.improvements.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Enhance evaluation engine with Claude**

In `packages/ai/src/evaluation/engine.ts`, modify the `evaluate` function (line 180-231):

After the rule-based scoring (line 221 `void programContext;`), add Claude enhancement:

```typescript
  // --- Claude AI deep analysis (Phase 14) ---
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { complete } = await import("../claude.js");
      const aiResponse = await complete({
        system: "You are an expert Korean government subsidy proposal reviewer. Respond in JSON format only.",
        prompt: `Analyze this business plan and provide specific improvement suggestions.
${programContext ? `Target program: ${programContext}` : ""}

Document (first 3000 chars):
${documentContent.slice(0, 3000)}

Rule-based scores:
${criteria.map((c) => `- ${c.name}: ${c.score}/10`).join("\n")}

Respond as JSON:
{
  "improvements": ["specific suggestion 1", "specific suggestion 2", ...],
  "detailedFeedback": "one paragraph of overall feedback"
}`,
        maxTokens: 1024,
      });

      const parsed = JSON.parse(aiResponse);
      if (Array.isArray(parsed.improvements)) {
        improvements.push(...parsed.improvements);
      }
      if (parsed.detailedFeedback) {
        improvements.unshift(`[AI 분석] ${parsed.detailedFeedback}`);
      }
    } catch {
      // Non-fatal: AI enhancement is optional
    }
  }
```

Remove the `void programContext;` line.

- [ ] **Step 3: Enhance gap analyzer with Claude**

In `packages/ai/src/diagnosis/gap-analyzer.ts`, in the `analyzeGaps` function (after line 375, before readiness calculation):

Replace the TODO comment (lines 367-368) with:

```typescript
  // Claude AI deep analysis for enriched gap recommendations
  if (process.env.ANTHROPIC_API_KEY && gaps.length > 0) {
    try {
      const { complete } = await import("../claude.js");
      const aiResponse = await complete({
        system: "You are an expert Korean government subsidy eligibility advisor. Respond in JSON format only.",
        prompt: `A client "${client.name}" is applying for "${program.name}".

Detected gaps:
${gaps.map((g) => `- [${g.severity}] ${g.category}: ${g.item} — ${g.description}`).join("\n")}

For each gap, provide an actionable recommendation in Korean. Respond as JSON:
{ "recommendations": { "<item>": "recommendation", ... } }`,
        maxTokens: 1024,
      });

      const parsed = JSON.parse(aiResponse);
      if (parsed.recommendations) {
        for (const gap of gaps) {
          const rec = parsed.recommendations[gap.item];
          if (rec) gap.recommendation = rec;
        }
      }
    } catch {
      // Non-fatal: AI enrichment is optional
    }
  }
```

- [ ] **Step 4: Run tests**

Run: `cd /Volumes/포터블/AXLE/packages/ai && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Verify build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=@axle/ai`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/evaluation/engine.ts packages/ai/src/diagnosis/gap-analyzer.ts packages/ai/__tests__/evaluation-claude.test.ts
git commit -m "WI-feat Claude AI deep analysis for evaluation and gap diagnosis"
```

---

## Phase C: Deploy

### Task 10: DB Push + Vercel Deploy (#2, #3)

**These steps require user action (credentials, environment access).**

- [ ] **Step 1: Add OAUTH_ENCRYPTION_KEY to .env.example**

In `.env.example`, add:
```
# OAuth Token Encryption (generate with: openssl rand -hex 32)
OAUTH_ENCRYPTION_KEY=
```

- [ ] **Step 2: DB Push (user action)**

```bash
# Verify DATABASE_URL points to Supabase Seoul
cd /Volumes/포터블/AXLE
npx prisma db push
```

Expected: Schema synced with 2 new features (OAuthToken model, assignedTo FK changes).

Note: Since `assignedTo` → `assignedToId` is a rename, Prisma may drop the old column and create a new one. Existing `assignedTo` string data will be lost (acceptable since it was free-text and DB is empty pre-launch).

- [ ] **Step 3: Verify full build passes**

```bash
cd /Volumes/포터블/AXLE
npx turbo lint && npx turbo typecheck && npx turbo build && npx turbo test
```

- [ ] **Step 4: Vercel environment variables (user action)**

Set these 18 environment variables in Vercel dashboard:
```
DATABASE_URL
DIRECT_URL
AUTH_SECRET
AUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
UPSTASH_QSTASH_TOKEN
ANTHROPIC_API_KEY
OPENAI_API_KEY
RESEND_API_KEY
SOLAPI_API_KEY
SOLAPI_API_SECRET
OAUTH_ENCRYPTION_KEY  (generate: openssl rand -hex 32)
```

- [ ] **Step 5: Deploy to Vercel**

```bash
cd /Volumes/포터블/AXLE
vercel deploy --preview
# Verify preview deployment works
vercel --prod
```

- [ ] **Step 6: Verify cron jobs**

Check `vercel.json` — 9 cron jobs should be active. Verify in Vercel dashboard under Cron Jobs tab.

- [ ] **Step 7: Commit .env.example update**

```bash
git add .env.example
git commit -m "WI-chore add OAUTH_ENCRYPTION_KEY to .env.example"
```

---

## Summary

| Task | Feature | Phase |
|------|---------|-------|
| 1 | Schema: OAuthToken + assignedTo FK | A |
| 2 | Sheet component for @axle/ui | A |
| 3 | Anthropic SDK + crypto utility | A |
| 4 | OAuth token server-side storage | B |
| 5 | assignedTo → User FK code migration | B |
| 6 | Mobile sidebar | B |
| 7 | ReBAC project-level access | B |
| 8 | SSE real-time notifications | B |
| 9 | AI integration (Claude) | B |
| 10 | DB push + Vercel deploy | C |
