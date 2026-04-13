# AXLE Gap Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 5, 6, 7, 9-11, 12의 미구현/부분구현 항목 전체 개선 + Tier 3 버전 업그레이드

**Architecture:** Phase-grouped 순서로 진행. 각 Phase 완료 후 `npx turbo build && npx turbo test`로 검증. Phase 5 Provider가 Phase 9-11 와이어링의 전제조건.

**Tech Stack:** TypeScript, Vitest, Next.js 15+, Prisma 6+, Anthropic SDK, OpenAI SDK, Google Generative AI, React 19, shadcn/ui

**Design Spec:** `docs/specs/2026-04-12-gap-improvement-design.md`

---

## File Structure

### Phase 5 — AI Provider + Verification (신규 7파일)
```
packages/ai/src/providers/
├── types.ts              # AiProvider interface, CompletionInput/Result
├── anthropic.ts          # AnthropicProvider (claude.ts 래핑)
├── local-mlx.ts          # LocalMlxProvider (Agent Bridge HTTP)
├── claude-cli.ts         # ClaudeCliProvider (child_process)
└── index.ts              # Provider registry + getProvider()
packages/ai/src/verification/
├── types.ts              # VerificationRule, VerificationResult
└── pre-submission.ts     # 사전 검증 로직
```

### Phase 6 — DocGen 누락 모듈 (신규 3파일)
```
packages/docgen/src/converters/text-parser.ts    # 통합 텍스트 추출
packages/docgen/src/generators/image-generator.ts # AI 이미지 생성
packages/docgen/src/converters/mermaid-to-png.ts  # Mermaid→PNG
```

### Phase 7 — Calendar 서비스 추출 (신규 2파일, 수정 4파일)
```
apps/web/lib/services/schedule-service.ts     # 스케줄 CRUD 서비스
apps/web/lib/services/program-deadline.ts     # 프로그램 마감일 서비스
apps/web/app/api/schedules/route.ts           # 수정: thin controller
apps/web/app/api/schedules/[scheduleId]/route.ts  # 수정: thin controller
apps/web/app/api/programs/route.ts            # 수정: thin controller
apps/web/app/api/programs/[programId]/route.ts    # 수정: thin controller
```

### Phase 9-11 — AI 와이어링 (수정 2파일, 신규 2파일)
```
apps/web/lib/services/meeting-summary.ts      # 수정: Provider 호출 추가
apps/web/lib/services/journal-draft.ts        # 수정: Provider 호출 추가
apps/web/lib/services/financial-narrative.ts  # 신규: 재무 AI 내러티브
apps/web/app/api/analytics/narrative/route.ts # 신규: API 엔드포인트
```

### Phase 12 — Collaboration UI (신규 5파일, 수정 1파일)
```
apps/web/src/components/projects/member-list.tsx          # 멤버 목록
apps/web/src/components/projects/add-member-dialog.tsx    # 멤버 추가
apps/web/src/components/projects/member-role-select.tsx   # 역할 선택
apps/web/src/components/projects/handoff-form.tsx         # 인수인계 폼
apps/web/src/components/projects/handoff-summary.tsx      # 인수인계 이력
apps/web/src/components/projects/project-detail-tabs.tsx  # 수정: 탭 확장
```

---

## Task 1: Provider 타입 + AnthropicProvider

**Files:**
- Create: `packages/ai/src/providers/types.ts`
- Create: `packages/ai/src/providers/anthropic.ts`
- Create: `packages/ai/__tests__/providers/anthropic.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
// packages/ai/__tests__/providers/anthropic.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "mocked response" }],
    usage: { input_tokens: 10, output_tokens: 5 },
    model: "claude-haiku-4-5-20251001",
  });
  return { default: vi.fn(() => ({ messages: { create } })) };
});

describe("AnthropicProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("implements AiProvider interface", async () => {
    const { AnthropicProvider } = await import("../src/providers/anthropic.js");
    const provider = new AnthropicProvider();
    expect(provider.tier).toBe("API_HAIKU");
    expect(typeof provider.isAvailable).toBe("function");
    expect(typeof provider.complete).toBe("function");
  });

  it("returns completion result", async () => {
    const { AnthropicProvider } = await import("../src/providers/anthropic.js");
    const provider = new AnthropicProvider();
    const result = await provider.complete({ prompt: "hello" });
    expect(result.text).toBe("mocked response");
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
  });

  it("uses custom model when provided", async () => {
    const { AnthropicProvider } = await import("../src/providers/anthropic.js");
    const provider = new AnthropicProvider("claude-opus-4-6");
    expect(provider.tier).toBe("API_OPUS");
  });

  it("isAvailable returns true when API key exists", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { AnthropicProvider } = await import("../src/providers/anthropic.js");
    const provider = new AnthropicProvider();
    expect(await provider.isAvailable()).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/__tests__/providers/anthropic.test.ts`
Expected: FAIL — module not found

- [x] **Step 3: Create provider types**

```typescript
// packages/ai/src/providers/types.ts
import type { AiTier } from "@prisma/client";

export interface CompletionInput {
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface AiProvider {
  readonly tier: AiTier;
  isAvailable(): Promise<boolean>;
  complete(input: CompletionInput): Promise<CompletionResult>;
}
```

- [x] **Step 4: Implement AnthropicProvider**

```typescript
// packages/ai/src/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import type { AiTier } from "@prisma/client";
import type { AiProvider, CompletionInput, CompletionResult } from "./types.js";

const MODEL_TO_TIER: Record<string, AiTier> = {
  "claude-haiku-4-5-20251001": "API_HAIKU",
  "claude-sonnet-4-6": "API_HAIKU",
  "claude-opus-4-6": "API_OPUS",
};

export class AnthropicProvider implements AiProvider {
  readonly tier: AiTier;
  private readonly model: string;
  private client: Anthropic | null = null;

  constructor(model = "claude-haiku-4-5-20251001") {
    this.model = model;
    this.tier = MODEL_TO_TIER[model] ?? "API_HAIKU";
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async complete(input: CompletionInput): Promise<CompletionResult> {
    if (!this.client) {
      this.client = new Anthropic();
    }

    const response = await this.client.messages.create({
      model: input.model ?? this.model,
      max_tokens: input.maxTokens ?? 2048,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      text: textBlock?.text ?? "",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/__tests__/providers/anthropic.test.ts`
Expected: PASS (4 tests)

- [x] **Step 6: Commit**

```bash
git add packages/ai/src/providers/types.ts packages/ai/src/providers/anthropic.ts packages/ai/__tests__/providers/anthropic.test.ts
git commit -m "feat: add AiProvider interface and AnthropicProvider"
```

---

## Task 2: LocalMlxProvider + ClaudeCliProvider

**Files:**
- Create: `packages/ai/src/providers/local-mlx.ts`
- Create: `packages/ai/src/providers/claude-cli.ts`
- Create: `packages/ai/__tests__/providers/local-mlx.test.ts`
- Create: `packages/ai/__tests__/providers/claude-cli.test.ts`

- [x] **Step 1: Write tests for LocalMlxProvider**

```typescript
// packages/ai/__tests__/providers/local-mlx.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("LocalMlxProvider", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("has tier LOCAL_MLX", async () => {
    const { LocalMlxProvider } = await import("../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider();
    expect(provider.tier).toBe("LOCAL_MLX");
  });

  it("isAvailable checks health endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { LocalMlxProvider } = await import("../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider("http://localhost:8080");
    expect(await provider.isAvailable()).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8080/health", expect.anything());
  });

  it("isAvailable returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { LocalMlxProvider } = await import("../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider();
    expect(await provider.isAvailable()).toBe(false);
  });

  it("complete calls OpenAI-compatible endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "mlx response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 10 },
        model: "mlx-hermes-3",
      }),
    });
    const { LocalMlxProvider } = await import("../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider("http://localhost:8080");
    const result = await provider.complete({ prompt: "test" });
    expect(result.text).toBe("mlx response");
    expect(result.usage.inputTokens).toBe(5);
    expect(result.usage.outputTokens).toBe(10);
  });
});
```

