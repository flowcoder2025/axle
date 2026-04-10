# AXLE Phase 4: Email & Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the email and notification infrastructure so AXLE can send transactional emails (Resend), SMS/KakaoTalk (Solapi), in-app notifications, Web Push, and Telegram alerts — with a unified event bus that maps business events to channels and recipients.

**Architecture:** Two packages (`@axle/email`, `@axle/notification`) plus an event bus in `apps/web`. Email uses Resend + @react-email for HTML templates and Solapi for SMS/Kakao AlimTalk. Notifications use in-app DB records, Web Push (VAPID), and Telegram bot. Every send is recorded in EmailLog for audit/analytics.

**Tech Stack:** Resend, @react-email/components, Solapi SDK, web-push (VAPID), node-telegram-bot-api, Zod, TypeScript 5, Vitest

**Depends on:** Phase 0 (packages/db with Notification + EmailLog models, packages/auth, apps/web scaffold)

---

## File Structure

```
axle/
├── packages/
│   ├── email/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                    # Public API exports
│   │   │   ├── client.ts                   # Resend client wrapper
│   │   │   ├── solapi.ts                   # Solapi SMS + Kakao AlimTalk
│   │   │   ├── send.ts                     # Unified send (email/sms/kakao) + EmailLog
│   │   │   ├── unsubscribe.ts              # Token generation + verification
│   │   │   └── templates/
│   │   │       ├── doc-request.tsx          # 서류 요청 메일
│   │   │       ├── meeting-summary.tsx      # 미팅 요약 메일
│   │   │       ├── estimate.tsx             # 견적서 발송
│   │   │       ├── deadline-alert.tsx       # 지원사업 마감 알림
│   │   │       ├── journal-reminder.tsx     # 연구일지 작성 리마인더
│   │   │       ├── onboarding.tsx           # 온보딩 안내
│   │   │       └── matching-digest.tsx      # 매칭 결과 다이제스트
│   │   └── tests/
│   │       ├── send.test.ts
│   │       └── unsubscribe.test.ts
│   │
│   └── notification/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                    # Public API exports
│       │   ├── crud.ts                     # Notification CRUD
│       │   ├── web-push.ts                 # VAPID key setup + subscription + send
│       │   ├── telegram.ts                 # Telegram bot sendMessage wrapper
│       │   ├── trigger-map.ts              # Event → channel → recipient mapping
│       │   ├── dispatcher.ts               # Dispatch notification to all channels
│       │   └── types.ts                    # NotificationChannel, TriggerConfig types
│       └── tests/
│           ├── crud.test.ts
│           ├── trigger-map.test.ts
│           └── dispatcher.test.ts
│
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   └── api/
│           │       ├── notifications/
│           │       │   ├── route.ts             # GET list, PATCH markAllRead
│           │       │   └── [id]/
│           │       │       └── route.ts         # PATCH markRead
│           │       ├── push/
│           │       │   └── subscribe/
│           │       │       └── route.ts         # POST push subscription
│           │       └── email/
│           │           └── unsubscribe/
│           │               └── route.ts         # GET unsubscribe handler
│           ├── lib/
│           │   └── events.ts                    # Event bus (emit/on)
│           └── components/
│               └── notification-bell.tsx         # Bell icon with unread count
```

---

## Task 1: packages/email — Resend Client & Solapi Integration

**Files:**
- Create: `packages/email/package.json`
- Create: `packages/email/tsconfig.json`
- Create: `packages/email/src/client.ts`
- Create: `packages/email/src/solapi.ts`

- [ ] **Step 1: Create packages/email/package.json**

```json
{
  "name": "@axle/email",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./templates/*": "./src/templates/*.tsx"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "resend": "^4.2.0",
    "solapi": "^2.2.0",
    "@react-email/components": "^0.0.36",
    "@axle/db": "workspace:*",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "vitest": "^4.1.0",
    "typescript": "^5.8.0",
    "@types/react": "^19.0.0",
    "react": "^19.2.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create packages/email/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create Resend client wrapper**

Create `packages/email/src/client.ts`:

```typescript
import { Resend } from "resend";

let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface SendEmailResult {
  id: string;
  error?: string;
}

const DEFAULT_FROM = "AXLE <noreply@axle.flowcoder.dev>";

/**
 * Send a single email via Resend.
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: options.from ?? DEFAULT_FROM,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    react: options.react,
    replyTo: options.replyTo,
    cc: options.cc,
    bcc: options.bcc,
  });

  if (error) {
    return { id: "", error: error.message };
  }

  return { id: data?.id ?? "" };
}

/**
 * Send batch emails via Resend (up to 100 at a time).
 */
export async function sendBatchEmail(
  emails: SendEmailOptions[]
): Promise<SendEmailResult[]> {
  const resend = getResend();

  const payload = emails.map((e) => ({
    from: e.from ?? DEFAULT_FROM,
    to: Array.isArray(e.to) ? e.to : [e.to],
    subject: e.subject,
    react: e.react,
    replyTo: e.replyTo,
  }));

  const { data, error } = await resend.batch.send(payload);

  if (error) {
    return emails.map(() => ({ id: "", error: error.message }));
  }

  return (data?.data ?? []).map((d) => ({ id: d.id }));
}
```

- [ ] **Step 4: Create Solapi integration (SMS + Kakao AlimTalk)**

Create `packages/email/src/solapi.ts`:

```typescript
import SolapiMessageService from "solapi";

let solapiInstance: SolapiMessageService | null = null;

function getSolapi(): SolapiMessageService {
  if (!solapiInstance) {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error(
        "SOLAPI_API_KEY and SOLAPI_API_SECRET environment variables are required"
      );
    }
    solapiInstance = new SolapiMessageService(apiKey, apiSecret);
  }
  return solapiInstance;
}

export interface SendSmsOptions {
  to: string;
  text: string;
  from?: string;
}

export interface SendKakaoOptions {
  to: string;
  templateId: string;
  variables: Record<string, string>;
  pfId?: string;
  from?: string;
}

const DEFAULT_SMS_FROM = process.env.SOLAPI_SENDER_PHONE ?? "";

/**
 * Send SMS via Solapi.
 */
