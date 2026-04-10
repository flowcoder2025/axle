# AXLE Phase 5: AI Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the AI engine package with 3-tier routing (LOCAL_MLX / API_HAIKU / API_OPUS / CLI_CLAUDE), provider abstractions, RAG system with pgvector, gap diagnosis, evaluation engine, pre-submission verification, and SkillPattern learning loop — so all AI-powered features have a unified, cost-optimized interface.

**Architecture:** Single package (`@axle/ai`) with a router that resolves the cheapest/fastest AI tier per job type, provider abstractions for each tier, a RAG system using pgvector for semantic search, and domain-specific AI modules (gap diagnosis, evaluation, verification) ported from FlowMate. SkillPattern learning accumulates usage data for future fine-tuning.

**Tech Stack:** Anthropic SDK (@anthropic-ai/sdk), OpenAI SDK (embeddings only), Prisma 7 $queryRaw (pgvector), Zod, TypeScript 5, Vitest

**Depends on:** Phase 0 (packages/db with AiJob, SkillPattern, DocumentEmbedding models)

---

## File Structure

```
axle/
├── packages/
│   └── ai/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                        # Public API exports
│       │   ├── router.ts                       # AI Router: resolveAiTier()
│       │   ├── job.ts                          # AiJob CRUD (create, update, getResult)
│       │   ├── providers/
│       │   │   ├── types.ts                    # Provider interface
│       │   │   ├── anthropic.ts                # AnthropicProvider (Haiku/Opus)
│       │   │   ├── local-mlx.ts                # LocalMLXProvider (HTTP to mlx-lm)
│       │   │   └── claude-cli.ts               # ClaudeCLIProvider (claude -p / .claude-mq)
│       │   ├── rag/
│       │   │   ├── embeddings.ts               # Embedding generation (OpenAI)
│       │   │   ├── crud.ts                     # DocumentEmbedding CRUD
│       │   │   └── search.ts                   # Hybrid search (semantic + keyword)
│       │   ├── diagnosis/
│       │   │   └── gap-analyzer.ts             # Gap diagnosis (docs vs requirements)
│       │   ├── evaluation/
│       │   │   └── engine.ts                   # Multi-criteria scoring
│       │   ├── verification/
│       │   │   └── pre-submission.ts           # Document completeness + format check
│       │   └── skill-pattern/
│       │       └── learning.ts                 # SkillPattern extract + match + update
│       └── tests/
│           ├── router.test.ts
│           ├── job.test.ts
│           ├── rag-search.test.ts
│           ├── gap-analyzer.test.ts
│           ├── evaluation.test.ts
│           ├── verification.test.ts
│           └── skill-pattern.test.ts
```

---