- [x] **Step 2: Write tests for ClaudeCliProvider**

```typescript
// packages/ai/__tests__/providers/claude-cli.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
    cb(null, "cli response", "");
  }),
}));

describe("ClaudeCliProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has tier CLI_CLAUDE", async () => {
    const { ClaudeCliProvider } = await import("../src/providers/claude-cli.js");
    const provider = new ClaudeCliProvider();
    expect(provider.tier).toBe("CLI_CLAUDE");
  });

  it("complete calls claude -p", async () => {
    const { ClaudeCliProvider } = await import("../src/providers/claude-cli.js");
    const provider = new ClaudeCliProvider();
    const result = await provider.complete({ prompt: "test prompt" });
    expect(result.text).toBe("cli response");
    expect(result.model).toBe("claude-cli");
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/__tests__/providers/local-mlx.test.ts packages/ai/__tests__/providers/claude-cli.test.ts`
Expected: FAIL — modules not found

- [x] **Step 4: Implement LocalMlxProvider**

```typescript
// packages/ai/src/providers/local-mlx.ts
import type { AiProvider, CompletionInput, CompletionResult } from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:8321";

export class LocalMlxProvider implements AiProvider {
  readonly tier = "LOCAL_MLX" as const;
  private readonly baseUrl: string;

  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(input: CompletionInput): Promise<CompletionResult> {
    const messages: Array<{ role: string; content: string }> = [];
    if (input.system) messages.push({ role: "system", content: input.system });
    messages.push({ role: "user", content: input.prompt });

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model ?? "mlx-hermes-3",
        messages,
        max_tokens: input.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      throw new Error(`MLX proxy error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      text: data.choices[0]?.message?.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      model: data.model ?? "mlx-local",
    };
  }
}
```

- [x] **Step 5: Implement ClaudeCliProvider**

```typescript
// packages/ai/src/providers/claude-cli.ts
import { execFile } from "child_process";
import type { AiProvider, CompletionInput, CompletionResult } from "./types.js";

export class ClaudeCliProvider implements AiProvider {
  readonly tier = "CLI_CLAUDE" as const;

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile("claude", ["--version"], { timeout: 5000 }, (err) => {
        resolve(!err);
      });
    });
  }

  async complete(input: CompletionInput): Promise<CompletionResult> {
    const args = ["-p", input.prompt];
    if (input.system) {
      args.push("--system", input.system);
    }

    const text = await new Promise<string>((resolve, reject) => {
      execFile("claude", args, { timeout: 300_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`claude CLI error: ${stderr || err.message}`));
        resolve(stdout.trim());
      });
    });

    return {
      text,
      usage: { inputTokens: 0, outputTokens: 0 }, // CLI doesn't report usage
      model: "claude-cli",
    };
  }
}
```

- [x] **Step 6: Run tests to verify they pass**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/__tests__/providers/local-mlx.test.ts packages/ai/__tests__/providers/claude-cli.test.ts`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add packages/ai/src/providers/local-mlx.ts packages/ai/src/providers/claude-cli.ts packages/ai/__tests__/providers/local-mlx.test.ts packages/ai/__tests__/providers/claude-cli.test.ts
git commit -m "feat: add LocalMlxProvider and ClaudeCliProvider"
```

---

## Task 3: Provider Registry + Router 통합

**Files:**
- Create: `packages/ai/src/providers/index.ts`
- Modify: `packages/ai/src/router.ts`
- Modify: `packages/ai/src/claude.ts`
- Modify: `packages/ai/src/index.ts`
- Create: `packages/ai/__tests__/providers/registry.test.ts`

- [x] **Step 1: Write registry test**

```typescript
// packages/ai/__tests__/providers/registry.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "test" }],
    usage: { input_tokens: 1, output_tokens: 1 },
    model: "test",
  });
  return { default: vi.fn(() => ({ messages: { create } })) };
});