export async function sendSms(options: SendSmsOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const solapi = getSolapi();
    await solapi.sendOne({
      to: options.to,
      from: options.from ?? DEFAULT_SMS_FROM,
      text: options.text,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMS error";
    return { success: false, error: message };
  }
}

/**
 * Send Kakao AlimTalk via Solapi.
 */
export async function sendKakaoAlimTalk(
  options: SendKakaoOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const solapi = getSolapi();
    await solapi.sendOne({
      to: options.to,
      from: options.from ?? DEFAULT_SMS_FROM,
      kakaoOptions: {
        pfId: options.pfId ?? process.env.SOLAPI_PF_ID ?? "",
        templateId: options.templateId,
        variables: options.variables,
      },
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Kakao error";
    return { success: false, error: message };
  }
}

/**
 * Multi-channel send: try Kakao AlimTalk first, fall back to SMS.
 */
export async function sendWithFallback(
  options: SendKakaoOptions & { smsText: string }
): Promise<{ channel: "kakao" | "sms"; success: boolean; error?: string }> {
  const kakaoResult = await sendKakaoAlimTalk(options);
  if (kakaoResult.success) {
    return { channel: "kakao", success: true };
  }

  // Fallback to SMS
  const smsResult = await sendSms({
    to: options.to,
    text: options.smsText,
    from: options.from,
  });

  return {
    channel: "sms",
    success: smsResult.success,
    error: smsResult.error,
  };
}
```

- [ ] **Step 5: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/email/package.json packages/email/tsconfig.json packages/email/src/client.ts packages/email/src/solapi.ts
git commit -m "feat: add packages/email with Resend client and Solapi SMS/Kakao integration"
```

---

## Task 2: packages/email — Unified Send with EmailLog Recording

**Files:**
- Create: `packages/email/src/send.ts`
- Create: `packages/email/src/unsubscribe.ts`
- Create: `packages/email/tests/send.test.ts`
- Create: `packages/email/tests/unsubscribe.test.ts`

- [ ] **Step 1: Write failing tests for send module**

Create `packages/email/tests/send.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies
const mockSendEmail = vi.fn();
const mockSendSms = vi.fn();
const mockSendKakaoAlimTalk = vi.fn();
const mockEmailLogCreate = vi.fn();

vi.mock("../src/client", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("../src/solapi", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
  sendKakaoAlimTalk: (...args: unknown[]) => mockSendKakaoAlimTalk(...args),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    emailLog: {
      create: (...args: unknown[]) => mockEmailLogCreate(...args),
    },
  },
}));

import { send } from "../src/send";

describe("send (unified)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email and records EmailLog", async () => {
    mockSendEmail.mockResolvedValue({ id: "resend-123" });
    mockEmailLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await send({
      channel: "email",
      to: "test@example.com",
      subject: "Test Subject",
      type: "DOC_REQUEST",
      react: null as unknown as React.ReactElement,
    });

    expect(result.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockEmailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        to: "test@example.com",
        subject: "Test Subject",
        type: "DOC_REQUEST",
        channel: "email",
        resendMessageId: "resend-123",
      }),
    });
  });

  it("sends SMS and records EmailLog", async () => {
    mockSendSms.mockResolvedValue({ success: true });
    mockEmailLogCreate.mockResolvedValue({ id: "log-2" });

    const result = await send({
      channel: "sms",
      to: "01012345678",
      subject: "SMS 알림",
      type: "DEADLINE_ALERT",
      smsText: "마감일이 다가옵니다.",
    });

    expect(result.success).toBe(true);
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockEmailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        to: "01012345678",
        subject: "SMS 알림",
        type: "DEADLINE_ALERT",
        channel: "sms",
      }),
    });
  });

  it("sends Kakao AlimTalk and records EmailLog", async () => {
    mockSendKakaoAlimTalk.mockResolvedValue({ success: true });
    mockEmailLogCreate.mockResolvedValue({ id: "log-3" });

    const result = await send({
      channel: "kakao",
      to: "01012345678",
      subject: "카카오 알림",
      type: "JOURNAL_REMINDER",
      kakaoTemplateId: "tmpl-001",
      kakaoVariables: { name: "홍길동" },
    });

    expect(result.success).toBe(true);
    expect(mockSendKakaoAlimTalk).toHaveBeenCalledTimes(1);
    expect(mockEmailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: "kakao",
        type: "JOURNAL_REMINDER",
      }),
    });
  });

  it("records failure in EmailLog when send fails", async () => {
    mockSendEmail.mockResolvedValue({ id: "", error: "Rate limited" });
    mockEmailLogCreate.mockResolvedValue({ id: "log-4" });

    const result = await send({
      channel: "email",
      to: "test@example.com",
      subject: "Fail Test",
      type: "DOC_REQUEST",
      react: null as unknown as React.ReactElement,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Rate limited");
    // EmailLog is still created for audit trail
    expect(mockEmailLogCreate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/email
npx vitest run tests/send.test.ts
```

Expected: FAIL — "Cannot find module '../src/send'"

- [ ] **Step 3: Implement unified send module**

Create `packages/email/src/send.ts`:

```typescript
import { prisma } from "@axle/db";
import type { EmailType } from "@axle/db";
import { sendEmail } from "./client";
import { sendSms, sendKakaoAlimTalk } from "./solapi";

export type SendChannel = "email" | "sms" | "kakao";

export interface SendOptions {
  channel: SendChannel;
  to: string;
  subject: string;
  type: EmailType;

  // Email-specific
  react?: React.ReactElement;
  from?: string;
  replyTo?: string;

  // SMS-specific
  smsText?: string;

  // Kakao-specific
  kakaoTemplateId?: string;
  kakaoVariables?: Record<string, string>;

  // Context for EmailLog
  meetingId?: string;
  clientId?: string;
  projectId?: string;
}

export interface SendResult {
  success: boolean;
  error?: string;
  logId?: string;
  resendMessageId?: string;
}

/**
 * Unified send: dispatches to the appropriate channel and records an EmailLog entry.
 * Every call creates an EmailLog regardless of success/failure (audit trail).
 */
export async function send(options: SendOptions): Promise<SendResult> {
  let resendMessageId: string | undefined;
  let success = false;
  let error: string | undefined;

  switch (options.channel) {
    case "email": {
      if (!options.react) {
        error = "React template is required for email channel";
        break;
      }
      const result = await sendEmail({
        to: options.to,
        subject: options.subject,
        react: options.react,
        from: options.from,
        replyTo: options.replyTo,
      });
      if (result.error) {
        error = result.error;
      } else {
        success = true;
        resendMessageId = result.id;
      }
      break;
    }

    case "sms": {
      if (!options.smsText) {
        error = "smsText is required for SMS channel";
        break;
      }
      const result = await sendSms({
        to: options.to,
        text: options.smsText,
      });
      success = result.success;
      error = result.error;
      break;
    }

    case "kakao": {
      if (!options.kakaoTemplateId || !options.kakaoVariables) {
        error = "kakaoTemplateId and kakaoVariables are required for Kakao channel";
        break;
      }
      const result = await sendKakaoAlimTalk({
        to: options.to,
        templateId: options.kakaoTemplateId,
        variables: options.kakaoVariables,
      });
      success = result.success;
      error = result.error;
      break;
    }
  }

  // Record EmailLog for every attempt
  const log = await prisma.emailLog.create({
    data: {
      to: options.to,
      subject: options.subject,
      type: options.type,
      channel: options.channel,
      resendMessageId: resendMessageId ?? null,
      meetingId: options.meetingId ?? null,
      clientId: options.clientId ?? null,
      projectId: options.projectId ?? null,
    },
  });

  return {
    success,
    error,
    logId: log.id,
    resendMessageId,
  };
}

/**
 * Send to multiple channels at once (e.g., email + SMS).
 */
export async function sendMultiChannel(
  optionsList: SendOptions[]
): Promise<SendResult[]> {
  return Promise.all(optionsList.map(send));
}
```

- [ ] **Step 4: Write failing tests for unsubscribe**

Create `packages/email/tests/unsubscribe.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
} from "../src/unsubscribe";

describe("unsubscribe", () => {
  const secret = "test-secret-key-for-unsubscribe-tokens";

  it("generates a valid token for an email", () => {
    const token = generateUnsubscribeToken("test@example.com", secret);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  it("verifies a valid token", () => {
    const token = generateUnsubscribeToken("test@example.com", secret);
    const result = verifyUnsubscribeToken(token, "test@example.com", secret);
    expect(result).toBe(true);
  });

  it("rejects a token for a different email", () => {
    const token = generateUnsubscribeToken("test@example.com", secret);
    const result = verifyUnsubscribeToken(token, "other@example.com", secret);
    expect(result).toBe(false);
  });

  it("rejects a tampered token", () => {
    const result = verifyUnsubscribeToken("tampered-token", "test@example.com", secret);
    expect(result).toBe(false);
  });

  it("builds a full unsubscribe URL", () => {
    const url = buildUnsubscribeUrl("test@example.com", secret, "https://axle.flowcoder.dev");
    expect(url).toContain("https://axle.flowcoder.dev/api/email/unsubscribe");
    expect(url).toContain("email=");
    expect(url).toContain("token=");
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/email
npx vitest run tests/unsubscribe.test.ts
```

Expected: FAIL — "Cannot find module '../src/unsubscribe'"

- [ ] **Step 6: Implement unsubscribe module**

Create `packages/email/src/unsubscribe.ts`:

```typescript
import { createHmac } from "crypto";

/**
 * Generate an HMAC-based unsubscribe token for an email address.
 * Token = HMAC-SHA256(email, secret) encoded as hex.
 */
export function generateUnsubscribeToken(
  email: string,
  secret: string
): string {
  return createHmac("sha256", secret).update(email).digest("hex");
}

/**
 * Verify an unsubscribe token against an email address.
 */
export function verifyUnsubscribeToken(
  token: string,
  email: string,
  secret: string
): boolean {
  const expected = generateUnsubscribeToken(email, secret);
  // Constant-time comparison to prevent timing attacks
  if (token.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Build a full unsubscribe URL with email and token query params.
 */
export function buildUnsubscribeUrl(
  email: string,
  secret: string,
  baseUrl?: string
): string {
  const base = baseUrl ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const token = generateUnsubscribeToken(email, secret);
  const params = new URLSearchParams({ email, token });
  return `${base}/api/email/unsubscribe?${params.toString()}`;
}
```

- [ ] **Step 7: Create vitest config**

Create `packages/email/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 8: Run all tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/email
npx vitest run
```

Expected: All tests PASS (send: 4/4, unsubscribe: 5/5).

- [ ] **Step 9: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/email/src/send.ts packages/email/src/unsubscribe.ts packages/email/tests/ packages/email/vitest.config.ts
git commit -m "feat: add unified send with EmailLog recording and unsubscribe token system"
```

---

## Task 3: packages/email — React Email Templates

**Files:**
- Create: `packages/email/src/templates/doc-request.tsx`
- Create: `packages/email/src/templates/meeting-summary.tsx`
- Create: `packages/email/src/templates/estimate.tsx`
- Create: `packages/email/src/templates/deadline-alert.tsx`
- Create: `packages/email/src/templates/journal-reminder.tsx`
- Create: `packages/email/src/templates/onboarding.tsx`
- Create: `packages/email/src/templates/matching-digest.tsx`

- [ ] **Step 1: Create doc-request template**

Create `packages/email/src/templates/doc-request.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface DocRequestEmailProps {
  clientName: string;
  contactName: string;
  projectTitle: string;
  documents: Array<{ name: string; description?: string; isRequired: boolean }>;
  uploadUrl: string;
  dueDate?: string;
  consultantName: string;
  unsubscribeUrl?: string;
}

export function DocRequestEmail({
  clientName,
  contactName,
  projectTitle,
  documents,
  uploadUrl,
  dueDate,
  consultantName,
  unsubscribeUrl,
}: DocRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        [{clientName}] {projectTitle} 관련 서류 요청
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>서류 제출 요청</Heading>

          <Text style={textStyle}>
            안녕하세요, {contactName}님.
          </Text>
          <Text style={textStyle}>
            {projectTitle} 진행을 위해 아래 서류를 요청드립니다.
          </Text>

          {dueDate && (
            <Text style={{ ...textStyle, color: "#dc2626", fontWeight: "bold" }}>
              제출 기한: {dueDate}
            </Text>
          )}

          <Section style={listSectionStyle}>
            {documents.map((doc, i) => (
              <Text key={i} style={listItemStyle}>
                {doc.isRequired ? "● [필수]" : "○ [선택]"} {doc.name}
                {doc.description && (
                  <span style={{ color: "#6b7280", fontSize: "13px" }}>
                    {" "}— {doc.description}
                  </span>
                )}
              </Text>
            ))}
          </Section>

          <Section style={{ textAlign: "center" as const, marginTop: "24px" }}>
            <Button href={uploadUrl} style={buttonStyle}>
              서류 업로드하기
            </Button>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerTextStyle}>
            담당 컨설턴트: {consultantName}
          </Text>
          <Text style={footerTextStyle}>
            문의사항이 있으시면 이 메일에 회신해 주세요.
          </Text>

          {unsubscribeUrl && (
            <Text style={{ ...footerTextStyle, fontSize: "11px", color: "#9ca3af" }}>
              <Link href={unsubscribeUrl}>수신 거부</Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = {
  backgroundColor: "#f9fafb",
  fontFamily: "Pretendard, -apple-system, sans-serif",
};

const containerStyle = {
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
};

const headingStyle = {
  fontSize: "20px",
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: "16px",
};

const textStyle = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#374151",
};

const listSectionStyle = {
  backgroundColor: "#f9fafb",
  borderRadius: "6px",
  padding: "16px",
  marginTop: "16px",
};

const listItemStyle = {
  fontSize: "14px",
  lineHeight: "28px",
  color: "#374151",
};

const buttonStyle = {
  backgroundColor: "#1d4ed8",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  textDecoration: "none",
};

const hrStyle = {
  borderColor: "#e5e7eb",
  marginTop: "32px",
  marginBottom: "16px",
};

const footerTextStyle = {
  fontSize: "12px",
  lineHeight: "20px",
  color: "#6b7280",
};

export default DocRequestEmail;
```

- [ ] **Step 2: Create meeting-summary template**

Create `packages/email/src/templates/meeting-summary.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface MeetingSummaryEmailProps {
  meetingTitle: string;
  meetingDate: string;
  attendees: string[];
  summary: string;
  keyDecisions: string[];
  actionItems: Array<{
    description: string;
    assignee: string;
    dueDate?: string;
  }>;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

export function MeetingSummaryEmail({
  meetingTitle,
  meetingDate,
  attendees,
  summary,
  keyDecisions,
  actionItems,
  dashboardUrl,
  unsubscribeUrl,
}: MeetingSummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        미팅 요약: {meetingTitle} ({meetingDate})
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>미팅 요약</Heading>

          <Text style={metaStyle}>
            {meetingTitle} | {meetingDate}
          </Text>
          <Text style={metaStyle}>
            참석자: {attendees.join(", ")}
          </Text>

          <Section style={sectionStyle}>
            <Text style={sectionTitleStyle}>요약</Text>
            <Text style={textStyle}>{summary}</Text>
          </Section>

          {keyDecisions.length > 0 && (
            <Section style={sectionStyle}>
              <Text style={sectionTitleStyle}>주요 결정 사항</Text>
              {keyDecisions.map((decision, i) => (
                <Text key={i} style={listItemStyle}>
                  • {decision}
                </Text>
              ))}
            </Section>
          )}

          {actionItems.length > 0 && (
            <Section style={sectionStyle}>
              <Text style={sectionTitleStyle}>액션 아이템</Text>
              {actionItems.map((item, i) => (
                <Text key={i} style={listItemStyle}>
                  □ {item.description} — {item.assignee}
                  {item.dueDate ? ` (기한: ${item.dueDate})` : ""}
                </Text>
              ))}
            </Section>
          )}

          <Hr style={hrStyle} />

          <Text style={footerTextStyle}>
            <Link href={dashboardUrl}>AXLE에서 전체 내용 보기</Link>
          </Text>

          {unsubscribeUrl && (
            <Text style={{ ...footerTextStyle, fontSize: "11px", color: "#9ca3af" }}>
              <Link href={unsubscribeUrl}>수신 거부</Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = {
  backgroundColor: "#f9fafb",
  fontFamily: "Pretendard, -apple-system, sans-serif",
};

const containerStyle = {
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
};

const headingStyle = {
  fontSize: "20px",
  fontWeight: "700" as const,
  color: "#111827",
};

const metaStyle = {
  fontSize: "13px",
  color: "#6b7280",
  lineHeight: "20px",
};

const sectionStyle = {
  marginTop: "20px",
};

const sectionTitleStyle = {
  fontSize: "15px",
  fontWeight: "600" as const,
  color: "#111827",
  marginBottom: "8px",
};

const textStyle = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#374151",
};

const listItemStyle = {
  fontSize: "14px",
  lineHeight: "28px",
  color: "#374151",
};

const hrStyle = {
  borderColor: "#e5e7eb",
  marginTop: "32px",
  marginBottom: "16px",
};

const footerTextStyle = {
  fontSize: "12px",
  lineHeight: "20px",
  color: "#6b7280",
};

export default MeetingSummaryEmail;
```

- [ ] **Step 3: Create estimate template**

Create `packages/email/src/templates/estimate.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface EstimateEmailProps {
  clientName: string;
  contactName: string;
  estimateNumber: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; amount: number }>;
  totalAmount: number;
  taxAmount: number;
  validUntil: string;
  downloadUrl: string;
  consultantName: string;
  unsubscribeUrl?: string;
}

export function EstimateEmail({
  clientName,
  contactName,
  estimateNumber,
  items,
  totalAmount,
  taxAmount,
  validUntil,
  downloadUrl,
  consultantName,
  unsubscribeUrl,
}: EstimateEmailProps) {
  const formatKrw = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(n) + "원";

  return (
    <Html>
      <Head />
      <Preview>
        [{clientName}] 견적서 #{estimateNumber}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>견적서 발송</Heading>

          <Text style={textStyle}>
            {contactName}님, 안녕하세요.
          </Text>
          <Text style={textStyle}>
            아래와 같이 견적서를 보내드립니다.
          </Text>

          <Text style={metaStyle}>
            견적번호: {estimateNumber} | 유효기한: {validUntil}
          </Text>

          <Section style={tableContainerStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr>
                  <th style={thStyle}>항목</th>
                  <th style={{ ...thStyle, textAlign: "right" as const }}>수량</th>
                  <th style={{ ...thStyle, textAlign: "right" as const }}>단가</th>
                  <th style={{ ...thStyle, textAlign: "right" as const }}>금액</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{item.name}</td>
                    <td style={{ ...tdStyle, textAlign: "right" as const }}>{item.quantity}</td>
                    <td style={{ ...tdStyle, textAlign: "right" as const }}>{formatKrw(item.unitPrice)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" as const }}>{formatKrw(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, fontWeight: "600" as const }}>공급가액</td>
                  <td style={{ ...tdStyle, textAlign: "right" as const, fontWeight: "600" as const }}>
                    {formatKrw(totalAmount)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={tdStyle}>부가세</td>
                  <td style={{ ...tdStyle, textAlign: "right" as const }}>{formatKrw(taxAmount)}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, fontWeight: "700" as const, fontSize: "15px" }}>합계</td>
                  <td style={{ ...tdStyle, textAlign: "right" as const, fontWeight: "700" as const, fontSize: "15px" }}>
                    {formatKrw(totalAmount + taxAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Section>

          <Section style={{ textAlign: "center" as const, marginTop: "24px" }}>
            <Button href={downloadUrl} style={buttonStyle}>
              견적서 다운로드
            </Button>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerTextStyle}>
            담당: {consultantName} | 문의사항은 이 메일에 회신해 주세요.
          </Text>

          {unsubscribeUrl && (
            <Text style={{ ...footerTextStyle, fontSize: "11px", color: "#9ca3af" }}>
              <Link href={unsubscribeUrl}>수신 거부</Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: "#f9fafb", fontFamily: "Pretendard, -apple-system, sans-serif" };
const containerStyle = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "8px" };
const headingStyle = { fontSize: "20px", fontWeight: "700" as const, color: "#111827" };
const textStyle = { fontSize: "14px", lineHeight: "24px", color: "#374151" };
const metaStyle = { fontSize: "13px", color: "#6b7280" };
const tableContainerStyle = { marginTop: "20px", border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "hidden" as const };
const thStyle = { backgroundColor: "#f9fafb", padding: "8px 12px", fontSize: "12px", fontWeight: "600" as const, color: "#6b7280", textAlign: "left" as const, borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "8px 12px", fontSize: "13px", color: "#374151", borderBottom: "1px solid #f3f4f6" };
const buttonStyle = { backgroundColor: "#1d4ed8", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: "600" as const, padding: "12px 24px", textDecoration: "none" };
const hrStyle = { borderColor: "#e5e7eb", marginTop: "32px", marginBottom: "16px" };
const footerTextStyle = { fontSize: "12px", lineHeight: "20px", color: "#6b7280" };

export default EstimateEmail;
```

- [ ] **Step 4: Create deadline-alert template**

Create `packages/email/src/templates/deadline-alert.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface DeadlineAlertEmailProps {
  recipientName: string;
  deadlines: Array<{
    programName: string;
    clientName: string;
    dueDate: string;
    daysRemaining: number;
    projectUrl: string;
  }>;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

export function DeadlineAlertEmail({
  recipientName,
  deadlines,
  dashboardUrl,
  unsubscribeUrl,
}: DeadlineAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        마감 임박: {deadlines.length}건의 지원사업 마감일이 다가옵니다
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>마감일 알림</Heading>

          <Text style={textStyle}>
            {recipientName}님, 다음 지원사업의 마감일이 임박합니다.
          </Text>

          {deadlines.map((d, i) => (
            <Section key={i} style={cardStyle}>
              <Text style={cardTitleStyle}>
                {d.daysRemaining <= 3 ? "🔴" : d.daysRemaining <= 7 ? "🟡" : "🟢"}{" "}
                D-{d.daysRemaining} | {d.programName}
              </Text>
              <Text style={cardMetaStyle}>
                고객사: {d.clientName} | 마감일: {d.dueDate}
              </Text>
              <Link href={d.projectUrl} style={cardLinkStyle}>
                프로젝트 보기 →
              </Link>
            </Section>
          ))}

          <Hr style={hrStyle} />

          <Text style={footerTextStyle}>
            <Link href={dashboardUrl}>AXLE 대시보드에서 전체 일정 확인</Link>
          </Text>

          {unsubscribeUrl && (
            <Text style={{ ...footerTextStyle, fontSize: "11px", color: "#9ca3af" }}>
              <Link href={unsubscribeUrl}>수신 거부</Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: "#f9fafb", fontFamily: "Pretendard, -apple-system, sans-serif" };
const containerStyle = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "8px" };
const headingStyle = { fontSize: "20px", fontWeight: "700" as const, color: "#111827" };
const textStyle = { fontSize: "14px", lineHeight: "24px", color: "#374151" };
const cardStyle = { backgroundColor: "#f9fafb", borderRadius: "6px", padding: "16px", marginTop: "12px", border: "1px solid #e5e7eb" };
const cardTitleStyle = { fontSize: "15px", fontWeight: "600" as const, color: "#111827", margin: "0 0 4px" };
const cardMetaStyle = { fontSize: "13px", color: "#6b7280", margin: "0 0 8px" };
const cardLinkStyle = { fontSize: "13px", color: "#1d4ed8" };
const hrStyle = { borderColor: "#e5e7eb", marginTop: "32px", marginBottom: "16px" };
const footerTextStyle = { fontSize: "12px", lineHeight: "20px", color: "#6b7280" };

export default DeadlineAlertEmail;
```

- [ ] **Step 5: Create journal-reminder template**

Create `packages/email/src/templates/journal-reminder.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface JournalReminderEmailProps {
  researcherName: string;
  clientName: string;
  month: string;
  writeUrl: string;
  previousJournalTitle?: string;
  unsubscribeUrl?: string;
}

export function JournalReminderEmail({
  researcherName,
  clientName,
  month,
  writeUrl,
  previousJournalTitle,
  unsubscribeUrl,
}: JournalReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        [{clientName}] {month} 연구일지 작성 안내
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>연구일지 작성 안내</Heading>

          <Text style={textStyle}>
            {researcherName} 연구원님, 안녕하세요.
          </Text>
          <Text style={textStyle}>
            {month} 연구일지 작성 기한이 다가오고 있습니다. 아래 링크에서 작성해 주세요.
          </Text>

          {previousJournalTitle && (
            <Section style={infoBoxStyle}>
              <Text style={{ ...textStyle, fontSize: "13px", color: "#6b7280" }}>
                지난 일지: {previousJournalTitle}
              </Text>
            </Section>
          )}

          <Section style={{ textAlign: "center" as const, marginTop: "24px" }}>
            <Button href={writeUrl} style={buttonStyle}>
              연구일지 작성하기
            </Button>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerTextStyle}>
            {clientName} 기업부설연구소
          </Text>

          {unsubscribeUrl && (
            <Text style={{ ...footerTextStyle, fontSize: "11px", color: "#9ca3af" }}>
              <Link href={unsubscribeUrl}>수신 거부</Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: "#f9fafb", fontFamily: "Pretendard, -apple-system, sans-serif" };
const containerStyle = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "8px" };
const headingStyle = { fontSize: "20px", fontWeight: "700" as const, color: "#111827" };
const textStyle = { fontSize: "14px", lineHeight: "24px", color: "#374151" };
const infoBoxStyle = { backgroundColor: "#f9fafb", borderRadius: "6px", padding: "12px 16px", marginTop: "16px" };
const buttonStyle = { backgroundColor: "#1d4ed8", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: "600" as const, padding: "12px 24px", textDecoration: "none" };
const hrStyle = { borderColor: "#e5e7eb", marginTop: "32px", marginBottom: "16px" };
const footerTextStyle = { fontSize: "12px", lineHeight: "20px", color: "#6b7280" };

export default JournalReminderEmail;
```

- [ ] **Step 6: Create onboarding template**

Create `packages/email/src/templates/onboarding.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface OnboardingEmailProps {
  contactName: string;
  clientName: string;
  consultantName: string;
  checklist: Array<{ name: string; description?: string }>;
  uploadUrl: string;
  unsubscribeUrl?: string;
}

export function OnboardingEmail({
  contactName,
  clientName,
  consultantName,
  checklist,
  uploadUrl,
  unsubscribeUrl,
}: OnboardingEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        [{clientName}] 컨설팅 시작 안내
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>컨설팅 시작을 환영합니다</Heading>

          <Text style={textStyle}>
            {contactName}님, 안녕하세요.
          </Text>
          <Text style={textStyle}>
            {clientName}의 컨설팅 업무가 시작되었습니다.
            원활한 진행을 위해 아래 기본 서류를 먼저 준비해 주시면 감사하겠습니다.
          </Text>

          <Section style={listSectionStyle}>
            <Text style={sectionTitleStyle}>준비 서류</Text>
            {checklist.map((item, i) => (
              <Text key={i} style={listItemStyle}>
                □ {item.name}
                {item.description && (
                  <span style={{ color: "#6b7280", fontSize: "12px" }}>
                    {" "}— {item.description}
                  </span>
                )}
              </Text>
            ))}
          </Section>

          <Section style={{ textAlign: "center" as const, marginTop: "24px" }}>
            <Button href={uploadUrl} style={buttonStyle}>
              서류 업로드하기
            </Button>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerTextStyle}>
            담당 컨설턴트: {consultantName}
          </Text>
          <Text style={footerTextStyle}>
            궁금한 사항은 언제든 이 메일에 회신해 주세요.
          </Text>

          {unsubscribeUrl && (
            <Text style={{ ...footerTextStyle, fontSize: "11px", color: "#9ca3af" }}>
              <Link href={unsubscribeUrl}>수신 거부</Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: "#f9fafb", fontFamily: "Pretendard, -apple-system, sans-serif" };
const containerStyle = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "8px" };
const headingStyle = { fontSize: "20px", fontWeight: "700" as const, color: "#111827" };
const textStyle = { fontSize: "14px", lineHeight: "24px", color: "#374151" };
const listSectionStyle = { backgroundColor: "#f9fafb", borderRadius: "6px", padding: "16px", marginTop: "16px" };
const sectionTitleStyle = { fontSize: "15px", fontWeight: "600" as const, color: "#111827", marginBottom: "8px" };
const listItemStyle = { fontSize: "14px", lineHeight: "28px", color: "#374151" };
const buttonStyle = { backgroundColor: "#1d4ed8", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: "600" as const, padding: "12px 24px", textDecoration: "none" };
const hrStyle = { borderColor: "#e5e7eb", marginTop: "32px", marginBottom: "16px" };
const footerTextStyle = { fontSize: "12px", lineHeight: "20px", color: "#6b7280" };

export default OnboardingEmail;
```

- [ ] **Step 7: Create matching-digest template**

Create `packages/email/src/templates/matching-digest.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface MatchingDigestEmailProps {
  recipientName: string;
  date: string;
  matches: Array<{
    clientName: string;
    programName: string;
    score: number;
    topReasons: string[];
    matchUrl: string;
  }>;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

export function MatchingDigestEmail({
  recipientName,
  date,
  matches,
  dashboardUrl,
  unsubscribeUrl,
}: MatchingDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        매칭 다이제스트: {matches.length}건의 새 추천 ({date})
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>매칭 다이제스트</Heading>

          <Text style={textStyle}>
            {recipientName}님, {date} 기준 새로운 매칭 추천 {matches.length}건이 있습니다.
          </Text>

          {matches.map((match, i) => (
            <Section key={i} style={cardStyle}>
              <Text style={cardTitleStyle}>
                {match.clientName} ↔ {match.programName}
              </Text>
              <Text style={scoreStyle}>
                매칭 점수: {match.score}점
              </Text>
              {match.topReasons.map((reason, j) => (
                <Text key={j} style={reasonStyle}>
                  ✓ {reason}
                </Text>
              ))}
              <Link href={match.matchUrl} style={cardLinkStyle}>
                상세 보기 →
              </Link>
            </Section>
          ))}

          <Hr style={hrStyle} />

          <Text style={footerTextStyle}>
            <Link href={dashboardUrl}>AXLE에서 모든 매칭 결과 보기</Link>
          </Text>

          {unsubscribeUrl && (
            <Text style={{ ...footerTextStyle, fontSize: "11px", color: "#9ca3af" }}>
              <Link href={unsubscribeUrl}>수신 거부</Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: "#f9fafb", fontFamily: "Pretendard, -apple-system, sans-serif" };
const containerStyle = { margin: "0 auto", padding: "32px 24px", maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "8px" };
const headingStyle = { fontSize: "20px", fontWeight: "700" as const, color: "#111827" };
const textStyle = { fontSize: "14px", lineHeight: "24px", color: "#374151" };
const cardStyle = { backgroundColor: "#f9fafb", borderRadius: "6px", padding: "16px", marginTop: "12px", border: "1px solid #e5e7eb" };
const cardTitleStyle = { fontSize: "15px", fontWeight: "600" as const, color: "#111827", margin: "0 0 4px" };
const scoreStyle = { fontSize: "13px", fontWeight: "600" as const, color: "#1d4ed8", margin: "0 0 8px" };
const reasonStyle = { fontSize: "13px", color: "#374151", lineHeight: "22px", margin: "0" };
const cardLinkStyle = { fontSize: "13px", color: "#1d4ed8", display: "inline-block", marginTop: "8px" };
const hrStyle = { borderColor: "#e5e7eb", marginTop: "32px", marginBottom: "16px" };
const footerTextStyle = { fontSize: "12px", lineHeight: "20px", color: "#6b7280" };

export default MatchingDigestEmail;
```

- [ ] **Step 8: Create public API exports**

Create `packages/email/src/index.ts`:

```typescript
// Client
export { sendEmail, sendBatchEmail, type SendEmailOptions, type SendEmailResult } from "./client";

// Solapi
export { sendSms, sendKakaoAlimTalk, sendWithFallback } from "./solapi";
export type { SendSmsOptions, SendKakaoOptions } from "./solapi";

// Unified send
export { send, sendMultiChannel, type SendOptions, type SendResult, type SendChannel } from "./send";

// Unsubscribe
export {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
} from "./unsubscribe";

// Templates (re-export for convenience)
export { DocRequestEmail } from "./templates/doc-request";
export { MeetingSummaryEmail } from "./templates/meeting-summary";
export { EstimateEmail } from "./templates/estimate";
export { DeadlineAlertEmail } from "./templates/deadline-alert";
export { JournalReminderEmail } from "./templates/journal-reminder";
export { OnboardingEmail } from "./templates/onboarding";
export { MatchingDigestEmail } from "./templates/matching-digest";
```

- [ ] **Step 9: Install dependencies and run tests**

```bash
cd /Volumes/포터블/AX/axle
npm install
cd packages/email
npx vitest run
```

Expected: All tests pass (send: 4/4, unsubscribe: 5/5).

- [ ] **Step 10: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/email/
git commit -m "feat: add 7 React Email templates, unified send, and public exports for packages/email"
```

---

## Task 4: packages/notification — CRUD & Types

**Files:**
- Create: `packages/notification/package.json`
- Create: `packages/notification/tsconfig.json`
- Create: `packages/notification/src/types.ts`
- Create: `packages/notification/src/crud.ts`
- Create: `packages/notification/tests/crud.test.ts`

- [ ] **Step 1: Create packages/notification/package.json**

```json
{
  "name": "@axle/notification",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./crud": "./src/crud.ts",
    "./web-push": "./src/web-push.ts",
    "./telegram": "./src/telegram.ts",
    "./dispatcher": "./src/dispatcher.ts",
    "./trigger-map": "./src/trigger-map.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@axle/db": "workspace:*",
    "@axle/email": "workspace:*",
    "web-push": "^3.7.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/web-push": "^3.6.4",
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/notification/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create notification types**

Create `packages/notification/src/types.ts`:

```typescript
import type { NotificationType } from "@axle/db";

export type NotificationChannel = "in_app" | "email" | "sms" | "kakao" | "push" | "telegram";

export interface TriggerConfig {
  event: NotificationType;
  channels: NotificationChannel[];
  recipientType: RecipientType;
  /** Human-readable description of the trigger */
  description: string;
}

export type RecipientType =
  | "assigned_consultant"
  | "client_contact"
  | "project_lead"
  | "meeting_attendees_internal"
  | "researcher_contact"
  | "assigned_member"
  | "handoff_target";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Context IDs for EmailLog and notification routing */
  meetingId?: string;
  clientId?: string;
  projectId?: string;
  /** Specific user IDs to notify (overrides recipientType lookup) */
  recipientUserIds?: string[];
  /** Contact emails for external notifications (SMS/email/kakao) */
  recipientContacts?: Array<{
    name: string;
    email?: string;
    phone?: string;
  }>;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationSetting {
  userId: string;
  channels: Record<NotificationChannel, boolean>;
}
```

- [ ] **Step 4: Write failing tests for CRUD**

Create `packages/notification/tests/crud.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
} from "../src/crud";

describe("Notification CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotification", () => {
    it("creates a notification for a user", async () => {
      mockCreate.mockResolvedValue({
        id: "notif-1",
        userId: "user-1",
        type: "DOC_UPLOADED",
        title: "서류 업로드 완료",
        isRead: false,
      });

      const result = await createNotification({
        userId: "user-1",
        type: "DOC_UPLOADED",
        title: "서류 업로드 완료",
        body: "사업자등록증이 업로드되었습니다.",
        link: "/projects/proj-1",
      });

      expect(result.id).toBe("notif-1");
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "DOC_UPLOADED",
          title: "서류 업로드 완료",
          body: "사업자등록증이 업로드되었습니다.",
          link: "/projects/proj-1",
        },
      });
    });
  });

  describe("listNotifications", () => {
    it("returns paginated notifications for a user", async () => {
      mockFindMany.mockResolvedValue([
        { id: "notif-1", type: "DOC_UPLOADED", title: "Test", isRead: false },
        { id: "notif-2", type: "DEADLINE", title: "마감", isRead: true },
      ]);

      const result = await listNotifications("user-1", { limit: 20, offset: 0 });

      expect(result).toHaveLength(2);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 0,
      });
    });
  });

  describe("markRead", () => {
    it("marks a single notification as read", async () => {
      mockUpdate.mockResolvedValue({ id: "notif-1", isRead: true });

      await markRead("notif-1", "user-1");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: { isRead: true },
      });
    });
  });

  describe("markAllRead", () => {
    it("marks all unread notifications as read for a user", async () => {
      mockUpdateMany.mockResolvedValue({ count: 5 });

      const result = await markAllRead("user-1");

      expect(result).toBe(5);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe("getUnreadCount", () => {
    it("returns the count of unread notifications", async () => {
      mockCount.mockResolvedValue(3);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(3);
      expect(mockCount).toHaveBeenCalledWith({
        where: { userId: "user-1", isRead: false },
      });
    });
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/notification
npx vitest run tests/crud.test.ts
```

Expected: FAIL — "Cannot find module '../src/crud'"

- [ ] **Step 6: Implement Notification CRUD**

Create `packages/notification/src/crud.ts`:

```typescript
import { prisma, type NotificationType } from "@axle/db";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Create a new in-app notification.
 */
export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    },
  });
}

/**
 * List notifications for a user with pagination.
 */
export async function listNotifications(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 20, offset = 0 } = options;

  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

/**
 * Mark a single notification as read.
 */
export async function markRead(notificationId: string, userId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/**
 * Mark all unread notifications as read for a user.
 * Returns the number of notifications marked.
 */
export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return result.count;
}

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
```

- [ ] **Step 7: Create vitest config**

Create `packages/notification/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/notification
npx vitest run tests/crud.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/notification/package.json packages/notification/tsconfig.json packages/notification/src/types.ts packages/notification/src/crud.ts packages/notification/tests/crud.test.ts packages/notification/vitest.config.ts
git commit -m "feat: add packages/notification with CRUD operations and type definitions"
```

---

## Task 5: packages/notification — Web Push & Telegram

**Files:**
- Create: `packages/notification/src/web-push.ts`
- Create: `packages/notification/src/telegram.ts`

- [ ] **Step 1: Create Web Push module**

Create `packages/notification/src/web-push.ts`:

```typescript
import webPush from "web-push";
import type { PushSubscription } from "./types";

let isConfigured = false;

/**
 * Configure web-push with VAPID keys.
 * Call once at server startup.
 */
export function configureWebPush(): void {
  if (isConfigured) return;

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@axle.flowcoder.dev";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[web-push] VAPID keys not configured. Web Push disabled.");
    return;
  }

  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  isConfigured = true;
}

/**
 * Generate VAPID keys (run once, store in env).
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const keys = webPush.generateVAPIDKeys();
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
}

/**
 * Send a push notification to a subscribed client.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body?: string; url?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured) {
    configureWebPush();
  }

  if (!isConfigured) {
    return { success: false, error: "VAPID keys not configured" };
  }

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body ?? "",
        data: { url: payload.url },
      })
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Push notification failed";
    return { success: false, error: message };
  }
}

/**
 * Get the VAPID public key for the client-side subscription flow.
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}
```

- [ ] **Step 2: Create Telegram notification channel**

Create `packages/notification/src/telegram.ts`:

```typescript
export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

let defaultConfig: TelegramConfig | null = null;

/**
 * Initialize default Telegram config from environment variables.
 */
function getConfig(): TelegramConfig | null {
  if (defaultConfig) return defaultConfig;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return null;
  }

  defaultConfig = { botToken, chatId };
  return defaultConfig;
}

/**
 * Send a message via Telegram Bot API.
 */
export async function sendTelegramMessage(
  text: string,
  config?: Partial<TelegramConfig>
): Promise<{ success: boolean; error?: string }> {
  const cfg = { ...getConfig(), ...config } as TelegramConfig;

  if (!cfg.botToken || !cfg.chatId) {
    return {
      success: false,
      error: "Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)",
    };
  }

  try {
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: `Telegram API error: ${errorData.description ?? response.statusText}`,
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Telegram send failed";
    return { success: false, error: message };
  }
}

/**
 * Format a notification as a Telegram message.
 */
export function formatTelegramNotification(
  title: string,
  body?: string,
  link?: string
): string {
  let text = `<b>${escapeHtml(title)}</b>`;
  if (body) {
    text += `\n${escapeHtml(body)}`;
  }
  if (link) {
    text += `\n\n<a href="${link}">AXLE에서 보기</a>`;
  }
  return text;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/notification/src/web-push.ts packages/notification/src/telegram.ts
git commit -m "feat: add Web Push (VAPID) and Telegram notification channels"
```

---

## Task 6: packages/notification — Trigger Map & Dispatcher

**Files:**
- Create: `packages/notification/src/trigger-map.ts`
- Create: `packages/notification/src/dispatcher.ts`
- Create: `packages/notification/tests/trigger-map.test.ts`
- Create: `packages/notification/tests/dispatcher.test.ts`

- [ ] **Step 1: Write failing tests for trigger map**

Create `packages/notification/tests/trigger-map.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getTriggerConfig, TRIGGER_MAP } from "../src/trigger-map";

describe("Trigger Map", () => {
  it("has a config for every NotificationType", () => {
    const expectedTypes = [
      "DOC_REQUESTED",
      "DOC_UPLOADED",
      "DOC_EXPIRING",
      "DEADLINE",
      "MEETING",
      "JOURNAL_DUE",
      "ACTION_ITEM",
      "PROJECT_ASSIGNED",
      "MATCHING_RESULT",
      "AI_JOB_COMPLETE",
      "AI_JOB_FAILED",
      "PORTAL_COMPLETE",
      "HANDOFF",
    ];

    for (const type of expectedTypes) {
      const config = getTriggerConfig(type as any);
      expect(config).toBeDefined();
      expect(config!.channels.length).toBeGreaterThan(0);
    }
  });

  it("DOC_UPLOADED triggers in_app + email to assigned_consultant", () => {
    const config = getTriggerConfig("DOC_UPLOADED");
    expect(config).toBeDefined();
    expect(config!.channels).toContain("in_app");
    expect(config!.channels).toContain("email");
    expect(config!.recipientType).toBe("assigned_consultant");
  });

  it("DEADLINE triggers in_app + telegram to assigned_consultant", () => {
    const config = getTriggerConfig("DEADLINE");
    expect(config).toBeDefined();
    expect(config!.channels).toContain("in_app");
    expect(config!.channels).toContain("telegram");
    expect(config!.recipientType).toBe("assigned_consultant");
  });

  it("JOURNAL_DUE triggers email + sms to researcher_contact", () => {
    const config = getTriggerConfig("JOURNAL_DUE");
    expect(config).toBeDefined();
    expect(config!.channels).toContain("email");
    expect(config!.channels).toContain("sms");
    expect(config!.recipientType).toBe("researcher_contact");
  });

  it("HANDOFF triggers email + in_app to handoff_target", () => {
    const config = getTriggerConfig("HANDOFF");
    expect(config).toBeDefined();
    expect(config!.channels).toContain("email");
    expect(config!.channels).toContain("in_app");
    expect(config!.recipientType).toBe("handoff_target");
  });

  it("returns all 13 trigger configs", () => {
    expect(TRIGGER_MAP.length).toBe(13);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/notification
npx vitest run tests/trigger-map.test.ts
```

Expected: FAIL — "Cannot find module '../src/trigger-map'"

- [ ] **Step 3: Implement trigger map**

Create `packages/notification/src/trigger-map.ts`:

```typescript
import type { NotificationType } from "@axle/db";
import type { TriggerConfig, NotificationChannel, RecipientType } from "./types";

/**
 * Notification Trigger Map — maps business events to channels and recipients.
 * Based on section 4.12 of the AXLE design spec.
 */
export const TRIGGER_MAP: TriggerConfig[] = [
  {
    event: "DOC_REQUESTED",
    channels: ["email", "sms"],
    recipientType: "client_contact",
    description: "서류 미제출 D-3 리마인더",
  },
  {
    event: "DOC_UPLOADED",
    channels: ["in_app", "email"],
    recipientType: "assigned_consultant",
    description: "서류 업로드 완료 알림",
  },
  {
    event: "DOC_EXPIRING",
    channels: ["in_app"],
    recipientType: "assigned_consultant",
    description: "서류 만료 D-30/D-7 알림",
  },
  {
    event: "DEADLINE",
    channels: ["in_app", "telegram"],
    recipientType: "assigned_consultant",
    description: "지원사업 마감 D-30~D-1 알림",
  },
  {
    event: "MEETING",
    channels: ["in_app"],
    recipientType: "meeting_attendees_internal",
    description: "미팅 요약 생성 완료 알림",
  },
  {
    event: "JOURNAL_DUE",
    channels: ["email", "sms"],
    recipientType: "researcher_contact",
    description: "연구일지 작성 리마인더",
  },
  {
    event: "ACTION_ITEM",
    channels: ["in_app"],
    recipientType: "assigned_member",
    description: "액션아이템 마감 D-1 알림",
  },
  {
    event: "PROJECT_ASSIGNED",
    channels: ["in_app", "email"],
    recipientType: "assigned_member",
    description: "프로젝트 배정 알림",
  },
  {
    event: "MATCHING_RESULT",
    channels: ["in_app"],
    recipientType: "assigned_consultant",
    description: "매칭 결과 (새 추천) — 일일 다이제스트",
  },
  {
    event: "AI_JOB_COMPLETE",
    channels: ["in_app", "telegram"],
    recipientType: "assigned_consultant",
    description: "AI 작업 완료 알림",
  },
  {
    event: "AI_JOB_FAILED",
    channels: ["in_app", "telegram"],
    recipientType: "assigned_consultant",
    description: "AI 작업 실패 알림",
  },
  {
    event: "PORTAL_COMPLETE",
    channels: ["in_app", "telegram"],
    recipientType: "assigned_consultant",
    description: "포털 서류 등록 완료/실패 알림",
  },
  {
    event: "HANDOFF",
    channels: ["email", "in_app"],
    recipientType: "handoff_target",
    description: "핸드오프 — 인수자에게 알림",
  },
];

/**
 * Look up the trigger config for a notification type.
 */
export function getTriggerConfig(
  type: NotificationType
): TriggerConfig | undefined {
  return TRIGGER_MAP.find((t) => t.event === type);
}

/**
 * Get all channels for a given event type.
 */
export function getChannelsForEvent(
  type: NotificationType
): NotificationChannel[] {
  const config = getTriggerConfig(type);
  return config?.channels ?? ["in_app"];
}

/**
 * Get recipient type for a given event type.
 */
export function getRecipientType(
  type: NotificationType
): RecipientType | undefined {
  const config = getTriggerConfig(type);
  return config?.recipientType;
}
```

- [ ] **Step 4: Write failing tests for dispatcher**

Create `packages/notification/tests/dispatcher.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreateNotification = vi.fn();
const mockSendPushNotification = vi.fn();
const mockSendTelegramMessage = vi.fn();
const mockSend = vi.fn();

vi.mock("../src/crud", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

vi.mock("../src/web-push", () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}));

vi.mock("../src/telegram", () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegramMessage(...args),
  formatTelegramNotification: (title: string, body?: string) => `${title}: ${body ?? ""}`,
}));

vi.mock("@axle/email", () => ({
  send: (...args: unknown[]) => mockSend(...args),
}));

import { dispatch } from "../src/dispatcher";

describe("Notification Dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotification.mockResolvedValue({ id: "notif-1" });
    mockSendPushNotification.mockResolvedValue({ success: true });
    mockSendTelegramMessage.mockResolvedValue({ success: true });
    mockSend.mockResolvedValue({ success: true });
  });

  it("creates in-app notification for DOC_UPLOADED", async () => {
    await dispatch({
      type: "DOC_UPLOADED",
      title: "서류 업로드 완료",
      body: "사업자등록증이 업로드되었습니다.",
      link: "/projects/proj-1",
      recipientUserIds: ["user-1"],
    });

    expect(mockCreateNotification).toHaveBeenCalledWith({
      userId: "user-1",
      type: "DOC_UPLOADED",
      title: "서류 업로드 완료",
      body: "사업자등록증이 업로드되었습니다.",
      link: "/projects/proj-1",
    });
  });

  it("sends telegram for AI_JOB_COMPLETE", async () => {
    await dispatch({
      type: "AI_JOB_COMPLETE",
      title: "AI 작업 완료",
      body: "사업계획서 초안이 생성되었습니다.",
      recipientUserIds: ["user-1"],
    });

    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
  });

  it("dispatches to multiple users", async () => {
    await dispatch({
      type: "PROJECT_ASSIGNED",
      title: "프로젝트 배정",
      recipientUserIds: ["user-1", "user-2"],
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
  });

  it("skips channels when no recipients are provided for that channel", async () => {
    // JOURNAL_DUE triggers email+sms to researcher_contact (external)
    // With no recipientContacts, email/sms should be skipped
    await dispatch({
      type: "JOURNAL_DUE",
      title: "연구일지 작성 안내",
      recipientUserIds: [], // No internal users
      recipientContacts: [], // No external contacts
    });

    // No notifications should be created
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/notification
npx vitest run tests/dispatcher.test.ts
```

Expected: FAIL — "Cannot find module '../src/dispatcher'"

- [ ] **Step 6: Implement dispatcher**

Create `packages/notification/src/dispatcher.ts`:

```typescript
import type { NotificationType } from "@axle/db";
import { createNotification } from "./crud";
import { sendPushNotification } from "./web-push";
import {
  sendTelegramMessage,
  formatTelegramNotification,
} from "./telegram";
import { send as sendEmail } from "@axle/email";
import { getTriggerConfig } from "./trigger-map";
import type { NotificationPayload, NotificationChannel } from "./types";

export interface DispatchResult {
  channelResults: Array<{
    channel: NotificationChannel;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Dispatch a notification through all configured channels for the event type.
 * Looks up the trigger map, then sends through each channel.
 */
export async function dispatch(
  payload: NotificationPayload
): Promise<DispatchResult> {
  const config = getTriggerConfig(payload.type);
  if (!config) {
    return { channelResults: [] };
  }

  const results: DispatchResult["channelResults"] = [];

  for (const channel of config.channels) {
    try {
      switch (channel) {
        case "in_app": {
          // Create in-app notification for each recipient user
          const userIds = payload.recipientUserIds ?? [];
          for (const userId of userIds) {
            await createNotification({
              userId,
              type: payload.type,
              title: payload.title,
              body: payload.body,
              link: payload.link,
            });
          }
          if (userIds.length > 0) {
            results.push({ channel: "in_app", success: true });
          }
          break;
        }

        case "email": {
          // Send email to external contacts
          const contacts = payload.recipientContacts ?? [];
          for (const contact of contacts) {
            if (contact.email) {
              await sendEmail({
                channel: "email",
                to: contact.email,
                subject: payload.title,
                type: mapToEmailType(payload.type),
                // Note: actual react template should be resolved based on type
                // For now, we pass a simple subject-only email
                react: undefined as unknown as React.ReactElement,
                clientId: payload.clientId,
                projectId: payload.projectId,
                meetingId: payload.meetingId,
              });
            }
          }
          if (contacts.some((c) => c.email)) {
            results.push({ channel: "email", success: true });
          }
          break;
        }

        case "sms": {
          const contacts = payload.recipientContacts ?? [];
          for (const contact of contacts) {
            if (contact.phone) {
              await sendEmail({
                channel: "sms",
                to: contact.phone,
                subject: payload.title,
                type: mapToEmailType(payload.type),
                smsText: `[AXLE] ${payload.title}${payload.body ? ` - ${payload.body}` : ""}`,
              });
            }
          }
          if (contacts.some((c) => c.phone)) {
            results.push({ channel: "sms", success: true });
          }
          break;
        }

        case "kakao": {
          const contacts = payload.recipientContacts ?? [];
          for (const contact of contacts) {
            if (contact.phone) {
              await sendEmail({
                channel: "kakao",
                to: contact.phone,
                subject: payload.title,
                type: mapToEmailType(payload.type),
                kakaoTemplateId: `axle-${payload.type.toLowerCase().replace(/_/g, "-")}`,
                kakaoVariables: {
                  title: payload.title,
                  body: payload.body ?? "",
                  name: contact.name,
                },
                smsText: `[AXLE] ${payload.title}`,
              });
            }
          }
          if (contacts.some((c) => c.phone)) {
            results.push({ channel: "kakao", success: true });
          }
          break;
        }

        case "telegram": {
          const text = formatTelegramNotification(
            payload.title,
            payload.body,
            payload.link
          );
          const result = await sendTelegramMessage(text);
          results.push({
            channel: "telegram",
            success: result.success,
            error: result.error,
          });
          break;
        }

        case "push": {
          // Push notifications require subscription data from the user's browser
          // This is handled separately via the push subscription API
          results.push({ channel: "push", success: true });
          break;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      results.push({ channel, success: false, error });
    }
  }

  return { channelResults: results };
}

/**
 * Map NotificationType to EmailType for EmailLog recording.
 */
function mapToEmailType(type: NotificationType): import("@axle/db").EmailType {
  const mapping: Partial<Record<string, string>> = {
    DOC_REQUESTED: "DOC_REQUEST",
    DOC_UPLOADED: "DOC_PUSH",
    MEETING: "MEETING_SUMMARY",
    JOURNAL_DUE: "JOURNAL_REMINDER",
    DEADLINE: "DEADLINE_ALERT",
    MATCHING_RESULT: "MATCHING_DIGEST",
    HANDOFF: "ONBOARDING",
  };
  return (mapping[type] ?? "DOC_REQUEST") as import("@axle/db").EmailType;
}
```

- [ ] **Step 7: Run all tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/notification
npx vitest run
```

Expected: All tests PASS (crud: 5/5, trigger-map: 5/5, dispatcher: 4/4).

- [ ] **Step 8: Create public API exports**

Create `packages/notification/src/index.ts`:

```typescript
// CRUD
export {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  type CreateNotificationInput,
} from "./crud";

// Trigger map
export {
  TRIGGER_MAP,
  getTriggerConfig,
  getChannelsForEvent,
  getRecipientType,
} from "./trigger-map";

// Dispatcher
export { dispatch, type DispatchResult } from "./dispatcher";

// Web Push
export {
  configureWebPush,
  generateVapidKeys,
  sendPushNotification,
  getVapidPublicKey,
} from "./web-push";

// Telegram
export {
  sendTelegramMessage,
  formatTelegramNotification,
} from "./telegram";

// Types
export type {
  NotificationChannel,
  TriggerConfig,
  RecipientType,
  NotificationPayload,
  PushSubscription,
  NotificationSetting,
} from "./types";
```

- [ ] **Step 9: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/notification/
git commit -m "feat: add trigger map (13 events) and multi-channel dispatcher for packages/notification"
```

---

## Task 7: apps/web — Event Bus & Notification API Routes

**Files:**
- Create: `apps/web/src/lib/events.ts`
- Create: `apps/web/src/app/api/notifications/route.ts`
- Create: `apps/web/src/app/api/notifications/[id]/route.ts`
- Create: `apps/web/src/app/api/push/subscribe/route.ts`
- Create: `apps/web/src/app/api/email/unsubscribe/route.ts`

- [ ] **Step 1: Create event bus (from FlowCoder_Dashboard lib/events/ pattern)**

Create `apps/web/src/lib/events.ts`:

```typescript
type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface EventBus {
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void;
  off(event: string, handler: EventHandler): void;
  emit<T = unknown>(event: string, payload: T): Promise<void>;
}

const handlers = new Map<string, Set<EventHandler>>();

/**
 * Simple in-process event bus for triggering notifications from business events.
 *
 * Usage:
 *   eventBus.on("doc.uploaded", async (payload) => {
 *     await dispatch({ type: "DOC_UPLOADED", ... });
 *   });
 *
 *   await eventBus.emit("doc.uploaded", { documentId, clientId });
 */
export const eventBus: EventBus = {
  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      handlers.get(event)?.delete(handler as EventHandler);
    };
  },

  off(event: string, handler: EventHandler): void {
    handlers.get(event)?.delete(handler);
  },

  async emit<T>(event: string, payload: T): Promise<void> {
    const eventHandlers = handlers.get(event);
    if (!eventHandlers) return;

    const promises: Promise<void>[] = [];
    for (const handler of eventHandlers) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (err) {
        console.error(`[eventBus] Error in handler for "${event}":`, err);
      }
    }

    // Wait for all async handlers
    await Promise.allSettled(promises);
  },
};

// Pre-defined event names (type-safe convenience)
export const EVENTS = {
  DOC_UPLOADED: "doc.uploaded",
  DOC_REQUESTED: "doc.requested",
  DOC_EXPIRING: "doc.expiring",
  DEADLINE_APPROACHING: "deadline.approaching",
  MEETING_SUMMARY_READY: "meeting.summary.ready",
  JOURNAL_DUE: "journal.due",
  ACTION_ITEM_DUE: "action-item.due",
  PROJECT_ASSIGNED: "project.assigned",
  MATCHING_NEW: "matching.new",
  AI_JOB_COMPLETE: "ai-job.complete",
  AI_JOB_FAILED: "ai-job.failed",
  PORTAL_COMPLETE: "portal.complete",
  HANDOFF: "handoff",
} as const;
```

- [ ] **Step 2: Create notifications list + markAllRead API route**

Create `apps/web/src/app/api/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@axle/auth/dal";
import { listNotifications, markAllRead, getUnreadCount } from "@axle/notification";

export async function GET(req: NextRequest) {
  const user = await getVerifiedUser();
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id, { limit, offset }),
    getUnreadCount(user.id),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH() {
  const user = await getVerifiedUser();
  const count = await markAllRead(user.id);
  return NextResponse.json({ markedRead: count });
}
```

- [ ] **Step 3: Create single notification markRead API route**

Create `apps/web/src/app/api/notifications/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@axle/auth/dal";
import { markRead } from "@axle/notification";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser();
  const { id } = await params;
  await markRead(id, user.id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create push subscription API route**

Create `apps/web/src/app/api/push/subscribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@axle/auth/dal";
import { z } from "zod";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// In production, store subscriptions in the database.
// For now, we log it and acknowledge.
export async function POST(req: NextRequest) {
  const user = await getVerifiedUser();
  const body = await req.json();

  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid subscription", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // TODO: Store subscription in PushSubscription table (Phase 4 follow-up)
  // For now, log the subscription
  console.log(
    `[push] Subscription registered for user ${user.id}:`,
    parsed.data.endpoint.substring(0, 50) + "..."
  );

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Create unsubscribe handler API route**

Create `apps/web/src/app/api/email/unsubscribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@axle/email";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");

  if (!email || !token) {
    return new NextResponse("잘못된 요청입니다.", { status: 400 });
  }

  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const isValid = verifyUnsubscribeToken(token, email, secret);

  if (!isValid) {
    return new NextResponse("유효하지 않은 링크입니다.", { status: 403 });
  }

  // TODO: Record unsubscribe preference in database
  // For now, return a confirmation page
  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="ko">
    <head><meta charset="utf-8"><title>수신 거부</title></head>
    <body style="font-family: Pretendard, sans-serif; text-align: center; padding: 60px;">
      <h1>수신 거부 완료</h1>
      <p>${email} 주소에 대한 메일 수신이 거부되었습니다.</p>
      <p style="color: #6b7280; font-size: 14px;">설정 변경은 AXLE 대시보드에서 가능합니다.</p>
    </body>
    </html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/events.ts apps/web/src/app/api/notifications/ apps/web/src/app/api/push/ apps/web/src/app/api/email/
git commit -m "feat: add event bus, notification API routes, push subscription, and unsubscribe handler"
```

---

## Task 8: apps/web — Notification Bell Component

**Files:**
- Create: `apps/web/src/components/notification-bell.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Create notification bell component**

Create `apps/web/src/components/notification-bell.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@axle/ui/button";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Silently fail — notification fetch is non-critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
    } catch {
      // Silently fail
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
    setIsOpen(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return "방금";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}일 전`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label={`알림 ${unreadCount}건`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">알림</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleMarkAllRead}
                >
                  모두 읽음
                </Button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  알림이 없습니다
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full border-b px-4 py-3 text-left hover:bg-accent ${
                      !notif.isRead ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {notif.body}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatTime(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add NotificationBell to app layout header**

Modify `apps/web/src/app/(app)/layout.tsx` to add the notification bell next to the UserMenu:

```tsx
import { getVerifiedUser } from "@axle/auth/dal";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getVerifiedUser();

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-2 border-b px-6">
          <NotificationBell />
          <UserMenu user={user} />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/notification-bell.tsx apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat: add notification bell component with unread count and dropdown"
```

---

## Task 9: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify Turborepo build with new packages**

```bash
cd /Volumes/포터블/AX/axle
npx turbo build
```

Expected: All packages and apps build without errors.

- [ ] **Step 2: Run all tests across packages**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test
```

Expected: All tests pass:
- packages/db: 6/6
- packages/email: 9/9 (send: 4, unsubscribe: 5)
- packages/notification: 14/14 (crud: 5, trigger-map: 5, dispatcher: 4)

- [ ] **Step 3: Verify TypeScript types resolve across packages**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors. Imports from @axle/email, @axle/notification all resolve.

- [ ] **Step 4: Verify dev server starts with new components**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected: Next.js dev server starts. Notification bell renders in the header. API routes respond.

- [ ] **Step 5: Add .env.local entries for Phase 4**

Append to `axle/.env.local`:

```env
# Resend (email)
RESEND_API_KEY=""

# Solapi (SMS + Kakao)
SOLAPI_API_KEY=""
SOLAPI_API_SECRET=""
SOLAPI_SENDER_PHONE=""
SOLAPI_PF_ID=""

# Web Push (VAPID)
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:admin@axle.flowcoder.dev"

# Telegram
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# Unsubscribe
UNSUBSCRIBE_SECRET=""
```