## Task 1: packages/ai — Package Setup & AI Router

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/router.ts`
- Create: `packages/ai/tests/router.test.ts`

- [ ] **Step 1: Create packages/ai/package.json**

```json
{
  "name": "@axle/ai",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./router": "./src/router.ts",
    "./job": "./src/job.ts",
    "./rag": "./src/rag/search.ts",
    "./diagnosis": "./src/diagnosis/gap-analyzer.ts",
    "./evaluation": "./src/evaluation/engine.ts",
    "./verification": "./src/verification/pre-submission.ts",
    "./skill-pattern": "./src/skill-pattern/learning.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "openai": "^4.85.0",
    "@axle/db": "workspace:*",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/ai/tsconfig.json**

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

- [ ] **Step 3: Write failing tests for AI Router**

Create `packages/ai/tests/router.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the local availability check
vi.mock("../src/providers/local-mlx", () => ({
  isLocalAvailable: vi.fn(),
}));

import { resolveAiTier } from "../src/router";
import { isLocalAvailable } from "../src/providers/local-mlx";

const mockIsLocalAvailable = vi.mocked(isLocalAvailable);

describe("AI Router — resolveAiTier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLocalAvailable.mockReturnValue(false);
  });

  it("routes BUSINESS_PLAN to CLI_CLAUDE", () => {
    const tier = resolveAiTier("BUSINESS_PLAN", {});
    expect(tier).toBe("CLI_CLAUDE");
  });

  it("routes RESEARCH to CLI_CLAUDE", () => {
    const tier = resolveAiTier("RESEARCH", {});
    expect(tier).toBe("CLI_CLAUDE");
  });

  it("routes JOURNAL_DRAFT to LOCAL_MLX when available", () => {
    mockIsLocalAvailable.mockReturnValue(true);
    const tier = resolveAiTier("JOURNAL_DRAFT", {});
    expect(tier).toBe("LOCAL_MLX");
  });

  it("routes JOURNAL_DRAFT to API_HAIKU when local unavailable", () => {
    mockIsLocalAvailable.mockReturnValue(false);
    const tier = resolveAiTier("JOURNAL_DRAFT", {});
    expect(tier).toBe("API_HAIKU");
  });

  it("routes SUMMARY to LOCAL_MLX when available", () => {
    mockIsLocalAvailable.mockReturnValue(true);
    const tier = resolveAiTier("SUMMARY", {});
    expect(tier).toBe("LOCAL_MLX");
  });

  it("routes TRANSCRIBE to LOCAL_MLX when available", () => {
    mockIsLocalAvailable.mockReturnValue(true);
    const tier = resolveAiTier("TRANSCRIBE", {});
    expect(tier).toBe("LOCAL_MLX");
  });

  it("routes FINANCIAL_ANALYSIS to API_HAIKU", () => {
    const tier = resolveAiTier("FINANCIAL_ANALYSIS", {});
    expect(tier).toBe("API_HAIKU");
  });

  it("routes GAP_DIAGNOSIS to API_HAIKU", () => {
    const tier = resolveAiTier("GAP_DIAGNOSIS", {});
    expect(tier).toBe("API_HAIKU");
  });

  it("routes EVALUATION to API_HAIKU", () => {
    const tier = resolveAiTier("EVALUATION", {});
    expect(tier).toBe("API_HAIKU");
  });

  it("routes MATCHING to API_HAIKU", () => {
    const tier = resolveAiTier("MATCHING", {});
    expect(tier).toBe("API_HAIKU");
  });

  it("routes OCR to LOCAL_MLX when available", () => {
    mockIsLocalAvailable.mockReturnValue(true);
    const tier = resolveAiTier("OCR", {});
    expect(tier).toBe("LOCAL_MLX");
  });

  it("forces API tier when forceApiMode is enabled", () => {
    const tier = resolveAiTier("JOURNAL_DRAFT", {
      forceApiMode: true,
      defaultApiTier: "API_OPUS",
    });
    expect(tier).toBe("API_OPUS");
  });

  it("defaults to API_HAIKU for unknown job types", () => {
    const tier = resolveAiTier("UNKNOWN_TYPE" as any, {});
    expect(tier).toBe("API_HAIKU");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/router.test.ts
```

Expected: FAIL — "Cannot find module '../src/router'"

- [ ] **Step 5: Implement AI Router**

Create `packages/ai/src/router.ts`:

```typescript
import type { AiJobType, AiTier } from "@axle/db";
import { isLocalAvailable } from "./providers/local-mlx";

export interface OrgAiConfig {
  /** Force all jobs to use API (no local MLX) */
  forceApiMode?: boolean;
  /** Default API tier when forceApiMode is true */
  defaultApiTier?: AiTier;
  /** Override tier for specific job types */
  overrides?: Partial<Record<AiJobType, AiTier>>;
}

/**
 * AI Router — resolves the optimal AI tier for a given job type.
 *
 * Routing logic (from AXLE design spec section 4.8):
 * - BUSINESS_PLAN, RESEARCH → CLI_CLAUDE (complex, needs extended context)
 * - JOURNAL_DRAFT, SUMMARY, OCR, TRANSCRIBE → LOCAL_MLX if available, else API_HAIKU
 * - FINANCIAL_ANALYSIS, GAP_DIAGNOSIS, EVALUATION, MATCHING → API_HAIKU
 *
 * forceApiMode overrides all routing to use the specified API tier.
 * Per-job overrides take precedence over defaults.
 */
export function resolveAiTier(
  jobType: AiJobType,
  config: OrgAiConfig
): AiTier {
  // Force API mode — bypass all routing
  if (config.forceApiMode) {
    return config.defaultApiTier ?? "API_HAIKU";
  }

  // Per-job override
  if (config.overrides?.[jobType]) {
    return config.overrides[jobType]!;
  }

  // Default routing logic
  switch (jobType) {
    // Complex tasks → Claude CLI (extended context, tool use)
    case "BUSINESS_PLAN":
    case "RESEARCH":
      return "CLI_CLAUDE";

    // Simple tasks → Local MLX when available, otherwise Haiku
    case "JOURNAL_DRAFT":
    case "SUMMARY":
    case "OCR":
      return isLocalAvailable() ? "LOCAL_MLX" : "API_HAIKU";

    // Transcription → Local MLX (mlx-whisper) or API
    case "TRANSCRIBE":
      return isLocalAvailable() ? "LOCAL_MLX" : "API_HAIKU";

    // Medium complexity → API Haiku
    case "FINANCIAL_ANALYSIS":
    case "GAP_DIAGNOSIS":
    case "EVALUATION":
    case "MATCHING":
      return "API_HAIKU";

    // Unknown → safe default
    default:
      return "API_HAIKU";
  }
}

/**
 * Get a human-readable description of a tier.
 */
export function describeTier(tier: AiTier): string {
  switch (tier) {
    case "LOCAL_MLX":
      return "Local MLX (Hermes 3 8B via mlx-lm)";
    case "API_HAIKU":
      return "Anthropic API (Claude Haiku)";
    case "API_OPUS":
      return "Anthropic API (Claude Opus)";
    case "CLI_CLAUDE":
      return "Claude CLI (claude -p / .claude-mq)";
  }
}
```

- [ ] **Step 6: Create vitest config**

Create `packages/ai/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/router.test.ts
```

Expected: All 13 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/package.json packages/ai/tsconfig.json packages/ai/src/router.ts packages/ai/tests/router.test.ts packages/ai/vitest.config.ts
git commit -m "feat: add packages/ai with AI Router (4-tier routing for 10 job types)"
```

---

## Task 2: packages/ai — AiJob CRUD

**Files:**
- Create: `packages/ai/src/job.ts`
- Create: `packages/ai/tests/job.test.ts`

- [ ] **Step 1: Write failing tests for AiJob CRUD**

Create `packages/ai/tests/job.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    aiJob: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("../src/router", () => ({
  resolveAiTier: vi.fn().mockReturnValue("API_HAIKU"),
}));

import {
  createAiJob,
  updateJobStatus,
  completeJob,
  failJob,
  getJobResult,
} from "../src/job";

describe("AiJob CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAiJob", () => {
    it("creates a new AiJob with QUEUED status", async () => {
      mockCreate.mockResolvedValue({
        id: "job-1",
        type: "BUSINESS_PLAN",
        tier: "API_HAIKU",
        status: "QUEUED",
        input: { prompt: "test" },
      });

      const job = await createAiJob({
        type: "BUSINESS_PLAN",
        tier: "API_HAIKU",
        input: { prompt: "test" },
        projectId: "proj-1",
      });

      expect(job.id).toBe("job-1");
      expect(job.status).toBe("QUEUED");
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          type: "BUSINESS_PLAN",
          tier: "API_HAIKU",
          status: "QUEUED",
          input: { prompt: "test" },
          projectId: "proj-1",
          skillPatternId: undefined,
        },
      });
    });
  });

  describe("updateJobStatus", () => {
    it("updates job status to RUNNING", async () => {
      mockUpdate.mockResolvedValue({ id: "job-1", status: "RUNNING" });

      await updateJobStatus("job-1", "RUNNING");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { status: "RUNNING" },
      });
    });
  });

  describe("completeJob", () => {
    it("marks job as COMPLETED with output and duration", async () => {
      mockUpdate.mockResolvedValue({
        id: "job-1",
        status: "COMPLETED",
        output: { result: "plan text" },
        durationMs: 5000,
        cost: 0.05,
      });

      await completeJob("job-1", {
        output: { result: "plan text" },
        durationMs: 5000,
        cost: 0.05,
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: {
          status: "COMPLETED",
          output: { result: "plan text" },
          durationMs: 5000,
          cost: 0.05,
        },
      });
    });
  });

  describe("failJob", () => {
    it("marks job as FAILED with error message", async () => {
      mockUpdate.mockResolvedValue({
        id: "job-1",
        status: "FAILED",
        errorMessage: "Rate limited",
      });

      await failJob("job-1", "Rate limited");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: {
          status: "FAILED",
          errorMessage: "Rate limited",
        },
      });
    });
  });

  describe("getJobResult", () => {
    it("returns job with output", async () => {
      mockFindUnique.mockResolvedValue({
        id: "job-1",
        status: "COMPLETED",
        output: { result: "plan text" },
      });

      const job = await getJobResult("job-1");

      expect(job?.status).toBe("COMPLETED");
      expect(job?.output).toEqual({ result: "plan text" });
    });

    it("returns null for non-existent job", async () => {
      mockFindUnique.mockResolvedValue(null);

      const job = await getJobResult("non-existent");

      expect(job).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/job.test.ts
```

Expected: FAIL — "Cannot find module '../src/job'"

- [ ] **Step 3: Implement AiJob CRUD**

Create `packages/ai/src/job.ts`:

```typescript
import { prisma, type AiJobType, type AiTier, type JobStatus } from "@axle/db";

export interface CreateAiJobInput {
  type: AiJobType;
  tier: AiTier;
  input: Record<string, unknown>;
  projectId?: string;
  skillPatternId?: string;
}

export interface CompleteJobInput {
  output: Record<string, unknown>;
  durationMs: number;
  cost?: number;
}

/**
 * Create a new AiJob in QUEUED status.
 */
export async function createAiJob(input: CreateAiJobInput) {
  return prisma.aiJob.create({
    data: {
      type: input.type,
      tier: input.tier,
      status: "QUEUED",
      input: input.input,
      projectId: input.projectId,
      skillPatternId: input.skillPatternId,
    },
  });
}

/**
 * Update the status of an AiJob.
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<void> {
  await prisma.aiJob.update({
    where: { id: jobId },
    data: { status },
  });
}

/**
 * Mark an AiJob as COMPLETED with output, duration, and optional cost.
 */
export async function completeJob(
  jobId: string,
  result: CompleteJobInput
): Promise<void> {
  await prisma.aiJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      output: result.output,
      durationMs: result.durationMs,
      cost: result.cost,
    },
  });
}

/**
 * Mark an AiJob as FAILED with an error message.
 */
export async function failJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  await prisma.aiJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorMessage,
    },
  });
}

/**
 * Get the result of an AiJob by ID.
 */
export async function getJobResult(jobId: string) {
  return prisma.aiJob.findUnique({
    where: { id: jobId },
    include: { skillPattern: true },
  });
}

/**
 * List AiJobs for a project, ordered by most recent.
 */