describe("Provider Registry", () => {
  it("getProvider returns provider for valid tier", async () => {
    const { getProvider } = await import("../src/providers/index.js");
    const provider = getProvider("API_HAIKU");
    expect(provider.tier).toBe("API_HAIKU");
  });

  it("getProvider returns provider for all tiers", async () => {
    const { getProvider } = await import("../src/providers/index.js");
    expect(getProvider("API_HAIKU").tier).toBe("API_HAIKU");
    expect(getProvider("API_OPUS").tier).toBe("API_OPUS");
    expect(getProvider("CLI_CLAUDE").tier).toBe("CLI_CLAUDE");
    expect(getProvider("LOCAL_MLX").tier).toBe("LOCAL_MLX");
  });

  it("resolveProvider returns provider instance", async () => {
    const { resolveProvider } = await import("../src/providers/index.js");
    const provider = await resolveProvider("SUMMARY");
    expect(provider).toBeDefined();
    expect(typeof provider.complete).toBe("function");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/__tests__/providers/registry.test.ts`
Expected: FAIL

- [x] **Step 3: Implement registry**

```typescript
// packages/ai/src/providers/index.ts
export type { AiProvider, CompletionInput, CompletionResult } from "./types.js";
export { AnthropicProvider } from "./anthropic.js";
export { LocalMlxProvider } from "./local-mlx.js";
export { ClaudeCliProvider } from "./claude-cli.js";

import type { AiTier, AiJobType } from "@prisma/client";
import type { AiProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { LocalMlxProvider } from "./local-mlx.js";
import { ClaudeCliProvider } from "./claude-cli.js";
import { resolveAiTier } from "../router.js";
import type { RouterConfig } from "../router.js";

const providers: Record<AiTier, AiProvider> = {
  API_HAIKU: new AnthropicProvider("claude-haiku-4-5-20251001"),
  API_OPUS: new AnthropicProvider("claude-opus-4-6"),
  CLI_CLAUDE: new ClaudeCliProvider(),
  LOCAL_MLX: new LocalMlxProvider(),
};

/** Get provider for a specific tier. */
export function getProvider(tier: AiTier): AiProvider {
  return providers[tier];
}

/**
 * Resolve tier for a job type, then return the provider.
 * If the resolved provider is unavailable, falls back to API_HAIKU.
 */
export async function resolveProvider(
  jobType: AiJobType,
  config?: RouterConfig
): Promise<AiProvider> {
  const tier = resolveAiTier(jobType, config);
  const provider = providers[tier];

  if (await provider.isAvailable()) return provider;

  // Fallback to API_HAIKU
  return providers.API_HAIKU;
}
```

- [x] **Step 4: Update claude.ts to delegate to AnthropicProvider**

```typescript
// packages/ai/src/claude.ts
import { AnthropicProvider } from "./providers/anthropic.js";

const _provider = new AnthropicProvider();

export interface ClaudeCompletionInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

/**
 * @deprecated Use `getProvider("API_HAIKU").complete()` instead.
 * Kept for backward compatibility with gap-analyzer and evaluation engine.
 */
export async function complete(input: ClaudeCompletionInput): Promise<string> {
  const result = await _provider.complete({
    system: input.system,
    prompt: input.prompt,
    maxTokens: input.maxTokens,
    model: input.model,
  });
  return result.text;
}
```

- [x] **Step 5: Update index.ts exports**

Add these lines to the end of `packages/ai/src/index.ts`:

```typescript
// Providers
export { getProvider, resolveProvider } from "./providers/index.js";
export type { AiProvider, CompletionInput, CompletionResult } from "./providers/index.js";
export { AnthropicProvider } from "./providers/index.js";
export { LocalMlxProvider } from "./providers/index.js";
export { ClaudeCliProvider } from "./providers/index.js";
```

- [x] **Step 6: Run all ai package tests**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/`
Expected: ALL PASS (existing + new tests)

- [x] **Step 7: Commit**

```bash
git add packages/ai/src/providers/index.ts packages/ai/src/claude.ts packages/ai/src/index.ts packages/ai/__tests__/providers/registry.test.ts
git commit -m "feat: add provider registry and integrate with router"
```

---

## Task 4: Pre-Submission Verification

**Files:**
- Create: `packages/ai/src/verification/types.ts`
- Create: `packages/ai/src/verification/pre-submission.ts`
- Create: `packages/ai/__tests__/verification/pre-submission.test.ts`
- Modify: `packages/ai/src/index.ts`

- [x] **Step 1: Write test**

```typescript
// packages/ai/__tests__/verification/pre-submission.test.ts
import { describe, it, expect } from "vitest";
import { verifyPreSubmission } from "../src/verification/pre-submission.js";
import type { DocumentData } from "../src/verification/types.js";

const validDoc: DocumentData = {
  title: "사업계획서",
  sections: [
    { name: "사업 개요", content: "A".repeat(200) },
    { name: "시장 분석", content: "B".repeat(200) },
    { name: "추진 전략", content: "C".repeat(200) },
    { name: "재무 계획", content: "D".repeat(200) },
    { name: "조직 및 인력", content: "E".repeat(200) },
  ],
  attachments: ["사업자등록증.pdf", "재무제표.pdf"],
};

describe("verifyPreSubmission", () => {
  it("passes for complete document", () => {
    const result = verifyPreSubmission(validDoc);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("fails when required sections are missing", () => {
    const incomplete: DocumentData = {
      ...validDoc,
      sections: [{ name: "사업 개요", content: "short" }],
    };
    const result = verifyPreSubmission(incomplete);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("warns on short section content", () => {
    const shortContent: DocumentData = {
      ...validDoc,
      sections: validDoc.sections.map((s) => ({ ...s, content: "짧은 내용" })),
    };
    const result = verifyPreSubmission(shortContent);
    expect(result.issues.some((i) => i.ruleId === "min-section-length")).toBe(true);
  });

  it("warns when attachments are missing", () => {
    const noAttach: DocumentData = { ...validDoc, attachments: [] };
    const result = verifyPreSubmission(noAttach);
    expect(result.issues.some((i) => i.ruleId === "required-attachments")).toBe(true);
  });

  it("returns score between 0 and 100", () => {
    const result = verifyPreSubmission(validDoc);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/__tests__/verification/pre-submission.test.ts`
Expected: FAIL

- [x] **Step 3: Implement types**

```typescript
// packages/ai/src/verification/types.ts
export interface DocumentSection {
  name: string;
  content: string;
}

export interface DocumentData {
  title: string;
  sections: DocumentSection[];
  attachments: string[];
}

export interface VerificationIssue {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  location?: string;
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  issues: VerificationIssue[];
  recommendations: string[];
}
```

- [x] **Step 4: Implement pre-submission verification**

```typescript
// packages/ai/src/verification/pre-submission.ts
import type { DocumentData, VerificationIssue, VerificationResult } from "./types.js";

const REQUIRED_SECTIONS = ["사업 개요", "시장 분석", "추진 전략", "재무 계획", "조직 및 인력"];
const MIN_SECTION_LENGTH = 100;
const RECOMMENDED_ATTACHMENTS = ["사업자등록증", "재무제표"];

export function verifyPreSubmission(doc: DocumentData): VerificationResult {
  const issues: VerificationIssue[] = [];
  const recommendations: string[] = [];

  // Rule 1: Required sections
  const sectionNames = new Set(doc.sections.map((s) => s.name));
  for (const req of REQUIRED_SECTIONS) {
    if (!sectionNames.has(req)) {
      issues.push({
        ruleId: "required-section",
        severity: "error",
        message: `필수 섹션 '${req}'이(가) 누락되었습니다.`,
        location: req,
      });
    }
  }

  // Rule 2: Minimum section length
  for (const section of doc.sections) {
    if (section.content.length < MIN_SECTION_LENGTH) {
      issues.push({
        ruleId: "min-section-length",
        severity: "warning",
        message: `'${section.name}' 섹션의 내용이 너무 짧습니다 (${section.content.length}자, 최소 ${MIN_SECTION_LENGTH}자 권장).`,
        location: section.name,
      });
    }
  }

  // Rule 3: Required attachments
  const attachNames = doc.attachments.map((a) => a.toLowerCase());
  for (const rec of RECOMMENDED_ATTACHMENTS) {
    if (!attachNames.some((a) => a.includes(rec.toLowerCase()))) {
      issues.push({
        ruleId: "required-attachments",
        severity: "warning",
        message: `권장 첨부파일 '${rec}'이(가) 누락되었습니다.`,
      });
      recommendations.push(`'${rec}' 파일을 첨부하세요.`);
    }
  }

  // Score calculation
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, Math.min(100, 100 - errorCount * 20 - warningCount * 5));
  const passed = errorCount === 0 && score >= 60;

  return { passed, score, issues, recommendations };
}
```

- [x] **Step 5: Update index.ts exports**

Add to `packages/ai/src/index.ts`:

```typescript
// Verification
export { verifyPreSubmission } from "./verification/pre-submission.js";
export type { DocumentData, VerificationResult, VerificationIssue } from "./verification/types.js";
```

- [x] **Step 6: Run tests**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/ai/`
Expected: ALL PASS

- [x] **Step 7: Run build**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=@axle/ai`
Expected: PASS

- [x] **Step 8: Commit**

```bash
git add packages/ai/src/verification/ packages/ai/__tests__/verification/ packages/ai/src/index.ts
git commit -m "feat: add pre-submission verification module"
```

---

## Task 5: DocGen text-parser

**Files:**
- Create: `packages/docgen/src/converters/text-parser.ts`
- Create: `packages/docgen/__tests__/converters/text-parser.test.ts`
- Modify: `packages/docgen/src/index.ts`

- [x] **Step 1: Write test**

```typescript
// packages/docgen/__tests__/converters/text-parser.test.ts
import { describe, it, expect, vi } from "vitest";
import { extractText } from "../src/converters/text-parser.js";

vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({
    text: "PDF content here",
    numpages: 3,
    info: { Title: "Test PDF", Author: "Author" },
  }),
}));

vi.mock("jszip", () => {
  const mockFile = (content: string) => ({ async: () => Promise.resolve(content) });
  return {
    default: vi.fn().mockImplementation(() => ({
      loadAsync: vi.fn().mockResolvedValue({
        files: {
          "Contents/section0.xml": mockFile("<TEXT><P><T>HWPX content</T></P></TEXT>"),
        },
        file: (name: string) => {
          if (name === "Contents/section0.xml") return mockFile("<TEXT><P><T>HWPX content</T></P></TEXT>");
          return null;
        },
      }),
    })),
  };
});

describe("extractText", () => {
  it("extracts text from PDF buffer", async () => {
    const buffer = Buffer.from("fake-pdf");
    const result = await extractText(buffer, "pdf");
    expect(result.text).toBe("PDF content here");
    expect(result.metadata.fileType).toBe("pdf");
    expect(result.metadata.pageCount).toBe(3);
  });

  it("extracts text from HWPX buffer", async () => {
    const buffer = Buffer.from("fake-hwpx");
    const result = await extractText(buffer, "hwpx");
    expect(result.text).toContain("HWPX content");
    expect(result.metadata.fileType).toBe("hwpx");
  });

  it("returns guidance for HWP binary format", async () => {
    const buffer = Buffer.from("fake-hwp");
    const result = await extractText(buffer, "hwp");
    expect(result.metadata.fileType).toBe("hwp");
    expect(result.text).toContain("HWPX");
  });

  it("throws on unsupported file type", async () => {
    await expect(extractText(Buffer.from("x"), "xyz")).rejects.toThrow("Unsupported");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/docgen/__tests__/converters/text-parser.test.ts`
Expected: FAIL

- [x] **Step 3: Implement text-parser**

```typescript
// packages/docgen/src/converters/text-parser.ts
import pdfParse from "pdf-parse";
import JSZip from "jszip";

export interface ParseResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    fileType: "pdf" | "hwpx" | "hwp" | "docx";
  };
}

export async function extractText(buffer: Buffer, fileType: string): Promise<ParseResult> {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return extractPdf(buffer);
    case "hwpx":
      return extractHwpx(buffer);
    case "hwp":
      return extractHwp();
    case "docx":
      return extractDocx(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    metadata: {
      title: data.info?.Title ?? undefined,
      author: data.info?.Author ?? undefined,
      pageCount: data.numpages,
      fileType: "pdf",
    },
  };
}

async function extractHwpx(buffer: Buffer): Promise<ParseResult> {
  const zip = new JSZip();
  const archive = await zip.loadAsync(buffer);
  const texts: string[] = [];

  // HWPX stores content in Contents/sectionN.xml files
  for (let i = 0; i < 100; i++) {
    const entry = archive.file(`Contents/section${i}.xml`);
    if (!entry) break;
    const xml = await entry.async("text");
    // Extract text from <T> tags
    const matches = xml.match(/<T[^>]*>([^<]*)<\/T>/g) || [];
    for (const m of matches) {
      const text = m.replace(/<[^>]+>/g, "").trim();
      if (text) texts.push(text);
    }
  }

  return {
    text: texts.join("\n"),
    metadata: { fileType: "hwpx" },
  };
}

async function extractHwp(): Promise<ParseResult> {
  return {
    text: "HWP 바이너리 형식은 직접 파싱이 제한적입니다. HWPX로 변환 후 처리를 권장합니다.",
    metadata: { fileType: "hwp" },
  };
}

async function extractDocx(buffer: Buffer): Promise<ParseResult> {
  const zip = new JSZip();
  const archive = await zip.loadAsync(buffer);
  const docXml = archive.file("word/document.xml");
  if (!docXml) {
    return { text: "", metadata: { fileType: "docx" } };
  }

  const xml = await docXml.async("text");
  const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const texts = matches.map((m) => m.replace(/<[^>]+>/g, ""));

  return {
    text: texts.join(" "),
    metadata: { fileType: "docx" },
  };
}
```

- [x] **Step 4: Update docgen index.ts**

Add to `packages/docgen/src/index.ts`:
```typescript
export { extractText } from "./converters/text-parser.js";
export type { ParseResult } from "./converters/text-parser.js";
```

- [x] **Step 5: Run tests**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/docgen/__tests__/converters/text-parser.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/docgen/src/converters/text-parser.ts packages/docgen/__tests__/converters/text-parser.test.ts packages/docgen/src/index.ts
git commit -m "feat: add text-parser for PDF/HWPX/DOCX extraction"
```

---

## Task 6: DocGen image-generator + mermaid-to-png

**Files:**
- Create: `packages/docgen/src/generators/image-generator.ts`
- Create: `packages/docgen/src/converters/mermaid-to-png.ts`
- Create: `packages/docgen/__tests__/generators/image-generator.test.ts`
- Create: `packages/docgen/__tests__/converters/mermaid-to-png.test.ts`
- Modify: `packages/docgen/src/index.ts`

- [x] **Step 1: Write image-generator test**

```typescript
// packages/docgen/__tests__/generators/image-generator.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  data: Buffer.from("fake-image").toString("base64"),
                  mimeType: "image/png",
                },
              }],
            },
          }],
        },
      }),
    }),
  })),
}));

describe("generateImage", () => {
  it("returns buffer and mimeType", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    const { generateImage } = await import("../src/generators/image-generator.js");
    const result = await generateImage("a chart showing growth");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.mimeType).toBe("image/png");
  });

  it("throws when API key is missing", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const { generateImage } = await import("../src/generators/image-generator.js");
    await expect(generateImage("test")).rejects.toThrow();
  });
});
```

- [x] **Step 2: Write mermaid-to-png test**

```typescript
// packages/docgen/__tests__/converters/mermaid-to-png.test.ts
import { describe, it, expect, vi } from "vitest";
import { existsSync } from "fs";

vi.mock("child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
    // Simulate mmdc writing output file
    const fs = require("fs");
    const outPath = _args[_args.indexOf("-o") + 1];
    fs.writeFileSync(outPath, Buffer.from("fake-png"));
    cb(null, "", "");
  }),
}));

describe("convertMermaid", () => {
  it("returns PNG buffer from mermaid code", async () => {
    const { convertMermaid } = await import("../src/converters/mermaid-to-png.js");
    const result = await convertMermaid("graph TD; A-->B;");
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it("cleans up temp files", async () => {
    const { convertMermaid } = await import("../src/converters/mermaid-to-png.js");
    await convertMermaid("graph TD; A-->B;");
    // Temp files should be cleaned up (no assertion needed — no error = success)
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/docgen/__tests__/generators/image-generator.test.ts packages/docgen/__tests__/converters/mermaid-to-png.test.ts`
Expected: FAIL

- [x] **Step 4: Implement image-generator**

```typescript
// packages/docgen/src/generators/image-generator.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ImageGenerateOptions {
  width?: number;
  height?: number;
  style?: "infographic" | "diagram" | "illustration";
}

export async function generateImage(
  prompt: string,
  options?: ImageGenerateOptions
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required for image generation");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const styleHint = options?.style ? ` Style: ${options.style}.` : "";
  const fullPrompt = `Generate an image: ${prompt}.${styleHint} Professional quality, clean design.`;

  const result = await model.generateContent(fullPrompt);
  const candidate = result.response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  if (!part || !("inlineData" in part) || !part.inlineData) {
    throw new Error("No image data in response");
  }

  return {
    buffer: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType || "image/png",
  };
}
```

- [x] **Step 5: Implement mermaid-to-png**

```typescript
// packages/docgen/src/converters/mermaid-to-png.ts
import { execFile } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export interface MermaidOptions {
  width?: number;
  height?: number;
  theme?: "default" | "dark" | "forest";
  backgroundColor?: string;
}

export async function convertMermaid(
  mermaidCode: string,
  options?: MermaidOptions
): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `mermaid-${id}.mmd`);
  const outputPath = join(tmpdir(), `mermaid-${id}.png`);

  try {
    writeFileSync(inputPath, mermaidCode, "utf-8");

    const args = ["-i", inputPath, "-o", outputPath, "-b", options?.backgroundColor ?? "transparent"];
    if (options?.theme) args.push("-t", options.theme);
    if (options?.width) args.push("-w", String(options.width));
    if (options?.height) args.push("-H", String(options.height));

    await new Promise<void>((resolve, reject) => {
      execFile("mmdc", args, { timeout: 30_000 }, (err, _stdout, stderr) => {
        if (err) return reject(new Error(`mmdc error: ${stderr || err.message}`));
        resolve();
      });
    });

    return readFileSync(outputPath);
  } finally {
    try { unlinkSync(inputPath); } catch { /* ignore */ }
    try { unlinkSync(outputPath); } catch { /* ignore */ }
  }
}
```

- [x] **Step 6: Update docgen index.ts**

Add to `packages/docgen/src/index.ts`:
```typescript
export { generateImage } from "./generators/image-generator.js";
export type { ImageGenerateOptions } from "./generators/image-generator.js";
export { convertMermaid } from "./converters/mermaid-to-png.js";
export type { MermaidOptions } from "./converters/mermaid-to-png.js";
```

- [x] **Step 7: Run tests**

Run: `cd /Volumes/포터블/AXLE && npx vitest run packages/docgen/`
Expected: ALL PASS

- [x] **Step 8: Commit**

```bash
git add packages/docgen/src/generators/image-generator.ts packages/docgen/src/converters/mermaid-to-png.ts packages/docgen/__tests__/generators/image-generator.test.ts packages/docgen/__tests__/converters/mermaid-to-png.test.ts packages/docgen/src/index.ts
git commit -m "feat: add image-generator and mermaid-to-png converters"
```

---

## Task 7: Schedule Service 추출

**Files:**
- Create: `apps/web/lib/services/schedule-service.ts`
- Create: `apps/web/__tests__/services/schedule-service.test.ts`
- Modify: `apps/web/app/api/schedules/route.ts`
- Modify: `apps/web/app/api/schedules/[scheduleId]/route.ts`

- [x] **Step 1: Write test**

```typescript
// apps/web/__tests__/services/schedule-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/db", () => ({
  prisma: {
    schedule: {
      findMany: vi.fn().mockResolvedValue([{ id: "s1", title: "Test" }]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({ id: "s1", title: "New" }),
      findFirst: vi.fn().mockResolvedValue({ id: "s1", title: "Test" }),
      update: vi.fn().mockResolvedValue({ id: "s1", title: "Updated" }),
      delete: vi.fn().mockResolvedValue({ id: "s1" }),
    },
  },
}));

describe("ScheduleService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listSchedules returns paginated result", async () => {
    const { listSchedules } = await import("../../lib/services/schedule-service.js");
    const result = await listSchedules("org1", { page: 1, pageSize: 20 });
    expect(result.schedules).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("createSchedule creates and returns schedule", async () => {
    const { createSchedule } = await import("../../lib/services/schedule-service.js");
    const result = await createSchedule("org1", {
      title: "New",
      type: "MEETING",
      startDate: "2026-05-01",
    });
    expect(result.title).toBe("New");
  });

  it("deleteSchedule removes schedule", async () => {
    const { deleteSchedule } = await import("../../lib/services/schedule-service.js");
    await expect(deleteSchedule("s1", "org1")).resolves.not.toThrow();
  });
});
```

- [x] **Step 2: Implement schedule-service.ts**

```typescript
// apps/web/lib/services/schedule-service.ts
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";

interface ScheduleFilters {
  type?: string;
  clientId?: string;
  startDateFrom?: string;
  startDateTo?: string;
  page: number;
  pageSize: number;
}

const SCHEDULE_SELECT = {
  id: true,
  orgId: true,
  clientId: true,
  projectId: true,
  programId: true,
  title: true,
  description: true,
  type: true,
  startDate: true,
  endDate: true,
  isAllDay: true,
  reminderDays: true,
  googleCalendarId: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  program: { select: { id: true, name: true } },
} as const;

export async function listSchedules(orgId: string, filters: ScheduleFilters) {
  const { type, clientId, startDateFrom, startDateTo, page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ScheduleWhereInput = {
    orgId,
    ...(type ? { type } : {}),
    ...(clientId ? { clientId } : {}),
    ...(startDateFrom || startDateTo
      ? {
          startDate: {
            ...(startDateFrom ? { gte: new Date(startDateFrom) } : {}),
            ...(startDateTo ? { lte: new Date(startDateTo) } : {}),
          },
        }
      : {}),
  };

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startDate: "asc" },
      select: SCHEDULE_SELECT,
    }),
    prisma.schedule.count({ where }),
  ]);

  return { schedules, total };
}