export async function listProjectJobs(
  projectId: string,
  options: { limit?: number; status?: JobStatus } = {}
) {
  return prisma.aiJob.findMany({
    where: {
      projectId,
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 20,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/job.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/job.ts packages/ai/tests/job.test.ts
git commit -m "feat: add AiJob CRUD (create, updateStatus, complete, fail, getResult)"
```

---

## Task 3: packages/ai — Provider Abstractions

**Files:**
- Create: `packages/ai/src/providers/types.ts`
- Create: `packages/ai/src/providers/anthropic.ts`
- Create: `packages/ai/src/providers/local-mlx.ts`
- Create: `packages/ai/src/providers/claude-cli.ts`

- [ ] **Step 1: Create provider interface**

Create `packages/ai/src/providers/types.ts`:

```typescript
export interface AiProviderRequest {
  /** System prompt */
  system?: string;
  /** User message / prompt */
  prompt: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Optional model override */
  model?: string;
}

export interface AiProviderResponse {
  text: string;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens generated */
  outputTokens?: number;
  /** Estimated cost in USD */
  cost?: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Model used */
  model: string;
}

export interface AiProvider {
  /** Human-readable name */
  readonly name: string;
  /** Check if provider is available */
  isAvailable(): boolean;
  /** Generate a completion */
  generate(request: AiProviderRequest): Promise<AiProviderResponse>;
}
```

- [ ] **Step 2: Create AnthropicProvider**

Create `packages/ai/src/providers/anthropic.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, AiProviderRequest, AiProviderResponse } from "./types";

// Pricing per million tokens (as of 2026-04)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-20250414": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-opus-4-20250514": { input: 15.00, output: 75.00 },
};

export class AnthropicProvider implements AiProvider {
  readonly name: string;
  private client: Anthropic | null = null;
  private defaultModel: string;

  constructor(tier: "haiku" | "opus") {
    this.name = `Anthropic ${tier}`;
    this.defaultModel =
      tier === "haiku"
        ? "claude-haiku-4-20250414"
        : "claude-opus-4-20250514";
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const client = this.getClient();
    const model = request.model ?? this.defaultModel;
    const maxTokens = request.maxTokens ?? 4096;
    const startTime = Date.now();

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: request.temperature ?? 0.7,
      system: request.system ?? "",
      messages: [
        { role: "user", content: request.prompt },
      ],
    });

    const durationMs = Date.now() - startTime;
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const pricing = PRICING[model];
    const cost = pricing
      ? (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
      : undefined;

    return {
      text,
      inputTokens,
      outputTokens,
      cost,
      durationMs,
      model,
    };
  }
}
```

- [ ] **Step 3: Create LocalMLXProvider**

Create `packages/ai/src/providers/local-mlx.ts`:

```typescript
import type { AiProvider, AiProviderRequest, AiProviderResponse } from "./types";

const MLX_ENDPOINT = process.env.MLX_LM_ENDPOINT ?? "http://127.0.0.1:8080";
const MLX_MODEL = process.env.MLX_MODEL ?? "mlx-community/Hermes-3-Llama-3.1-8B-4bit";

let _isAvailable: boolean | null = null;

/**
 * Check if the local MLX server is reachable.
 * Caches result for the lifetime of the process (reset on restart).
 */
export function isLocalAvailable(): boolean {
  if (_isAvailable !== null) return _isAvailable;

  // On server startup, assume unavailable unless proven otherwise.
  // Actual health check happens asynchronously.
  _isAvailable = false;
  checkHealth().then((ok) => {
    _isAvailable = ok;
  });

  return _isAvailable;
}

async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MLX_ENDPOINT}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Force re-check of local MLX availability.
 */
export async function refreshLocalAvailability(): Promise<boolean> {
  _isAvailable = await checkHealth();
  return _isAvailable;
}

export class LocalMLXProvider implements AiProvider {
  readonly name = "Local MLX (Hermes 3)";

  isAvailable(): boolean {
    return isLocalAvailable();
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const startTime = Date.now();

    const messages: Array<{ role: string; content: string }> = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }
    messages.push({ role: "user", content: request.prompt });

    const response = await fetch(`${MLX_ENDPOINT}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model ?? MLX_MODEL,
        messages,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(120_000), // 2 minute timeout for local
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MLX server error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? "";
    const usage = data.usage ?? {};

    return {
      text,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cost: 0, // Local = free
      durationMs,
      model: data.model ?? MLX_MODEL,
    };
  }
}
```

- [ ] **Step 4: Create ClaudeCLIProvider**

Create `packages/ai/src/providers/claude-cli.ts`:

```typescript
import { spawn } from "child_process";
import { writeFile, readFile, mkdir, readdir, unlink } from "fs/promises";
import { join } from "path";
import type { AiProvider, AiProviderRequest, AiProviderResponse } from "./types";

const CLAUDE_MQ_DIR = process.env.CLAUDE_MQ_DIR ?? join(process.cwd(), ".claude-mq");

export class ClaudeCLIProvider implements AiProvider {
  readonly name = "Claude CLI (claude -p)";

  isAvailable(): boolean {
    // Claude CLI is available if the system has `claude` in PATH
    // or if .claude-mq/ directory is used for async jobs
    return true;
  }

  /**
   * Execute a prompt via `claude -p` (synchronous, waits for result).
   * For long-running jobs, use submitToMQ() instead.
   */
  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const startTime = Date.now();
    const prompt = request.system
      ? `${request.system}\n\n${request.prompt}`
      : request.prompt;

    const text = await this.execClaudeCli(prompt);
    const durationMs = Date.now() - startTime;

    return {
      text,
      durationMs,
      model: "claude-cli",
      // claude -p does not report token usage directly
    };
  }

  /**
   * Submit a job to .claude-mq/inbox for async processing by agent-bridge.
   * Returns a job ID that can be checked via checkMQResult().
   */
  async submitToMQ(
    jobId: string,
    prompt: string
  ): Promise<{ submitted: boolean; error?: string }> {
    try {
      const inboxDir = join(CLAUDE_MQ_DIR, "inbox");
      await mkdir(inboxDir, { recursive: true });

      const jobFile = join(inboxDir, `${jobId}.json`);
      await writeFile(
        jobFile,
        JSON.stringify({
          id: jobId,
          prompt,
          createdAt: new Date().toISOString(),
          status: "pending",
        }),
        "utf-8"
      );

      return { submitted: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "MQ submission failed";
      return { submitted: false, error: message };
    }
  }

  /**
   * Check if a .claude-mq job has a result in the outbox.
   */
  async checkMQResult(
    jobId: string
  ): Promise<{ ready: boolean; result?: string }> {
    try {
      const outboxDir = join(CLAUDE_MQ_DIR, "outbox");
      const resultFile = join(outboxDir, `${jobId}.json`);
      const content = await readFile(resultFile, "utf-8");
      const data = JSON.parse(content);
      return { ready: true, result: data.result };
    } catch {
      return { ready: false };
    }
  }

  /**
   * List pending MQ jobs.
   */
  async listPendingMQJobs(): Promise<string[]> {
    try {
      const inboxDir = join(CLAUDE_MQ_DIR, "inbox");
      const files = await readdir(inboxDir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
    } catch {
      return [];
    }
  }

  /**
   * Clean up a completed MQ job.
   */
  async cleanupMQJob(jobId: string): Promise<void> {
    const outboxFile = join(CLAUDE_MQ_DIR, "outbox", `${jobId}.json`);
    try {
      await unlink(outboxFile);
    } catch {
      // Ignore if already cleaned
    }
  }

  private execClaudeCli(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("claude", ["-p", prompt], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 300_000, // 5 minute timeout
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(
            new Error(`claude -p exited with code ${code}: ${stderr.trim()}`)
          );
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn claude: ${err.message}`));
      });
    });
  }
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
git add packages/ai/src/providers/
git commit -m "feat: add AI provider abstractions (Anthropic, LocalMLX, ClaudeCLI)"
```

---

## Task 4: packages/ai — RAG System (pgvector)

**Files:**
- Create: `packages/ai/src/rag/embeddings.ts`
- Create: `packages/ai/src/rag/crud.ts`
- Create: `packages/ai/src/rag/search.ts`
- Create: `packages/ai/tests/rag-search.test.ts`

- [ ] **Step 1: Create embedding generation module**

Create `packages/ai/src/rag/embeddings.ts`:

```typescript
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding vector for a text string.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.substring(0, 8191), // Max input length
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple text strings in batch.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const openai = getOpenAI();

  // Process in batches of 100 (OpenAI limit)
  const batchSize = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.substring(0, 8191));

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    for (const item of response.data) {
      results.push(item.embedding);
    }
  }

  return results;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