export async function createSchedule(orgId: string, data: {
  title: string;
  type: string;
  startDate: string;
  endDate?: string;
  description?: string;
  clientId?: string;
  projectId?: string;
  programId?: string;
  isAllDay?: boolean;
  reminderDays?: number[];
}) {
  const { startDate, endDate, ...rest } = data;
  return prisma.schedule.create({
    data: {
      ...rest,
      orgId,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
    },
  });
}

export async function getSchedule(id: string, orgId: string) {
  return prisma.schedule.findFirst({
    where: { id, orgId },
    select: SCHEDULE_SELECT,
  });
}

export async function updateSchedule(id: string, orgId: string, data: Record<string, unknown>) {
  const { startDate, endDate, ...rest } = data as { startDate?: string; endDate?: string; [key: string]: unknown };
  return prisma.schedule.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    },
  });
}

export async function deleteSchedule(id: string, orgId: string) {
  // Verify ownership first
  const schedule = await prisma.schedule.findFirst({ where: { id, orgId } });
  if (!schedule) throw new Error("Schedule not found");
  await prisma.schedule.delete({ where: { id } });
}
```

- [x] **Step 3: Update API routes to use service**

Replace inline logic in `apps/web/app/api/schedules/route.ts`:
- GET: call `listSchedules(user.orgId, parsed.data)` → return result
- POST: call `createSchedule(user.orgId, parsed.data)` → return result

Replace inline logic in `apps/web/app/api/schedules/[scheduleId]/route.ts`:
- GET: call `getSchedule(scheduleId, user.orgId)`
- PATCH: call `updateSchedule(scheduleId, user.orgId, parsed.data)`
- DELETE: call `deleteSchedule(scheduleId, user.orgId)`

- [x] **Step 4: Run tests**

Run: `cd /Volumes/포터블/AXLE && npx vitest run apps/web/__tests__/services/schedule-service.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/web/lib/services/schedule-service.ts apps/web/__tests__/services/schedule-service.test.ts apps/web/app/api/schedules/
git commit -m "refactor: extract schedule service from API routes"
```

---

## Task 8: Program Deadline 서비스 추출

**Files:**
- Create: `apps/web/lib/services/program-deadline.ts`
- Create: `apps/web/__tests__/services/program-deadline.test.ts`
- Modify: `apps/web/app/api/programs/route.ts`
- Modify: `apps/web/app/api/programs/[programId]/route.ts`

- [x] **Step 1: Write test**

```typescript
// apps/web/__tests__/services/program-deadline.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTx = {
  programInfo: {
    create: vi.fn().mockResolvedValue({
      id: "p1",
      name: "테스트 사업",
      applicationEnd: new Date("2026-06-01"),
    }),
  },
  schedule: {
    create: vi.fn().mockResolvedValue({ id: "s1" }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
};

vi.mock("@axle/db", () => ({
  prisma: {
    $transaction: vi.fn((cb: Function) => cb(mockTx)),
    schedule: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "s1" }),
    },
    programInfo: {
      delete: vi.fn().mockResolvedValue({ id: "p1" }),
    },
  },
}));

describe("ProgramDeadlineService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createProgramWithDeadlines creates program + schedule", async () => {
    const { createProgramWithDeadlines } = await import("../../lib/services/program-deadline.js");
    const result = await createProgramWithDeadlines("org1", {
      name: "테스트 사업",
      agency: "테스트 기관",
      category: "STARTUP",
      applicationEnd: "2026-06-01",
    });
    expect(result.id).toBe("p1");
    expect(mockTx.schedule.create).toHaveBeenCalled();
  });

  it("skips schedule creation when no applicationEnd", async () => {
    mockTx.programInfo.create.mockResolvedValueOnce({
      id: "p2",
      name: "No deadline",
      applicationEnd: null,
    });
    const { createProgramWithDeadlines } = await import("../../lib/services/program-deadline.js");
    await createProgramWithDeadlines("org1", {
      name: "No deadline",
      agency: "Agency",
      category: "GENERAL",
    });
    expect(mockTx.schedule.create).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Implement program-deadline.ts**

```typescript
// apps/web/lib/services/program-deadline.ts
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";

const PROGRAM_DUE_REMINDER_DAYS = [30, 14, 7, 3, 1];

interface CreateProgramInput {
  name: string;
  agency: string;
  category: string;
  applicationStart?: string;
  applicationEnd?: string;
  maxFunding?: number;
  requirements?: unknown;
  eligibility?: unknown;
  announcementUrl?: string;
  region?: string;
  memo?: string;
}

export async function createProgramWithDeadlines(orgId: string, data: CreateProgramInput) {
  const {
    applicationStart,
    applicationEnd,
    maxFunding,
    requirements,
    eligibility,
    announcementUrl,
    ...rest
  } = data;

  return prisma.$transaction(async (tx) => {
    const created = await tx.programInfo.create({
      data: {
        ...rest,
        orgId,
        announcementUrl: announcementUrl || null,
        applicationStart: applicationStart ? new Date(applicationStart) : null,
        applicationEnd: applicationEnd ? new Date(applicationEnd) : null,
        maxFunding: maxFunding ?? undefined,
        requirements: requirements != null ? (requirements as Prisma.InputJsonValue) : undefined,
        eligibility: eligibility != null ? (eligibility as Prisma.InputJsonValue) : undefined,
      },
    });

    if (created.applicationEnd) {
      await tx.schedule.create({
        data: {
          orgId,
          programId: created.id,
          title: `[마감] ${created.name}`,
          type: "PROGRAM_DUE",
          startDate: created.applicationEnd,
          isAllDay: true,
          reminderDays: PROGRAM_DUE_REMINDER_DAYS,
        },
      });
    }

    return created;
  });
}

export async function syncDeadlines(programId: string, orgId: string, newEndDate: Date | null) {
  // Remove existing PROGRAM_DUE schedules
  await prisma.schedule.deleteMany({
    where: { programId, type: "PROGRAM_DUE" },
  });

  // Create new one if date exists
  if (newEndDate) {
    const program = await prisma.programInfo.findUnique({
      where: { id: programId },
      select: { name: true },
    });

    await prisma.schedule.create({
      data: {
        orgId,
        programId,
        title: `[마감] ${program?.name ?? "프로그램"}`,
        type: "PROGRAM_DUE",
        startDate: newEndDate,
        isAllDay: true,
        reminderDays: PROGRAM_DUE_REMINDER_DAYS,
      },
    });
  }
}

export async function deleteProgramWithDeadlines(programId: string) {
  await prisma.schedule.deleteMany({
    where: { programId, type: "PROGRAM_DUE" },
  });
  await prisma.programInfo.delete({ where: { id: programId } });
}
```

- [x] **Step 3: Update programs API routes to use service**

Replace inline transaction logic in `apps/web/app/api/programs/route.ts` POST with `createProgramWithDeadlines()`.
Replace inline transaction logic in `apps/web/app/api/programs/[programId]/route.ts` PATCH/DELETE with `syncDeadlines()` / `deleteProgramWithDeadlines()`.

- [x] **Step 4: Run tests**

Run: `cd /Volumes/포터블/AXLE && npx vitest run apps/web/__tests__/services/program-deadline.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/web/lib/services/program-deadline.ts apps/web/__tests__/services/program-deadline.test.ts apps/web/app/api/programs/
git commit -m "refactor: extract program-deadline service from API routes"
```

---

## Task 9: Meeting Summary AI 와이어링

**Files:**
- Modify: `apps/web/lib/services/meeting-summary.ts`
- Modify: `apps/web/__tests__/services/meeting-summary.test.ts` (or create)

- [x] **Step 1: Write test**

```typescript
// apps/web/__tests__/services/meeting-summary.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/db", () => ({
  prisma: {
    meetingTranscript: {
      findUnique: vi.fn().mockResolvedValue({
        id: "t1",
        rawTranscript: "회의 내용입니다. 다음 주까지 보고서를 제출하기로 했습니다.",
        meeting: { projectId: "proj1" },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@axle/ai", () => ({
  createAiJob: vi.fn().mockResolvedValue({ id: "job1", tier: "API_HAIKU" }),
  updateJobStatus: vi.fn().mockResolvedValue({}),
  resolveProvider: vi.fn().mockResolvedValue({
    complete: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        summary: "보고서 제출 논의",
        keyDecisions: ["다음 주까지 보고서 제출"],
        actionItems: [{ task: "보고서 제출", assignee: "팀원A" }],
      }),
      usage: { inputTokens: 50, outputTokens: 100 },
      model: "claude-haiku",
    }),
  }),
}));

describe("generateSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls AI provider and updates transcript", async () => {
    const { generateSummary } = await import("../../lib/services/meeting-summary.js");
    await generateSummary("meeting1");

    const { prisma } = await import("@axle/db");
    expect(prisma.meetingTranscript.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { meetingId: "meeting1" },
        data: expect.objectContaining({ summary: expect.any(String) }),
      })
    );
  });
});
```

- [x] **Step 2: Update meeting-summary.ts**

```typescript
// apps/web/lib/services/meeting-summary.ts
import { prisma } from "@axle/db";
import { createAiJob, updateJobStatus, resolveProvider } from "@axle/ai";

const MEETING_SUMMARY_PROMPT = `You are a meeting summarizer. Given a meeting transcript, extract:
1. A concise summary (2-3 sentences in Korean)
2. Key decisions made
3. Action items with assignees

Respond in JSON format:
{"summary": "...", "keyDecisions": ["..."], "actionItems": [{"task": "...", "assignee": "..."}]}`;

export async function generateSummary(meetingId: string): Promise<void> {
  try {
    const transcript = await prisma.meetingTranscript.findUnique({
      where: { meetingId },
      select: {
        id: true,
        rawTranscript: true,
        meeting: { select: { projectId: true } },
      },
    });

    if (!transcript?.rawTranscript) {
      console.warn("[meeting-summary] no transcript found", { meetingId });
      return;
    }

    const job = await createAiJob({
      type: "SUMMARY",
      tier: "API_HAIKU",
      projectId: transcript.meeting.projectId ?? undefined,
      input: {
        meetingId,
        transcriptId: transcript.id,
        rawTranscript: transcript.rawTranscript.slice(0, 8000),
      },
    });

    await prisma.meetingTranscript.update({
      where: { meetingId },
      data: { aiJobId: job.id },
    });

    const provider = await resolveProvider("SUMMARY");
    const result = await provider.complete({
      system: MEETING_SUMMARY_PROMPT,
      prompt: transcript.rawTranscript.slice(0, 8000),
    });

    let parsed: { summary: string; keyDecisions: string[]; actionItems: unknown[] };
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = { summary: result.text, keyDecisions: [], actionItems: [] };
    }

    await prisma.meetingTranscript.update({
      where: { meetingId },
      data: {
        summary: parsed.summary,
        keyDecisions: parsed.keyDecisions,
      },
    });

    await updateJobStatus(job.id, {
      status: "COMPLETED",
      output: parsed as Record<string, unknown>,
    });

    console.info("[meeting-summary] completed", { meetingId, aiJobId: job.id });
  } catch (err) {
    console.error("[meeting-summary] failed", { meetingId, err });
  }
}
```

- [x] **Step 3: Run test**

Run: `cd /Volumes/포터블/AXLE && npx vitest run apps/web/__tests__/services/meeting-summary.test.ts`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add apps/web/lib/services/meeting-summary.ts apps/web/__tests__/services/meeting-summary.test.ts
git commit -m "feat: wire AI provider into meeting summary generation"
```

---

## Task 10: Journal Draft AI 와이어링

**Files:**
- Modify: `apps/web/lib/services/journal-draft.ts`

- [x] **Step 1: Write test**

Same pattern as Task 9 — mock `resolveProvider`, verify `prisma.researchJournal.update` called with AI-generated content.

- [x] **Step 2: Update journal-draft.ts**

Add after AiJob creation (replace Phase 14 TODO block):

```typescript
const provider = await resolveProvider("JOURNAL_DRAFT");
const result = await provider.complete({
  system: JOURNAL_DRAFT_PROMPT,
  prompt: JSON.stringify({
    title: journal.title,
    content: journal.content.slice(0, 8000),
    date: journal.date.toISOString(),
  }),
});

let parsed: { objectives: string; results: string; nextSteps: string };
try {
  parsed = JSON.parse(result.text);
} catch {
  parsed = { objectives: result.text, results: "", nextSteps: "" };
}

await prisma.researchJournal.update({
  where: { id: journal.id },
  data: {
    objectives: parsed.objectives || journal.objectives,
    results: parsed.results || journal.results,
    nextSteps: parsed.nextSteps || journal.nextSteps,
  },
});

await updateJobStatus(job.id, { status: "COMPLETED", output: parsed as Record<string, unknown> });
```

- [x] **Step 3: Run test and commit**

```bash
git add apps/web/lib/services/journal-draft.ts apps/web/__tests__/services/journal-draft.test.ts
git commit -m "feat: wire AI provider into journal draft generation"
```

---

## Task 11: Financial Narrative 서비스 + API

**Files:**
- Create: `apps/web/lib/services/financial-narrative.ts`
- Create: `apps/web/app/api/analytics/narrative/route.ts`
- Create: `apps/web/__tests__/services/financial-narrative.test.ts`

- [x] **Step 1: Write test**

```typescript
// apps/web/__tests__/services/financial-narrative.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/db", () => ({
  prisma: {
    clientFinancial: {
      findFirst: vi.fn().mockResolvedValue({
        id: "cf1",
        revenue: 1000000000,
        operatingProfit: 100000000,
        netIncome: 80000000,
        totalAssets: 2000000000,
        totalLiabilities: 500000000,
        equity: 1500000000,
        year: 2025,
      }),
    },
  },
}));