```

- [ ] **Step 2: Create DocumentEmbedding CRUD**

Create `packages/ai/src/rag/crud.ts`:

```typescript
import { prisma } from "@axle/db";
import { generateEmbedding } from "./embeddings";

export interface UpsertEmbeddingInput {
  sourceType: string;
  sourceId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create or update a document embedding.
 * Generates the vector on the fly using OpenAI.
 */
export async function upsertEmbedding(
  input: UpsertEmbeddingInput
): Promise<string> {
  const embedding = await generateEmbedding(input.content);
  const vectorStr = `[${embedding.join(",")}]`;

  // Upsert: delete existing then insert (Prisma doesn't support Unsupported fields in upsert)
  await prisma.$executeRaw`
    DELETE FROM "DocumentEmbedding"
    WHERE "sourceType" = ${input.sourceType}
    AND "sourceId" = ${input.sourceId}
  `;

  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "DocumentEmbedding" ("id", "sourceType", "sourceId", "content", "embedding", "metadata", "createdAt")
    VALUES (
      gen_random_uuid()::text,
      ${input.sourceType},
      ${input.sourceId},
      ${input.content},
      ${vectorStr}::vector(1536),
      ${JSON.stringify(input.metadata ?? {})}::jsonb,
      NOW()
    )
    RETURNING "id"
  `;

  return result[0].id;
}

/**
 * Delete embeddings for a source.
 */
export async function deleteEmbeddings(
  sourceType: string,
  sourceId: string
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "DocumentEmbedding"
    WHERE "sourceType" = ${sourceType}
    AND "sourceId" = ${sourceId}
  `;
}

/**
 * Count embeddings for a source type.
 */
export async function countEmbeddings(
  sourceType?: string
): Promise<number> {
  if (sourceType) {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "DocumentEmbedding"
      WHERE "sourceType" = ${sourceType}
    `;
    return Number(result[0].count);
  }

  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "DocumentEmbedding"
  `;
  return Number(result[0].count);
}
```

- [ ] **Step 3: Write failing tests for hybrid search**

Create `packages/ai/tests/rag-search.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockGenerateEmbedding = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock("../src/rag/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { hybridSearch, semanticSearch, keywordSearch } from "../src/rag/search";

describe("RAG Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("semanticSearch", () => {
    it("generates embedding and queries by vector similarity", async () => {
      mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
      mockQueryRaw.mockResolvedValue([
        { id: "emb-1", sourceType: "document", sourceId: "doc-1", content: "test content", similarity: 0.95, metadata: {} },
      ]);

      const results = await semanticSearch("사업계획서 작성", { limit: 5 });

      expect(mockGenerateEmbedding).toHaveBeenCalledWith("사업계획서 작성");
      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(0.95);
    });

    it("filters by sourceType when provided", async () => {
      mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
      mockQueryRaw.mockResolvedValue([]);

      await semanticSearch("test query", { sourceType: "client", limit: 5 });

      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("keywordSearch", () => {
    it("searches by keyword in content", async () => {
      mockQueryRaw.mockResolvedValue([
        { id: "emb-2", sourceType: "document", sourceId: "doc-2", content: "벤처 인증 요건", metadata: {} },
      ]);

      const results = await keywordSearch("벤처 인증");

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain("벤처 인증");
    });
  });

  describe("hybridSearch", () => {
    it("combines semantic and keyword results with deduplication", async () => {
      mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));

      // Semantic results
      mockQueryRaw
        .mockResolvedValueOnce([
          { id: "emb-1", sourceType: "doc", sourceId: "doc-1", content: "semantic match", similarity: 0.9, metadata: {} },
          { id: "emb-2", sourceType: "doc", sourceId: "doc-2", content: "both match", similarity: 0.85, metadata: {} },
        ])
        // Keyword results
        .mockResolvedValueOnce([
          { id: "emb-2", sourceType: "doc", sourceId: "doc-2", content: "both match", metadata: {} },
          { id: "emb-3", sourceType: "doc", sourceId: "doc-3", content: "keyword only", metadata: {} },
        ]);

      const results = await hybridSearch("사업계획서", { limit: 10 });

      // Should deduplicate emb-2
      expect(results.length).toBe(3);
      const ids = results.map((r) => r.id);
      expect(ids).toContain("emb-1");
      expect(ids).toContain("emb-2");
      expect(ids).toContain("emb-3");
    });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/rag-search.test.ts
```

Expected: FAIL — "Cannot find module '../src/rag/search'"

- [ ] **Step 5: Implement hybrid search**

Create `packages/ai/src/rag/search.ts`:

```typescript
import { prisma } from "@axle/db";
import { generateEmbedding } from "./embeddings";

export interface SearchResult {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  similarity?: number;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  /** Maximum results to return */
  limit?: number;
  /** Filter by source type (e.g., "document", "client", "program") */
  sourceType?: string;
  /** Minimum similarity threshold (0-1) for semantic search */
  minSimilarity?: number;
}

/**
 * Semantic search using pgvector cosine similarity.
 */
export async function semanticSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 10, sourceType, minSimilarity = 0.5 } = options;
  const embedding = await generateEmbedding(query);
  const vectorStr = `[${embedding.join(",")}]`;

  let results: SearchResult[];

  if (sourceType) {
    results = await prisma.$queryRaw<SearchResult[]>`
      SELECT
        "id",
        "sourceType",
        "sourceId",
        "content",
        1 - ("embedding" <=> ${vectorStr}::vector(1536)) AS similarity,
        "metadata"
      FROM "DocumentEmbedding"
      WHERE "sourceType" = ${sourceType}
      AND 1 - ("embedding" <=> ${vectorStr}::vector(1536)) > ${minSimilarity}
      ORDER BY "embedding" <=> ${vectorStr}::vector(1536)
      LIMIT ${limit}
    `;
  } else {
    results = await prisma.$queryRaw<SearchResult[]>`
      SELECT
        "id",
        "sourceType",
        "sourceId",
        "content",
        1 - ("embedding" <=> ${vectorStr}::vector(1536)) AS similarity,
        "metadata"
      FROM "DocumentEmbedding"
      WHERE 1 - ("embedding" <=> ${vectorStr}::vector(1536)) > ${minSimilarity}
      ORDER BY "embedding" <=> ${vectorStr}::vector(1536)
      LIMIT ${limit}
    `;
  }

  return results;
}

/**
 * Keyword search using PostgreSQL ILIKE on content.
 */
export async function keywordSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 10, sourceType } = options;
  const pattern = `%${query}%`;

  if (sourceType) {
    return prisma.$queryRaw<SearchResult[]>`
      SELECT
        "id",
        "sourceType",
        "sourceId",
        "content",
        "metadata"
      FROM "DocumentEmbedding"
      WHERE "sourceType" = ${sourceType}
      AND "content" ILIKE ${pattern}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw<SearchResult[]>`
    SELECT
      "id",
      "sourceType",
      "sourceId",
      "content",
      "metadata"
    FROM "DocumentEmbedding"
    WHERE "content" ILIKE ${pattern}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

/**
 * Hybrid search: combines semantic vector search with keyword search.
 * Results are deduplicated by ID, with semantic results weighted higher.
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 10 } = options;
  const halfLimit = Math.ceil(limit / 2);

  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(query, { ...options, limit: halfLimit }),
    keywordSearch(query, { ...options, limit: halfLimit }),
  ]);

  // Deduplicate: semantic results take priority
  const seen = new Set<string>();
  const combined: SearchResult[] = [];

  for (const result of semanticResults) {
    if (!seen.has(result.id)) {
      seen.add(result.id);
      combined.push(result);
    }
  }

  for (const result of keywordResults) {
    if (!seen.has(result.id)) {
      seen.add(result.id);
      combined.push({ ...result, similarity: undefined });
    }
  }

  return combined.slice(0, limit);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/rag-search.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/rag/
git commit -m "feat: add RAG system with embeddings, CRUD, and hybrid search (semantic + keyword)"
```

---

## Task 5: packages/ai — Gap Diagnosis

**Files:**
- Create: `packages/ai/src/diagnosis/gap-analyzer.ts`
- Create: `packages/ai/tests/gap-analyzer.test.ts`

- [ ] **Step 1: Write failing tests for gap analyzer**

Create `packages/ai/tests/gap-analyzer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerate = vi.fn();

vi.mock("../src/providers/anthropic", () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    name: "mock-anthropic",
    isAvailable: () => true,
    generate: (...args: unknown[]) => mockGenerate(...args),
  })),
}));

import { analyzeGaps, type GapAnalysisResult } from "../src/diagnosis/gap-analyzer";

describe("Gap Analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns structured gap analysis with missing, low-quality, and risk items", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        missing: [
          { item: "사업자등록증", severity: "critical", reason: "필수 서류 누락" },
          { item: "기술개발계획서", severity: "high", reason: "신청 양식 필수 항목" },
        ],
        lowQuality: [
          { item: "회사소개서", issue: "최신 매출 데이터 미반영", suggestion: "2025년 매출 데이터 업데이트 필요" },
        ],
        risks: [
          { item: "신용등급", issue: "BBB 이하 시 감점 가능", mitigation: "보증서 또는 실적 증빙 추가" },
        ],
        readiness: 0.65,
        summary: "필수 서류 2건 누락, 1건 품질 미흡. 전체 준비도 65%.",
      }),
      durationMs: 3000,
      model: "claude-haiku-4-20250414",
    });

    const result = await analyzeGaps({
      clientDocuments: [
        { name: "회사소개서", content: "2024년 기준 회사 소개..." },
        { name: "재무제표", content: "2024년 매출 50억..." },
      ],
      programRequirements: {
        name: "창업성장기술개발사업",
        requiredDocs: ["사업자등록증", "기술개발계획서", "재무제표", "회사소개서"],
        eligibility: ["설립 7년 이내", "기술성 평가 통과"],
      },
    });

    expect(result.missing).toHaveLength(2);
    expect(result.missing[0].severity).toBe("critical");
    expect(result.lowQuality).toHaveLength(1);
    expect(result.risks).toHaveLength(1);
    expect(result.readiness).toBeGreaterThan(0);
    expect(result.readiness).toBeLessThanOrEqual(1);
    expect(result.summary).toBeTruthy();
  });

  it("handles empty document list gracefully", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        missing: [{ item: "전체 서류", severity: "critical", reason: "제출 서류 없음" }],
        lowQuality: [],
        risks: [],
        readiness: 0,
        summary: "제출된 서류가 없습니다.",
      }),
      durationMs: 1000,
      model: "claude-haiku-4-20250414",
    });

    const result = await analyzeGaps({
      clientDocuments: [],
      programRequirements: {
        name: "테스트 사업",
        requiredDocs: ["사업자등록증"],
        eligibility: [],
      },
    });

    expect(result.readiness).toBe(0);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/gap-analyzer.test.ts
```

Expected: FAIL — "Cannot find module '../src/diagnosis/gap-analyzer'"

- [ ] **Step 3: Implement gap analyzer**

Create `packages/ai/src/diagnosis/gap-analyzer.ts`:

```typescript
import { z } from "zod";
import { AnthropicProvider } from "../providers/anthropic";

const gapAnalysisSchema = z.object({
  missing: z.array(
    z.object({
      item: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      reason: z.string(),
    })
  ),
  lowQuality: z.array(
    z.object({
      item: z.string(),
      issue: z.string(),
      suggestion: z.string(),
    })
  ),
  risks: z.array(
    z.object({
      item: z.string(),
      issue: z.string(),
      mitigation: z.string(),
    })
  ),
  readiness: z.number().min(0).max(1),
  summary: z.string(),
});

export type GapAnalysisResult = z.infer<typeof gapAnalysisSchema>;

export interface GapAnalysisInput {
  clientDocuments: Array<{
    name: string;
    content: string;
  }>;
  programRequirements: {
    name: string;
    requiredDocs: string[];
    eligibility: string[];
  };
}

const SYSTEM_PROMPT = `당신은 정부지원사업 컨설팅 전문가입니다.
고객사의 보유 서류와 지원사업 요건을 대조하여 Gap 분석을 수행합니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "missing": [{ "item": "서류명", "severity": "critical|high|medium|low", "reason": "누락 사유" }],
  "lowQuality": [{ "item": "서류명", "issue": "품질 문제", "suggestion": "개선 방안" }],
  "risks": [{ "item": "항목명", "issue": "리스크 내용", "mitigation": "대응 방안" }],
  "readiness": 0.0~1.0,
  "summary": "한 줄 요약"
}

severity 기준:
- critical: 미제출 시 접수 불가
- high: 감점 또는 탈락 가능성 높음
- medium: 보완 시 경쟁력 향상
- low: 있으면 좋은 수준`;

/**
 * Analyze gaps between client documents and program requirements.
 * Compares what the client has vs what the program requires.
 * Returns missing items, quality issues, risks, and overall readiness score.
 */
export async function analyzeGaps(
  input: GapAnalysisInput
): Promise<GapAnalysisResult> {
  const provider = new AnthropicProvider("haiku");

  const docList = input.clientDocuments.length > 0
    ? input.clientDocuments
        .map((d) => `[${d.name}]\n${d.content.substring(0, 500)}`)
        .join("\n\n")
    : "(제출된 서류 없음)";

  const prompt = `## 지원사업 정보
사업명: ${input.programRequirements.name}
필수 서류: ${input.programRequirements.requiredDocs.join(", ")}
자격 요건: ${input.programRequirements.eligibility.join(", ")}

## 고객사 보유 서류
${docList}

위 정보를 대조하여 Gap 분석을 수행하세요.`;

  const response = await provider.generate({
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.3,
    maxTokens: 2048,
  });

  // Parse and validate the response
  const parsed = extractJson(response.text);
  const validated = gapAnalysisSchema.parse(parsed);

  return validated;
}

/**
 * Extract JSON from a response that may contain markdown code blocks.
 */
function extractJson(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Extract from markdown code block
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    throw new Error(`Failed to parse AI response as JSON: ${text.substring(0, 200)}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/gap-analyzer.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/diagnosis/ packages/ai/tests/gap-analyzer.test.ts
git commit -m "feat: add gap diagnosis (docs vs program requirements analysis)"
```

---

## Task 6: packages/ai — Evaluation Engine

**Files:**
- Create: `packages/ai/src/evaluation/engine.ts`
- Create: `packages/ai/tests/evaluation.test.ts`

- [ ] **Step 1: Write failing tests for evaluation engine**

Create `packages/ai/tests/evaluation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerate = vi.fn();

vi.mock("../src/providers/anthropic", () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    name: "mock-anthropic",
    isAvailable: () => true,
    generate: (...args: unknown[]) => mockGenerate(...args),
  })),
}));

import { evaluate, type EvaluationResult } from "../src/evaluation/engine";

describe("Evaluation Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns multi-criteria scores with strengths and weaknesses", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        overallScore: 78,
        criteria: [
          { name: "기술성", score: 85, maxScore: 100, comment: "기술 혁신성이 높음" },
          { name: "사업성", score: 72, maxScore: 100, comment: "시장 분석이 다소 부족" },
          { name: "실현가능성", score: 80, maxScore: 100, comment: "구체적 실행 계획 있음" },
        ],
        strengths: ["기술 차별화가 명확", "팀 역량이 우수"],
        weaknesses: ["시장 규모 근거 부족", "재무 추정이 낙관적"],
        suggestions: ["TAM/SAM/SOM 데이터 보강", "보수적 시나리오 추가"],
      }),
      durationMs: 4000,
      model: "claude-haiku-4-20250414",
    });

    const result = await evaluate({
      documentContent: "사업계획서 내용...",
      evaluationCriteria: [
        { name: "기술성", weight: 0.4, description: "기술 혁신성 및 차별화" },
        { name: "사업성", weight: 0.3, description: "시장 분석 및 사업 모델" },
        { name: "실현가능성", weight: 0.3, description: "실행 계획 및 팀 역량" },
      ],
      programName: "창업성장기술개발사업",
    });

    expect(result.overallScore).toBe(78);
    expect(result.criteria).toHaveLength(3);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.weaknesses.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("handles minimal criteria", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        overallScore: 60,
        criteria: [
          { name: "전체", score: 60, maxScore: 100, comment: "개선 필요" },
        ],
        strengths: ["기본 구조 갖춤"],
        weaknesses: ["세부 내용 부족"],
        suggestions: ["내용 보강 필요"],
      }),
      durationMs: 2000,
      model: "claude-haiku-4-20250414",
    });

    const result = await evaluate({
      documentContent: "간단한 내용",
      evaluationCriteria: [
        { name: "전체", weight: 1.0, description: "전반적 평가" },
      ],
    });

    expect(result.overallScore).toBe(60);
    expect(result.criteria).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/evaluation.test.ts
```

Expected: FAIL — "Cannot find module '../src/evaluation/engine'"

- [ ] **Step 3: Implement evaluation engine**

Create `packages/ai/src/evaluation/engine.ts`:

```typescript
import { z } from "zod";
import { AnthropicProvider } from "../providers/anthropic";

const evaluationResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  criteria: z.array(
    z.object({
      name: z.string(),
      score: z.number().min(0).max(100),
      maxScore: z.number(),
      comment: z.string(),
    })
  ),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

export interface EvaluationInput {
  /** The document content to evaluate */
  documentContent: string;
  /** Evaluation criteria with weights */
  evaluationCriteria: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
  /** Optional program name for context */
  programName?: string;
}

const SYSTEM_PROMPT = `당신은 정부지원사업 사업계획서 평가 전문가입니다.
주어진 평가 기준에 따라 문서를 객관적으로 채점하고 분석합니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "overallScore": 0~100,
  "criteria": [
    { "name": "기준명", "score": 0~100, "maxScore": 100, "comment": "평가 의견" }
  ],
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "suggestions": ["개선안1", "개선안2"]
}

평가 원칙:
- 실제 평가위원의 시각으로 엄격하게 채점
- 구체적 근거를 들어 평가
- 개선 가능한 부분은 구체적 방법 제시
- 80점 이상은 실제로 경쟁력 있는 수준에만 부여`;

/**
 * Evaluate a document against multi-criteria scoring.
 * Uses AI to provide objective scoring, strengths, weaknesses, and suggestions.
 */
export async function evaluate(
  input: EvaluationInput
): Promise<EvaluationResult> {
  const provider = new AnthropicProvider("haiku");

  const criteriaList = input.evaluationCriteria
    .map((c) => `- ${c.name} (가중치 ${(c.weight * 100).toFixed(0)}%): ${c.description}`)
    .join("\n");

  const prompt = `## 평가 대상
${input.programName ? `지원사업: ${input.programName}\n` : ""}

## 평가 기준
${criteriaList}

## 문서 내용
${input.documentContent.substring(0, 6000)}

위 문서를 평가 기준에 따라 채점하고 분석하세요.`;

  const response = await provider.generate({
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.3,
    maxTokens: 2048,
  });

  const parsed = extractJson(response.text);
  return evaluationResultSchema.parse(parsed);
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    throw new Error(`Failed to parse AI response as JSON: ${text.substring(0, 200)}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/evaluation.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/evaluation/ packages/ai/tests/evaluation.test.ts
git commit -m "feat: add multi-criteria evaluation engine for document scoring"
```

---

## Task 7: packages/ai — Pre-Submission Verification

**Files:**
- Create: `packages/ai/src/verification/pre-submission.ts`
- Create: `packages/ai/tests/verification.test.ts`

- [ ] **Step 1: Write failing tests for pre-submission verification**

Create `packages/ai/tests/verification.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    checklistItem: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import {
  checkDocumentCompleteness,
  checkFormatCompliance,
  checkEligibility,
  runFullVerification,
  type VerificationResult,
} from "../src/verification/pre-submission";

describe("Pre-Submission Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkDocumentCompleteness", () => {
    it("returns pass when all required items are VERIFIED", async () => {
      mockFindMany.mockResolvedValue([
        { id: "ci-1", name: "사업자등록증", isRequired: true, status: "VERIFIED" },
        { id: "ci-2", name: "재무제표", isRequired: true, status: "VERIFIED" },
        { id: "ci-3", name: "추가 자료", isRequired: false, status: "PENDING" },
      ]);

      const result = await checkDocumentCompleteness("proj-1");

      expect(result.pass).toBe(true);
      expect(result.totalRequired).toBe(2);
      expect(result.completedRequired).toBe(2);
      expect(result.missingRequired).toHaveLength(0);
    });

    it("returns fail when required items are not VERIFIED", async () => {
      mockFindMany.mockResolvedValue([
        { id: "ci-1", name: "사업자등록증", isRequired: true, status: "VERIFIED" },
        { id: "ci-2", name: "재무제표", isRequired: true, status: "PENDING" },
        { id: "ci-3", name: "기술개발계획서", isRequired: true, status: "UPLOADED" },
      ]);

      const result = await checkDocumentCompleteness("proj-1");

      expect(result.pass).toBe(false);
      expect(result.totalRequired).toBe(3);
      expect(result.completedRequired).toBe(1);
      expect(result.missingRequired).toHaveLength(2);
      expect(result.missingRequired).toContain("재무제표");
    });
  });

  describe("checkFormatCompliance", () => {
    it("checks document against format rules", () => {
      const result = checkFormatCompliance({
        hasTitle: true,
        hasTableOfContents: true,
        pageCount: 25,
        minPages: 10,
        maxPages: 30,
        requiredSections: ["기술 개요", "시장 분석", "사업화 전략"],
        foundSections: ["기술 개요", "시장 분석", "사업화 전략"],
      });

      expect(result.pass).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("reports missing sections and page violations", () => {
      const result = checkFormatCompliance({
        hasTitle: false,
        hasTableOfContents: false,
        pageCount: 5,
        minPages: 10,
        maxPages: 30,
        requiredSections: ["기술 개요", "시장 분석", "사업화 전략"],
        foundSections: ["기술 개요"],
      });

      expect(result.pass).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe("checkEligibility", () => {
    it("returns pass when all criteria are met", () => {
      const result = checkEligibility({
        criteria: [
          { name: "설립 7년 이내", met: true },
          { name: "기술성 평가 통과", met: true },
          { name: "소재지 요건 충족", met: true },
        ],
      });

      expect(result.pass).toBe(true);
      expect(result.failedCriteria).toHaveLength(0);
    });

    it("returns fail when any criterion is not met", () => {
      const result = checkEligibility({
        criteria: [
          { name: "설립 7년 이내", met: true },
          { name: "기술성 평가 통과", met: false },
        ],
      });

      expect(result.pass).toBe(false);
      expect(result.failedCriteria).toContain("기술성 평가 통과");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/verification.test.ts
```

Expected: FAIL — "Cannot find module '../src/verification/pre-submission'"

- [ ] **Step 3: Implement pre-submission verification**

Create `packages/ai/src/verification/pre-submission.ts`:

```typescript
import { prisma } from "@axle/db";

// --- Document Completeness ---

export interface CompletenessResult {
  pass: boolean;
  totalRequired: number;
  completedRequired: number;
  missingRequired: string[];
  pendingOptional: string[];
}

/**
 * Check if all required checklist items for a project are VERIFIED.
 */
export async function checkDocumentCompleteness(
  projectId: string
): Promise<CompletenessResult> {
  const items = await prisma.checklistItem.findMany({
    where: { projectId },
  });

  const requiredItems = items.filter((i) => i.isRequired);
  const completedRequired = requiredItems.filter((i) => i.status === "VERIFIED");
  const missingRequired = requiredItems
    .filter((i) => i.status !== "VERIFIED")
    .map((i) => i.name);

  const optionalItems = items.filter((i) => !i.isRequired);
  const pendingOptional = optionalItems
    .filter((i) => i.status === "PENDING")
    .map((i) => i.name);

  return {
    pass: missingRequired.length === 0,
    totalRequired: requiredItems.length,
    completedRequired: completedRequired.length,
    missingRequired,
    pendingOptional,
  };
}

// --- Format Compliance ---

export interface FormatInput {
  hasTitle: boolean;
  hasTableOfContents: boolean;
  pageCount: number;
  minPages: number;
  maxPages: number;
  requiredSections: string[];
  foundSections: string[];
}

export interface FormatResult {
  pass: boolean;
  issues: string[];
}

/**
 * Check document format compliance against rules.
 */
export function checkFormatCompliance(input: FormatInput): FormatResult {
  const issues: string[] = [];

  if (!input.hasTitle) {
    issues.push("제목이 누락되었습니다.");
  }

  if (!input.hasTableOfContents) {
    issues.push("목차가 누락되었습니다.");
  }

  if (input.pageCount < input.minPages) {
    issues.push(`페이지 수가 부족합니다 (${input.pageCount}/${input.minPages} 이상 필요).`);
  }

  if (input.pageCount > input.maxPages) {
    issues.push(`페이지 수가 초과되었습니다 (${input.pageCount}/${input.maxPages} 이하 필요).`);
  }

  const missingSections = input.requiredSections.filter(
    (s) => !input.foundSections.includes(s)
  );
  for (const section of missingSections) {
    issues.push(`필수 섹션 누락: ${section}`);
  }

  return {
    pass: issues.length === 0,
    issues,
  };
}

// --- Eligibility ---

export interface EligibilityInput {
  criteria: Array<{
    name: string;
    met: boolean;
  }>;
}

export interface EligibilityResult {
  pass: boolean;
  failedCriteria: string[];
}

/**
 * Check if all eligibility criteria are met.
 */
export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const failedCriteria = input.criteria
    .filter((c) => !c.met)
    .map((c) => c.name);

  return {
    pass: failedCriteria.length === 0,
    failedCriteria,
  };
}

// --- Full Verification ---

export interface FullVerificationResult {
  pass: boolean;
  completeness: CompletenessResult;
  format?: FormatResult;
  eligibility?: EligibilityResult;
  summary: string;
}

/**
 * Run all verification checks and produce a summary.
 */
export async function runFullVerification(
  projectId: string,
  options?: {
    formatInput?: FormatInput;
    eligibilityInput?: EligibilityInput;
  }
): Promise<FullVerificationResult> {
  const completeness = await checkDocumentCompleteness(projectId);

  const format = options?.formatInput
    ? checkFormatCompliance(options.formatInput)
    : undefined;

  const eligibility = options?.eligibilityInput
    ? checkEligibility(options.eligibilityInput)
    : undefined;

  const allPass =
    completeness.pass &&
    (format?.pass ?? true) &&
    (eligibility?.pass ?? true);

  const issues: string[] = [];
  if (!completeness.pass) {
    issues.push(`서류 ${completeness.missingRequired.length}건 미완료`);
  }
  if (format && !format.pass) {
    issues.push(`양식 문제 ${format.issues.length}건`);
  }
  if (eligibility && !eligibility.pass) {
    issues.push(`자격 미충족 ${eligibility.failedCriteria.length}건`);
  }

  const summary = allPass
    ? "모든 검증 통과. 제출 가능합니다."
    : `검증 실패: ${issues.join(", ")}`;

  return {
    pass: allPass,
    completeness,
    format,
    eligibility,
    summary,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/verification.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/verification/ packages/ai/tests/verification.test.ts
git commit -m "feat: add pre-submission verification (completeness, format, eligibility)"
```

---

## Task 8: packages/ai — SkillPattern Learning Loop

**Files:**
- Create: `packages/ai/src/skill-pattern/learning.ts`
- Create: `packages/ai/tests/skill-pattern.test.ts`

- [ ] **Step 1: Write failing tests for SkillPattern learning**

Create `packages/ai/tests/skill-pattern.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindMany = vi.fn();
const mockAiJobUpdate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    skillPattern: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    aiJob: {
      update: (...args: unknown[]) => mockAiJobUpdate(...args),
    },
  },
}));

import {
  extractAndLearn,
  matchPattern,
  getFineTuningCandidates,
  FINE_TUNING_THRESHOLD,
} from "../src/skill-pattern/learning";

describe("SkillPattern Learning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("matchPattern", () => {
    it("returns matching pattern when taskType matches", async () => {
      mockFindFirst.mockResolvedValue({
        id: "sp-1",
        name: "사업계획서 초안",
        taskType: "BUSINESS_PLAN",
        successCount: 5,
      });

      const result = await matchPattern("BUSINESS_PLAN", { prompt: "test" });

      expect(result).toBeDefined();
      expect(result!.id).toBe("sp-1");
    });

    it("returns null when no matching pattern exists", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await matchPattern("RESEARCH", { prompt: "test" });

      expect(result).toBeNull();
    });
  });

  describe("extractAndLearn", () => {
    it("increments successCount on existing pattern match", async () => {
      mockFindFirst.mockResolvedValue({
        id: "sp-1",
        name: "요약",
        taskType: "SUMMARY",
        successCount: 4,
      });
      mockUpdate.mockResolvedValue({ id: "sp-1", successCount: 5 });

      await extractAndLearn({
        jobId: "job-1",
        type: "SUMMARY",
        input: { prompt: "summarize this" },
        output: { result: "summary text" },
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "sp-1" },
        data: {
          successCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
      expect(mockAiJobUpdate).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { skillPatternId: "sp-1" },
      });
    });

    it("creates new pattern when no match exists", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "sp-new",
        name: "OCR 문서 분석",
        taskType: "OCR",
        successCount: 1,
      });

      await extractAndLearn({
        jobId: "job-2",
        type: "OCR",
        input: { prompt: "extract text from document" },
        output: { result: "extracted text" },
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskType: "OCR",
          successCount: 1,
        }),
      });
      expect(mockAiJobUpdate).toHaveBeenCalledWith({
        where: { id: "job-2" },
        data: { skillPatternId: "sp-new" },
      });
    });
  });

  describe("getFineTuningCandidates", () => {
    it("returns patterns with successCount >= threshold", async () => {
      mockFindMany.mockResolvedValue([
        { id: "sp-1", name: "요약", taskType: "SUMMARY", successCount: 15, isFineTuned: false },
        { id: "sp-2", name: "일지초안", taskType: "JOURNAL_DRAFT", successCount: 12, isFineTuned: false },
      ]);

      const candidates = await getFineTuningCandidates();

      expect(candidates).toHaveLength(2);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          successCount: { gte: FINE_TUNING_THRESHOLD },
          isFineTuned: false,
        },
        orderBy: { successCount: "desc" },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/skill-pattern.test.ts
```

Expected: FAIL — "Cannot find module '../src/skill-pattern/learning'"

- [ ] **Step 3: Implement SkillPattern learning loop**

Create `packages/ai/src/skill-pattern/learning.ts`:

```typescript
import { prisma, type AiJobType } from "@axle/db";

export const FINE_TUNING_THRESHOLD = 10;

export interface LearnInput {
  jobId: string;
  type: AiJobType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

/**
 * Find a matching SkillPattern for a job type and input shape.
 */
export async function matchPattern(
  taskType: AiJobType,
  input: Record<string, unknown>
) {
  return prisma.skillPattern.findFirst({
    where: { taskType },
    orderBy: { successCount: "desc" },
  });
}

/**
 * After an AiJob completes successfully:
 * 1. Extract input/output pattern
 * 2. Match to existing SkillPattern → increment successCount
 * 3. If no match → create new SkillPattern
 * 4. Link the AiJob to the SkillPattern
 */
export async function extractAndLearn(input: LearnInput): Promise<void> {
  const existing = await matchPattern(input.type, input.input);

  let patternId: string;

  if (existing) {
    // Increment success count on existing pattern
    await prisma.skillPattern.update({
      where: { id: existing.id },
      data: {
        successCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
    patternId = existing.id;
  } else {
    // Create new pattern
    const inputKeys = Object.keys(input.input);
    const outputKeys = Object.keys(input.output);

    const pattern = await prisma.skillPattern.create({
      data: {
        name: `${input.type} pattern`,
        taskType: input.type,
        inputSchema: { keys: inputKeys },
        outputSchema: { keys: outputKeys },
        successCount: 1,
        lastUsedAt: new Date(),
      },
    });
    patternId = pattern.id;
  }

  // Link AiJob to SkillPattern
  await prisma.aiJob.update({
    where: { id: input.jobId },
    data: { skillPatternId: patternId },
  });
}

/**
 * Get SkillPatterns that have reached the fine-tuning threshold
 * and haven't been fine-tuned yet.
 */
export async function getFineTuningCandidates() {
  return prisma.skillPattern.findMany({
    where: {
      successCount: { gte: FINE_TUNING_THRESHOLD },
      isFineTuned: false,
    },
    orderBy: { successCount: "desc" },
  });
}

/**
 * Mark a SkillPattern as fine-tuned.
 * Called after Unsloth fine-tuning completes.
 */
export async function markAsFineTuned(patternId: string): Promise<void> {
  await prisma.skillPattern.update({
    where: { id: patternId },
    data: { isFineTuned: true },
  });
}

/**
 * Get summary statistics for SkillPatterns.
 */
export async function getPatternStats(): Promise<{
  totalPatterns: number;
  fineTunedCount: number;
  topPatterns: Array<{ name: string; taskType: string; successCount: number }>;
}> {
  const patterns = await prisma.skillPattern.findMany({
    orderBy: { successCount: "desc" },
    take: 10,
    select: {
      name: true,
      taskType: true,
      successCount: true,
      isFineTuned: true,
    },
  });

  const fineTunedCount = patterns.filter((p) => p.isFineTuned).length;

  return {
    totalPatterns: patterns.length,
    fineTunedCount,
    topPatterns: patterns.map((p) => ({
      name: p.name,
      taskType: p.taskType,
      successCount: p.successCount,
    })),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run tests/skill-pattern.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Create public API exports**

Create `packages/ai/src/index.ts`:

```typescript
// Router
export { resolveAiTier, describeTier, type OrgAiConfig } from "./router";

// Job CRUD
export {
  createAiJob,
  updateJobStatus,
  completeJob,
  failJob,
  getJobResult,
  listProjectJobs,
  type CreateAiJobInput,
  type CompleteJobInput,
} from "./job";

// Providers
export type { AiProvider, AiProviderRequest, AiProviderResponse } from "./providers/types";
export { AnthropicProvider } from "./providers/anthropic";
export { LocalMLXProvider, isLocalAvailable, refreshLocalAvailability } from "./providers/local-mlx";
export { ClaudeCLIProvider } from "./providers/claude-cli";

// RAG
export { generateEmbedding, generateEmbeddings } from "./rag/embeddings";
export { upsertEmbedding, deleteEmbeddings, countEmbeddings } from "./rag/crud";
export { semanticSearch, keywordSearch, hybridSearch, type SearchResult, type SearchOptions } from "./rag/search";

// Diagnosis
export { analyzeGaps, type GapAnalysisInput, type GapAnalysisResult } from "./diagnosis/gap-analyzer";

// Evaluation
export { evaluate, type EvaluationInput, type EvaluationResult } from "./evaluation/engine";

// Verification
export {
  checkDocumentCompleteness,
  checkFormatCompliance,
  checkEligibility,
  runFullVerification,
  type CompletenessResult,
  type FormatInput,
  type FormatResult,
  type EligibilityInput,
  type EligibilityResult,
  type FullVerificationResult,
} from "./verification/pre-submission";

// SkillPattern
export {
  matchPattern,
  extractAndLearn,
  getFineTuningCandidates,
  markAsFineTuned,
  getPatternStats,
  FINE_TUNING_THRESHOLD,
  type LearnInput,
} from "./skill-pattern/learning";
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/skill-pattern/ packages/ai/tests/skill-pattern.test.ts packages/ai/src/index.ts
git commit -m "feat: add SkillPattern learning loop and public API exports for packages/ai"
```

---

## Task 9: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify Turborepo build with packages/ai**

```bash
cd /Volumes/포터블/AX/axle
npx turbo build
```

Expected: All packages and apps build without errors.

- [ ] **Step 2: Run all tests across packages/ai**

```bash
cd /Volumes/포터블/AX/axle/packages/ai
npx vitest run
```

Expected: All tests pass:
- router: 13/13
- job: 6/6
- rag-search: 4/4
- gap-analyzer: 2/2
- evaluation: 2/2
- verification: 5/5
- skill-pattern: 4/4
- **Total: 36 tests**

- [ ] **Step 3: Verify TypeScript types resolve**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors. Imports from @axle/ai resolve correctly.

- [ ] **Step 4: Add .env.local entries for Phase 5**

Append to `axle/.env.local`:

```env
# Anthropic (AI)
ANTHROPIC_API_KEY=""

# OpenAI (embeddings only)
OPENAI_API_KEY=""

# Local MLX
MLX_LM_ENDPOINT="http://127.0.0.1:8080"
MLX_MODEL="mlx-community/Hermes-3-Llama-3.1-8B-4bit"

# Claude CLI / MQ
CLAUDE_MQ_DIR="/Volumes/포터블/AX/axle/.claude-mq"
```

- [ ] **Step 5: Verify package imports work from apps/web**

Create a quick import test:

```bash
cd /Volumes/포터블/AX/axle
node -e "
const { resolveAiTier } = require('@axle/ai/router');
console.log('BUSINESS_PLAN →', resolveAiTier('BUSINESS_PLAN', {}));
console.log('SUMMARY →', resolveAiTier('SUMMARY', {}));
console.log('AI Router: OK');
" 2>&1 || echo "ESM — will verify via tsc --noEmit instead"
```

Expected: Either prints correct tier mappings or is verified via TypeScript compilation.