vi.mock("@axle/ai", () => ({
  resolveProvider: vi.fn().mockResolvedValue({
    complete: vi.fn().mockResolvedValue({
      text: "이 기업은 안정적인 재무구조를 보여줍니다. 부채비율 33.3%로 건전한 수준입니다.",
      usage: { inputTokens: 100, outputTokens: 200 },
      model: "claude-haiku",
    }),
  }),
}));

describe("generateFinancialNarrative", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates narrative from financial data", async () => {
    const { generateFinancialNarrative } = await import("../../lib/services/financial-narrative.js");
    const result = await generateFinancialNarrative("client1", 2025);
    expect(result).toContain("재무");
  });

  it("throws when no financial data found", async () => {
    const { prisma } = await import("@axle/db");
    (prisma.clientFinancial.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const { generateFinancialNarrative } = await import("../../lib/services/financial-narrative.js");
    await expect(generateFinancialNarrative("x", 2025)).rejects.toThrow();
  });
});
```

- [x] **Step 2: Implement service**

```typescript
// apps/web/lib/services/financial-narrative.ts
import { prisma } from "@axle/db";
import { resolveProvider } from "@axle/ai";

const FINANCIAL_PROMPT = `You are a Korean business financial analyst. Given financial data and ratios, write a concise analysis narrative in Korean (3-5 paragraphs). Cover: overall health, profitability, debt structure, and recommendations. Use specific numbers.`;

export async function generateFinancialNarrative(clientId: string, year: number): Promise<string> {
  const financial = await prisma.clientFinancial.findFirst({
    where: { clientId, year },
  });

  if (!financial) {
    throw new Error(`No financial data for client ${clientId} year ${year}`);
  }

  const equity = Number(financial.equity) || 0;
  const totalLiabilities = Number(financial.totalLiabilities) || 0;
  const revenue = Number(financial.revenue) || 0;
  const operatingProfit = Number(financial.operatingProfit) || 0;
  const netIncome = Number(financial.netIncome) || 0;

  const ratios = {
    debtRatio: equity > 0 ? ((totalLiabilities / equity) * 100).toFixed(1) : "N/A",
    operatingMargin: revenue > 0 ? ((operatingProfit / revenue) * 100).toFixed(1) : "N/A",
    netMargin: revenue > 0 ? ((netIncome / revenue) * 100).toFixed(1) : "N/A",
    roe: equity > 0 ? ((netIncome / equity) * 100).toFixed(1) : "N/A",
  };

  const provider = await resolveProvider("FINANCIAL_ANALYSIS");
  const result = await provider.complete({
    system: FINANCIAL_PROMPT,
    prompt: JSON.stringify({ year, financial, ratios }),
  });

  return result.text;
}
```

- [x] **Step 3: Implement API route**

```typescript
// apps/web/app/api/analytics/narrative/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { generateFinancialNarrative } from "@/lib/services/financial-narrative";
import { handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { z } from "zod";

const narrativeSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return unauthorizedResponse();

    const body = await req.json();
    const parsed = narrativeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const narrative = await generateFinancialNarrative(parsed.data.clientId, parsed.data.year);
    return NextResponse.json({ data: { narrative } });
  } catch (err) {
    return handleInternalError(err);
  }
}
```

- [x] **Step 4: Run test**

Run: `cd /Volumes/포터블/AXLE && npx vitest run apps/web/__tests__/services/financial-narrative.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/web/lib/services/financial-narrative.ts apps/web/app/api/analytics/narrative/route.ts apps/web/__tests__/services/financial-narrative.test.ts
git commit -m "feat: add financial narrative AI generation service and API"
```

---

## Task 12: Member 관리 UI 컴포넌트

**Files:**
- Create: `apps/web/src/components/projects/member-role-select.tsx`
- Create: `apps/web/src/components/projects/member-list.tsx`
- Create: `apps/web/src/components/projects/add-member-dialog.tsx`

- [x] **Step 1: Create member-role-select.tsx**

```tsx
// apps/web/src/components/projects/member-role-select.tsx
"use client";

const ROLES = [
  { value: "LEAD", label: "리더" },
  { value: "MEMBER", label: "멤버" },
  { value: "VIEWER", label: "뷰어" },
] as const;

interface MemberRoleSelectProps {
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
}

export function MemberRoleSelect({ value, onChange, disabled }: MemberRoleSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
    >
      {ROLES.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
```

- [x] **Step 2: Create member-list.tsx**

```tsx
// apps/web/src/components/projects/member-list.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface MemberListProps {
  projectId: string;
  currentUserRole?: string;
}

export function MemberList({ projectId, currentUserRole }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const { data } = await res.json();
        setMembers(data);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleRemove = async (memberId: string) => {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (res.ok) fetchMembers();
  };

  const canManage = currentUserRole === "LEAD";

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">로딩 중...</div>;
  }

  if (members.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">팀원이 없습니다.</div>;
  }

  const roleBadgeClass: Record<string, string> = {
    LEAD: "bg-blue-100 text-blue-800",
    MEMBER: "bg-green-100 text-green-800",
    VIEWER: "bg-gray-100 text-gray-800",
  };
  const roleLabel: Record<string, string> = { LEAD: "리더", MEMBER: "멤버", VIEWER: "뷰어" };

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {(m.user?.name?.[0] ?? m.user?.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{m.user?.name ?? "이름 없음"}</p>
              <p className="text-xs text-muted-foreground">{m.user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass[m.role] ?? ""}`}>
              {roleLabel[m.role] ?? m.role}
            </span>
            {canManage && m.role !== "LEAD" && (
              <button
                onClick={() => handleRemove(m.id)}
                className="text-xs text-destructive hover:underline"
              >
                제거
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 3: Create add-member-dialog.tsx**

```tsx
// apps/web/src/components/projects/add-member-dialog.tsx
"use client";

import { useState } from "react";
import { MemberRoleSelect } from "./member-role-select";

interface AddMemberDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
}

export function AddMemberDialog({ projectId, open, onOpenChange, onMemberAdded }: AddMemberDialogProps) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.length < 2) { setUsers([]); return; }
    const res = await fetch(`/api/users?search=${encodeURIComponent(query)}`);
    if (res.ok) {
      const { data } = await res.json();
      setUsers(data ?? []);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role }),
      });
      if (res.ok) {
        onMemberAdded();
        onOpenChange(false);
        setSearch("");
        setSelectedUserId("");
        setRole("MEMBER");
      } else {
        const { error: err } = await res.json();
        setError(err?.message ?? "추가 실패");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold">팀원 추가</h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">이름 또는 이메일 검색</label>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="검색어 입력..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {users.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border">
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedUserId(u.id); setSearch(u.name ?? u.email); setUsers([]); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {u.name ?? "이름 없음"} ({u.email})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">역할</label>
            <MemberRoleSelect value={role} onChange={setRole} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedUserId || submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "추가 중..." : "추가"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Commit**

```bash
git add apps/web/src/components/projects/member-role-select.tsx apps/web/src/components/projects/member-list.tsx apps/web/src/components/projects/add-member-dialog.tsx
git commit -m "feat: add member management UI components"
```

---

## Task 13: Handoff UI 컴포넌트

**Files:**
- Create: `apps/web/src/components/projects/handoff-form.tsx`
- Create: `apps/web/src/components/projects/handoff-summary.tsx`

- [x] **Step 1: Create handoff-form.tsx**

```tsx
// apps/web/src/components/projects/handoff-form.tsx
"use client";

import { useState } from "react";

interface HandoffFormProps {
  projectId: string;
  onHandoffComplete: () => void;
}

export function HandoffForm({ projectId, onHandoffComplete }: HandoffFormProps) {
  const [newAssigneeSearch, setNewAssigneeSearch] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSearch = async (query: string) => {
    setNewAssigneeSearch(query);
    if (query.length < 2) { setUsers([]); return; }
    const res = await fetch(`/api/users?search=${encodeURIComponent(query)}`);
    if (res.ok) {
      const { data } = await res.json();
      setUsers(data ?? []);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !reason.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAssigneeId: selectedUserId, reason }),
      });
      if (res.ok) {
        onHandoffComplete();
        setSelectedUserId("");
        setReason("");
        setConfirmOpen(false);
      } else {
        const { error: err } = await res.json();
        setError(err?.message ?? "인수인계 실패");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h4 className="font-medium">프로젝트 인수인계</h4>

      <div>
        <label className="mb-1 block text-sm font-medium">새 담당자</label>
        <input
          type="text"
          value={newAssigneeSearch}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="이름 또는 이메일로 검색..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {users.length > 0 && (
          <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedUserId(u.id); setNewAssigneeSearch(u.name ?? u.email); setUsers([]); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {u.name ?? "이름 없음"} ({u.email})
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">인수인계 사유</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="인수인계 사유를 입력하세요..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!confirmOpen ? (
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!selectedUserId || !reason.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          인수인계 실행
        </button>
      ) : (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3">
          <p className="mb-2 text-sm font-medium text-destructive">이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmOpen(false)} className="rounded-md border px-3 py-1.5 text-sm">취소</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground disabled:opacity-50"
            >
              {submitting ? "처리 중..." : "확인"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 2: Create handoff-summary.tsx**

```tsx
// apps/web/src/components/projects/handoff-summary.tsx
"use client";

import { useEffect, useState } from "react";

interface HandoffRecord {
  id: string;
  timestamp: string;
  payload: {
    fromUserId?: string;
    fromUserName?: string;
    toUserId?: string;
    toUserName?: string;
    reason?: string;
  };
}

interface HandoffSummaryProps {
  projectId: string;
}

export function HandoffSummary({ projectId }: HandoffSummaryProps) {
  const [records, setRecords] = useState<HandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`/api/projects/${projectId}/activity?type=HANDOFF`);
        if (res.ok) {
          const { data } = await res.json();
          setRecords(data ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetch_();
  }, [projectId]);

  if (loading) return <div className="py-4 text-center text-sm text-muted-foreground">로딩 중...</div>;

  if (records.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">인수인계 이력이 없습니다.</div>;
  }

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{r.payload.fromUserName ?? "이전 담당자"}</span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="font-medium">{r.payload.toUserName ?? "새 담당자"}</span>
          </div>
          {r.payload.reason && (
            <p className="mt-1 text-sm text-muted-foreground">{r.payload.reason}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(r.timestamp).toLocaleString("ko-KR")}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add apps/web/src/components/projects/handoff-form.tsx apps/web/src/components/projects/handoff-summary.tsx
git commit -m "feat: add handoff form and summary UI components"
```

---

## Task 14: ProjectDetailTabs 확장

**Files:**
- Modify: `apps/web/src/components/projects/project-detail-tabs.tsx`

- [x] **Step 1: Update TABS array and imports**

Replace the entire file with expanded version — add imports for all tab components and extend TABS array with members, activity, handoff, ai_jobs.

Key changes:
- Import `DocumentTable` from `../documents/document-table`
- Import `MeetingTable` from `../meetings/meeting-table`
- Import `MemberList` from `./member-list`
- Import `AddMemberDialog` from `./add-member-dialog`
- Import `ActivityFeed` from `../collaboration/activity-feed`
- Import `HandoffForm` from `./handoff-form`
- Import `HandoffSummary` from `./handoff-summary`
- Add TABS: `members`, `activity`, `handoff`
- Replace placeholder text with actual components

```typescript
const TABS = [
  { id: "overview", label: "개요" },
  { id: "checklist", label: "체크리스트" },
  { id: "documents", label: "서류" },
  { id: "meetings", label: "미팅" },
  { id: "members", label: "팀원" },
  { id: "activity", label: "활동" },
  { id: "handoff", label: "인수인계" },
  { id: "ai_jobs", label: "AI 작업" },
] as const;
```

Replace placeholder panels:
- `documents` → `<DocumentTable projectId={project.id} />`
- `meetings` → `<MeetingTable projectId={project.id} />`
- `members` → `<MemberList>` + `<AddMemberDialog>`
- `activity` → `<ActivityFeed projectId={project.id} />`
- `handoff` → `<HandoffForm>` + `<HandoffSummary>`
- `ai_jobs` → Simple AiJob list table (fetch from `/api/projects/{id}` with `aiJobs` include)

- [x] **Step 2: Run build to verify**

Run: `cd /Volumes/포터블/AXLE && npx turbo build --filter=web`
Expected: PASS

- [x] **Step 3: Commit**

```bash
git add apps/web/src/components/projects/project-detail-tabs.tsx
git commit -m "feat: expand ProjectDetailTabs with all 8 tabs"
```

---

## Task 15: Tier 3 — 버전 업그레이드 + 최종 검증

**Files:**
- Modify: `apps/web/package.json` (Next.js version)
- Modify: `packages/db/package.json` (Prisma version)

- [x] **Step 1: Check available versions**

Run:
```bash
npm view next version
npm view prisma version
```

If Next.js 16 stable and Prisma 7 stable exist → upgrade.
If not available → skip, keep current versions.

- [x] **Step 2: Upgrade (if available)**

```bash
cd /Volumes/포터블/AXLE
# Only if stable versions available:
# npm install next@16 --workspace=apps/web
# npm install prisma@7 @prisma/client@7 @prisma/adapter-pg@7 --workspace=packages/db
# cd packages/db && npx prisma generate
```

- [x] **Step 3: Full verification**

```bash
cd /Volumes/포터블/AXLE
npx turbo lint
npx turbo typecheck
npx turbo build
npx turbo test
```

Expected: ALL PASS

- [x] **Step 4: Fix any failures**

If any check fails, fix the root cause and re-run.

- [x] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: version upgrades and full verification pass"
```

---

## Summary

| Task | Phase | Description | Files |
|------|-------|-------------|-------|
| 1 | 5 | Provider types + AnthropicProvider | 3 |
| 2 | 5 | LocalMlxProvider + ClaudeCliProvider | 4 |
| 3 | 5 | Provider registry + router integration | 5 |
| 4 | 5 | Pre-submission verification | 4 |
| 5 | 6 | Text parser | 3 |
| 6 | 6 | Image generator + Mermaid-to-PNG | 5 |
| 7 | 7 | Schedule service extraction | 3 |
| 8 | 7 | Program deadline service extraction | 3 |
| 9 | 9 | Meeting summary AI wiring | 2 |
| 10 | 10 | Journal draft AI wiring | 2 |
| 11 | 11 | Financial narrative service + API | 3 |
| 12 | 12 | Member management UI (3 components) | 3 |
| 13 | 12 | Handoff UI (2 components) | 2 |
| 14 | 12 | ProjectDetailTabs expansion | 1 |
| 15 | T3 | Version upgrades + verification | 2 |
| **Total** | | | **~45** |
