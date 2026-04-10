# AXLE Phase 14: Agent Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the agent-bridge Node.js service that runs on Mac Mini, providing MLX LLM management, .claude-mq/ file-based message queue for Claude CLI integration, AI Router HTTP API, mlx-whisper local transcription, and SkillPattern collection for fine-tuning.

**Architecture:** Express server on Mac Mini (always-on). Manages local MLX model (Hermes 3 8B via mlx-lm), bridges Claude CLI via file-based MQ, exposes OpenAI-compatible proxy, and collects AI job patterns for Unsloth fine-tuning pipeline.

**Tech Stack:** Node.js 22, Express 5, Chokidar 4, Zod, uuid, child_process (for mlx-lm/mlx-whisper subprocess), @axle/db (Prisma client), Vitest, launchd (macOS auto-start)

**Depends on:** Phase 5 (AI engine — packages/ai with AiJob, SkillPattern models and resolveAiTier)

---

## File Structure

```
axle/
├── apps/
│   └── agent-bridge/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── .env.example
│       ├── src/
│       │   ├── index.ts                  # Express server entry point
│       │   ├── config.ts                 # Environment config (Zod validated)
│       │   ├── mlx/
│       │   │   ├── server.ts             # MLX server process manager (start/stop/health)
│       │   │   ├── proxy.ts              # OpenAI-compatible API proxy
│       │   │   └── whisper.ts            # mlx-whisper transcription wrapper
│       │   ├── mq/
│       │   │   ├── watcher.ts            # Chokidar file watcher for .claude-mq/
│       │   │   ├── task.ts               # Task submission (write to inbox/)
│       │   │   ├── result.ts             # Result collection (read from outbox/)
│       │   │   ├── question.ts           # Question handling (*_question.md → *_answer.md)
│       │   │   └── status.ts             # status.json management
│       │   ├── routes/
│       │   │   ├── health.ts             # GET /health
│       │   │   ├── ai.ts                 # POST /api/ai/run, GET /api/ai/status/:jobId
│       │   │   └── transcribe.ts         # POST /api/ai/transcribe
│       │   ├── skill-pattern/
│       │   │   └── collector.ts          # SkillPattern extraction + DB storage
│       │   └── lib/
│       │       └── logger.ts             # Simple structured logger
│       ├── tests/
│       │   ├── config.test.ts
│       │   ├── mlx-server.test.ts
│       │   ├── mlx-proxy.test.ts
│       │   ├── mq-watcher.test.ts
│       │   ├── mq-task.test.ts
│       │   ├── routes-health.test.ts
│       │   ├── routes-ai.test.ts
│       │   ├── skill-pattern.test.ts
│       │   └── whisper.test.ts
│       └── scripts/
│           └── com.axle.agent-bridge.plist  # launchd service file
```

---

## Task 1: Project Scaffold + Config

**Files:**
- Create: `apps/agent-bridge/package.json`
- Create: `apps/agent-bridge/tsconfig.json`
- Create: `apps/agent-bridge/vitest.config.ts`
- Create: `apps/agent-bridge/.env.example`
- Create: `apps/agent-bridge/src/config.ts`
- Create: `apps/agent-bridge/src/lib/logger.ts`

- [ ] **Step 1: Create apps/agent-bridge/package.json**

```json
{
  "name": "@axle/agent-bridge",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@axle/db": "workspace:*",
    "express": "^5.1.0",
    "chokidar": "^4.0.0",
    "uuid": "^11.1.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^4.1.0",
    "supertest": "^7.1.0",
    "@types/supertest": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create apps/agent-bridge/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Create .env.example**

```env
# Agent Bridge Server
PORT=4100
HOST=0.0.0.0

# MLX Server
MLX_MODEL_PATH=mlx-community/Hermes-3-Llama-3.1-8B-4bit
MLX_PORT=8081
MLX_MAX_TOKENS=4096

# mlx-whisper
WHISPER_MODEL=large-v3
WHISPER_LANGUAGE=ko

# .claude-mq/ directory
CLAUDE_MQ_DIR=/Users/jerome/.claude-mq
CLAUDE_CLI_PATH=/usr/local/bin/claude

# Database (same as root .env.local)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Thresholds
SKILL_PATTERN_FINETUNE_THRESHOLD=10
```

- [ ] **Step 5: Create config module with Zod validation**

Create `apps/agent-bridge/src/config.ts`:

```typescript
import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(4100),
  host: z.string().default("0.0.0.0"),

  // MLX
  mlxModelPath: z.string().default("mlx-community/Hermes-3-Llama-3.1-8B-4bit"),
  mlxPort: z.coerce.number().default(8081),
  mlxMaxTokens: z.coerce.number().default(4096),

  // Whisper
  whisperModel: z.string().default("large-v3"),
  whisperLanguage: z.string().default("ko"),

  // .claude-mq/
  claudeMqDir: z.string().default(
    `${process.env.HOME ?? "/tmp"}/.claude-mq`
  ),
  claudeCliPath: z.string().default("/usr/local/bin/claude"),

  // Skill pattern
  skillPatternFinetuneThreshold: z.coerce.number().default(10),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT,
    host: process.env.HOST,
    mlxModelPath: process.env.MLX_MODEL_PATH,
    mlxPort: process.env.MLX_PORT,
    mlxMaxTokens: process.env.MLX_MAX_TOKENS,
    whisperModel: process.env.WHISPER_MODEL,
    whisperLanguage: process.env.WHISPER_LANGUAGE,
    claudeMqDir: process.env.CLAUDE_MQ_DIR,
    claudeCliPath: process.env.CLAUDE_CLI_PATH,
    skillPatternFinetuneThreshold: process.env.SKILL_PATTERN_FINETUNE_THRESHOLD,
  });
}
```

- [ ] **Step 6: Create logger**

Create `apps/agent-bridge/src/lib/logger.ts`:

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

export function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    module,
    message,
    ...(data ? { data } : {}),
  };
  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}
```

- [ ] **Step 7: Write config test**

Create `apps/agent-bridge/tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("loadConfig", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults when no env vars set", async () => {
    const { loadConfig } = await import("../src/config");
    const config = loadConfig();

    expect(config.port).toBe(4100);
    expect(config.host).toBe("0.0.0.0");
    expect(config.mlxPort).toBe(8081);
    expect(config.whisperModel).toBe("large-v3");
    expect(config.skillPatternFinetuneThreshold).toBe(10);
  });

  it("parses custom env values", async () => {
    vi.stubEnv("PORT", "5000");
    vi.stubEnv("MLX_PORT", "9090");
    vi.stubEnv("WHISPER_LANGUAGE", "en");

    // Re-import to pick up env changes
    vi.resetModules();
    const { loadConfig } = await import("../src/config");
    const config = loadConfig();

    expect(config.port).toBe(5000);
    expect(config.mlxPort).toBe(9090);
    expect(config.whisperLanguage).toBe("en");
  });
});
```

- [ ] **Step 8: Run tests to verify config**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/config.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/package.json apps/agent-bridge/tsconfig.json apps/agent-bridge/vitest.config.ts apps/agent-bridge/.env.example apps/agent-bridge/src/config.ts apps/agent-bridge/src/lib/logger.ts apps/agent-bridge/tests/config.test.ts
git commit -m "feat: add apps/agent-bridge scaffold with Zod config and structured logger"
```

---

## Task 2: MLX Server Manager

**Files:**
- Create: `apps/agent-bridge/src/mlx/server.ts`
- Create: `apps/agent-bridge/tests/mlx-server.test.ts`

- [ ] **Step 1: Write failing tests for MLX server manager**

Create `apps/agent-bridge/tests/mlx-server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock child_process
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

// Mock fetch for health checks
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { MlxServer } from "../src/mlx/server";

describe("MlxServer", () => {
  let server: MlxServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new MlxServer({
      modelPath: "mlx-community/Hermes-3-Llama-3.1-8B-4bit",
      port: 8081,
      maxTokens: 4096,
    });
  });

  afterEach(async () => {
    // Ensure cleanup
    if (server.isRunning()) {
      await server.stop();
    }
  });

  describe("start", () => {
    it("spawns mlx_lm.server process with correct args", async () => {
      const mockProcess = {
        pid: 12345,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess);
      mockFetch.mockResolvedValue({ ok: true });

      await server.start();

      expect(mockSpawn).toHaveBeenCalledWith(
        "python",
        [
          "-m", "mlx_lm.server",
          "--model", "mlx-community/Hermes-3-Llama-3.1-8B-4bit",
          "--port", "8081",
        ],
        expect.objectContaining({ stdio: "pipe" })
      );
    });
  });

  describe("isRunning", () => {
    it("returns false when not started", () => {
      expect(server.isRunning()).toBe(false);
    });
  });

  describe("healthCheck", () => {
    it("returns true when MLX server responds 200", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const healthy = await server.healthCheck();
      expect(healthy).toBe(true);
    });

    it("returns false when MLX server is down", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
      const healthy = await server.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe("stop", () => {
    it("kills the child process", async () => {
      const mockProcess = {
        pid: 12345,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "close") setTimeout(cb, 10);
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess);
      mockFetch.mockResolvedValue({ ok: true });

      await server.start();
      await server.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mlx-server.test.ts
```

Expected: FAIL — "Cannot find module '../src/mlx/server'"

- [ ] **Step 3: Implement MLX server manager**

Create `apps/agent-bridge/src/mlx/server.ts`:

```typescript
import { spawn, type ChildProcess } from "node:child_process";
import { log } from "../lib/logger";

interface MlxServerOptions {
  modelPath: string;
  port: number;
  maxTokens: number;
}

export class MlxServer {
  private process: ChildProcess | null = null;
  private readonly opts: MlxServerOptions;
  private readonly healthUrl: string;

  constructor(opts: MlxServerOptions) {
    this.opts = opts;
    this.healthUrl = `http://127.0.0.1:${opts.port}/v1/models`;
  }

  async start(): Promise<void> {
    if (this.process) {
      log("warn", "mlx-server", "Server already running", { pid: this.process.pid });
      return;
    }

    log("info", "mlx-server", "Starting MLX server", {
      model: this.opts.modelPath,
      port: this.opts.port,
    });

    this.process = spawn(
      "python",
      [
        "-m", "mlx_lm.server",
        "--model", this.opts.modelPath,
        "--port", String(this.opts.port),
      ],
      { stdio: "pipe" }
    );

    this.process.stdout?.on("data", (data: Buffer) => {
      log("debug", "mlx-server", data.toString().trim());
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      log("debug", "mlx-server", data.toString().trim());
    });

    this.process.on("close", (code) => {
      log("info", "mlx-server", "MLX server exited", { code });
      this.process = null;
    });

    // Wait for server to become healthy (up to 60s for model loading)
    await this.waitForHealth(60_000);
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    log("info", "mlx-server", "Stopping MLX server", { pid: this.process.pid });
    this.process.kill("SIGTERM");

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill("SIGKILL");
        resolve();
      }, 5_000);

      this.process?.on("close", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.process = null;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.healthUrl);
      return res.ok;
    } catch {
      return false;
    }
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${this.opts.port}`;
  }

  private async waitForHealth(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.healthCheck()) {
        log("info", "mlx-server", "MLX server healthy");
        return;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    log("warn", "mlx-server", "Health check timeout — server may still be loading");
  }
}

/**
 * Singleton check used by AI Router to determine local availability.
 */
export async function isLocalAvailable(port: number = 8081): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`);
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mlx-server.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/mlx/server.ts apps/agent-bridge/tests/mlx-server.test.ts
git commit -m "feat: add MLX server process manager with health check and isLocalAvailable"
```

---

## Task 3: OpenAI-Compatible API Proxy

**Files:**
- Create: `apps/agent-bridge/src/mlx/proxy.ts`
- Create: `apps/agent-bridge/tests/mlx-proxy.test.ts`

- [ ] **Step 1: Write failing tests for proxy**

Create `apps/agent-bridge/tests/mlx-proxy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { proxyToMlx } from "../src/mlx/proxy";

describe("proxyToMlx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards chat completion request to MLX server", async () => {
    const mlxResponse = {
      id: "chatcmpl-1",
      object: "chat.completion",
      choices: [{ message: { role: "assistant", content: "Hello!" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mlxResponse,
      headers: new Headers({ "content-type": "application/json" }),
    });

    const body = {
      model: "hermes-3-8b",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 512,
    };

    const result = await proxyToMlx("http://127.0.0.1:8081", body);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8081/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    expect(result.choices[0].message.content).toBe("Hello!");
  });

  it("throws when MLX server returns error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const body = { model: "hermes-3-8b", messages: [], max_tokens: 512 };

    await expect(proxyToMlx("http://127.0.0.1:8081", body)).rejects.toThrow(
      "MLX proxy error: 500"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mlx-proxy.test.ts
```

Expected: FAIL — "Cannot find module '../src/mlx/proxy'"

- [ ] **Step 3: Implement proxy**

Create `apps/agent-bridge/src/mlx/proxy.ts`:

```typescript
import { log } from "../lib/logger";

interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
  };
}

/**
 * Forward an OpenAI-compatible chat completion request to the local MLX server.
 * The MLX server (mlx-lm serve) exposes an OpenAI-compatible API at /v1/chat/completions.
 */
export async function proxyToMlx(
  baseUrl: string,
  body: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const url = `${baseUrl}/v1/chat/completions`;

  log("debug", "mlx-proxy", "Forwarding request to MLX", {
    model: body.model,
    messageCount: body.messages.length,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    log("error", "mlx-proxy", "MLX server error", { status: res.status, body: errText });
    throw new Error(`MLX proxy error: ${res.status}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;

  log("debug", "mlx-proxy", "MLX response received", {
    tokens: data.usage?.total_tokens,
  });

  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mlx-proxy.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/mlx/proxy.ts apps/agent-bridge/tests/mlx-proxy.test.ts
git commit -m "feat: add OpenAI-compatible API proxy for MLX server"
```

---

## Task 4: mlx-whisper Transcription Wrapper

**Files:**
- Create: `apps/agent-bridge/src/mlx/whisper.ts`
- Create: `apps/agent-bridge/tests/whisper.test.ts`

- [ ] **Step 1: Write failing tests for whisper wrapper**

Create `apps/agent-bridge/tests/whisper.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

import { transcribe, type TranscribeResult } from "../src/mlx/whisper";

function createMockProcess(stdout: string, exitCode: number = 0) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  // Simulate async output
  setTimeout(() => {
    proc.stdout.emit("data", Buffer.from(stdout));
    proc.emit("close", exitCode);
  }, 10);

  return proc;
}

describe("transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs mlx_whisper with correct arguments", async () => {
    const output = JSON.stringify({
      text: "회의 내용입니다.",
      segments: [{ start: 0, end: 3.5, text: "회의 내용입니다." }],
    });
    mockSpawn.mockReturnValue(createMockProcess(output));

    await transcribe("/tmp/audio.m4a", { model: "large-v3", language: "ko" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "python",
      [
        "-m", "mlx_whisper",
        "--model", "large-v3",
        "--language", "ko",
        "--output-format", "json",
        "/tmp/audio.m4a",
      ],
      expect.any(Object)
    );
  });

  it("returns transcription text and segments", async () => {
    const output = JSON.stringify({
      text: "테스트 전사 결과",
      segments: [
        { start: 0, end: 2.0, text: "테스트" },
        { start: 2.0, end: 4.0, text: "전사 결과" },
      ],
    });
    mockSpawn.mockReturnValue(createMockProcess(output));

    const result = await transcribe("/tmp/audio.m4a", {
      model: "large-v3",
      language: "ko",
    });

    expect(result.text).toBe("테스트 전사 결과");
    expect(result.segments).toHaveLength(2);
  });

  it("rejects when process exits with non-zero code", async () => {
    mockSpawn.mockReturnValue(createMockProcess("", 1));

    await expect(
      transcribe("/tmp/bad.m4a", { model: "large-v3", language: "ko" })
    ).rejects.toThrow("mlx-whisper exited with code 1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/whisper.test.ts
```

Expected: FAIL — "Cannot find module '../src/mlx/whisper'"

- [ ] **Step 3: Implement whisper wrapper**

Create `apps/agent-bridge/src/mlx/whisper.ts`:

```typescript
import { spawn } from "node:child_process";
import { log } from "../lib/logger";

export interface TranscribeOptions {
  model: string;
  language: string;
}

export interface TranscribeSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResult {
  text: string;
  segments: TranscribeSegment[];
}

/**
 * Transcribe an audio file using mlx-whisper (Apple Silicon native).
 * Runs as a Python subprocess: python -m mlx_whisper --model MODEL --language LANG --output-format json FILE
 */
export async function transcribe(
  audioPath: string,
  opts: TranscribeOptions
): Promise<TranscribeResult> {
  log("info", "whisper", "Starting transcription", {
    audioPath,
    model: opts.model,
    language: opts.language,
  });

  return new Promise<TranscribeResult>((resolve, reject) => {
    const args = [
      "-m", "mlx_whisper",
      "--model", opts.model,
      "--language", opts.language,
      "--output-format", "json",
      audioPath,
    ];

    const proc = spawn("python", args, { stdio: "pipe" });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        log("error", "whisper", "Transcription failed", { code, stderr });
        reject(new Error(`mlx-whisper exited with code ${code}`));
        return;
      }

      try {
        const result = JSON.parse(stdout) as TranscribeResult;
        log("info", "whisper", "Transcription complete", {
          textLength: result.text.length,
          segmentCount: result.segments.length,
        });
        resolve(result);
      } catch (parseErr) {
        log("error", "whisper", "Failed to parse whisper output", { stdout });
        reject(new Error("Failed to parse mlx-whisper JSON output"));
      }
    });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/whisper.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/mlx/whisper.ts apps/agent-bridge/tests/whisper.test.ts
git commit -m "feat: add mlx-whisper async transcription wrapper for local Korean STT"
```

---

## Task 5: .claude-mq/ File Watcher + Status

**Files:**
- Create: `apps/agent-bridge/src/mq/status.ts`
- Create: `apps/agent-bridge/src/mq/watcher.ts`
- Create: `apps/agent-bridge/tests/mq-watcher.test.ts`

- [ ] **Step 1: Write failing tests for MQ watcher**

Create `apps/agent-bridge/tests/mq-watcher.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { MqStatus, readStatus, writeStatus } from "../src/mq/status";

describe("MqStatus", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mq-test-"));
    await fs.mkdir(path.join(tmpDir, "inbox"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "outbox"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "archive"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("writeStatus / readStatus", () => {
    it("writes and reads status.json correctly", async () => {
      const status: MqStatus = {
        currentTask: null,
        pendingTasks: 0,
        completedTasks: 5,
        lastActivity: new Date().toISOString(),
        agentAvailable: true,
      };

      await writeStatus(tmpDir, status);
      const read = await readStatus(tmpDir);

      expect(read.completedTasks).toBe(5);
      expect(read.agentAvailable).toBe(true);
    });
  });

  describe("readStatus", () => {
    it("returns default status when file does not exist", async () => {
      const status = await readStatus(tmpDir);
      expect(status.pendingTasks).toBe(0);
      expect(status.agentAvailable).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mq-watcher.test.ts
```

Expected: FAIL — "Cannot find module '../src/mq/status'"

- [ ] **Step 3: Implement status module**

Create `apps/agent-bridge/src/mq/status.ts`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { log } from "../lib/logger";

export interface MqStatus {
  currentTask: string | null;
  pendingTasks: number;
  completedTasks: number;
  lastActivity: string;
  agentAvailable: boolean;
}

const STATUS_FILE = "status.json";

export async function readStatus(mqDir: string): Promise<MqStatus> {
  const filePath = path.join(mqDir, STATUS_FILE);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as MqStatus;
  } catch {
    return {
      currentTask: null,
      pendingTasks: 0,
      completedTasks: 0,
      lastActivity: new Date().toISOString(),
      agentAvailable: false,
    };
  }
}

export async function writeStatus(
  mqDir: string,
  status: MqStatus
): Promise<void> {
  const filePath = path.join(mqDir, STATUS_FILE);
  await fs.writeFile(filePath, JSON.stringify(status, null, 2), "utf-8");
  log("debug", "mq-status", "Status updated", { status });
}
```

- [ ] **Step 4: Implement file watcher**

Create `apps/agent-bridge/src/mq/watcher.ts`:

```typescript
import { watch, type FSWatcher } from "chokidar";
import * as path from "node:path";
import { log } from "../lib/logger";

export type MqEventType = "result" | "question";

export interface MqEvent {
  type: MqEventType;
  filePath: string;
  taskId: string;
}

export type MqEventHandler = (event: MqEvent) => void | Promise<void>;

/**
 * Watch the .claude-mq/outbox/ directory for new result and question files.
 *
 * File naming conventions:
 * - {taskId}_result.md   → completed task result
 * - {taskId}_question.md → agent needs clarification
 */
export class MqWatcher {
  private watcher: FSWatcher | null = null;
  private readonly outboxDir: string;
  private handler: MqEventHandler | null = null;

  constructor(mqDir: string) {
    this.outboxDir = path.join(mqDir, "outbox");
  }

  onEvent(handler: MqEventHandler): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    log("info", "mq-watcher", "Starting file watcher", { dir: this.outboxDir });

    this.watcher = watch(this.outboxDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    this.watcher.on("add", (filePath: string) => {
      const fileName = path.basename(filePath);
      const event = this.parseFileName(fileName, filePath);
      if (event && this.handler) {
        log("info", "mq-watcher", "New file detected", { fileName, type: event.type });
        void this.handler(event);
      }
    });

    this.watcher.on("error", (err) => {
      log("error", "mq-watcher", "Watcher error", { error: String(err) });
    });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      log("info", "mq-watcher", "File watcher stopped");
    }
  }

  private parseFileName(fileName: string, filePath: string): MqEvent | null {
    const resultMatch = fileName.match(/^(.+)_result\.md$/);
    if (resultMatch) {
      return { type: "result", filePath, taskId: resultMatch[1] };
    }

    const questionMatch = fileName.match(/^(.+)_question\.md$/);
    if (questionMatch) {
      return { type: "question", filePath, taskId: questionMatch[1] };
    }

    return null;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mq-watcher.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/mq/ apps/agent-bridge/tests/mq-watcher.test.ts
git commit -m "feat: add .claude-mq/ status management and Chokidar file watcher"
```

---

## Task 6: MQ Task Submission + Result Collection

**Files:**
- Create: `apps/agent-bridge/src/mq/task.ts`
- Create: `apps/agent-bridge/src/mq/result.ts`
- Create: `apps/agent-bridge/src/mq/question.ts`
- Create: `apps/agent-bridge/tests/mq-task.test.ts`

- [ ] **Step 1: Write failing tests for task/result**

Create `apps/agent-bridge/tests/mq-task.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { submitTask, type TaskInput } from "../src/mq/task";
import { collectResult } from "../src/mq/result";
import { writeAnswer, readQuestion } from "../src/mq/question";

describe("MQ Task/Result/Question", () => {
  let tmpDir: string;
  let inboxDir: string;
  let outboxDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mq-task-test-"));
    inboxDir = path.join(tmpDir, "inbox");
    outboxDir = path.join(tmpDir, "outbox");
    await fs.mkdir(inboxDir, { recursive: true });
    await fs.mkdir(outboxDir, { recursive: true });
    await fs.mkdir(path.join(tmpDir, "archive"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("submitTask", () => {
    it("creates a task file in inbox/", async () => {
      const input: TaskInput = {
        taskType: "BUSINESS_PLAN",
        prompt: "Write a business plan for...",
        context: { clientName: "Test Corp" },
      };

      const taskId = await submitTask(tmpDir, input);

      const files = await fs.readdir(inboxDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(new RegExp(`^${taskId}_task\\.md$`));

      const content = await fs.readFile(path.join(inboxDir, files[0]), "utf-8");
      expect(content).toContain("BUSINESS_PLAN");
      expect(content).toContain("Test Corp");
    });
  });

  describe("collectResult", () => {
    it("reads result file from outbox/ and returns content", async () => {
      const taskId = "test-123";
      const resultContent = "# Result\n\nBusiness plan generated successfully.";
      await fs.writeFile(
        path.join(outboxDir, `${taskId}_result.md`),
        resultContent,
        "utf-8"
      );

      const result = await collectResult(tmpDir, taskId);

      expect(result).toBe(resultContent);
    });

    it("returns null when result file does not exist", async () => {
      const result = await collectResult(tmpDir, "nonexistent-task");
      expect(result).toBeNull();
    });
  });

  describe("question/answer", () => {
    it("reads question and writes answer", async () => {
      const taskId = "q-456";
      const questionContent = "What is the target market?";
      await fs.writeFile(
        path.join(outboxDir, `${taskId}_question.md`),
        questionContent,
        "utf-8"
      );

      const question = await readQuestion(tmpDir, taskId);
      expect(question).toBe(questionContent);

      await writeAnswer(tmpDir, taskId, "B2B SaaS for consultants");

      const answerPath = path.join(inboxDir, `${taskId}_answer.md`);
      const answer = await fs.readFile(answerPath, "utf-8");
      expect(answer).toBe("B2B SaaS for consultants");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mq-task.test.ts
```

Expected: FAIL — "Cannot find module '../src/mq/task'"

- [ ] **Step 3: Implement task submission**

Create `apps/agent-bridge/src/mq/task.ts`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { log } from "../lib/logger";

export interface TaskInput {
  taskType: string;
  prompt: string;
  context?: Record<string, unknown>;
}

/**
 * Submit a task to the .claude-mq/ inbox.
 * Creates a {taskId}_task.md file that Claude CLI will pick up.
 */
export async function submitTask(
  mqDir: string,
  input: TaskInput
): Promise<string> {
  const taskId = uuidv4();
  const fileName = `${taskId}_task.md`;
  const filePath = path.join(mqDir, "inbox", fileName);

  const content = [
    `# Task: ${input.taskType}`,
    ``,
    `## Task ID`,
    taskId,
    ``,
    `## Type`,
    input.taskType,
    ``,
    `## Prompt`,
    input.prompt,
    ``,
    ...(input.context
      ? [`## Context`, "```json", JSON.stringify(input.context, null, 2), "```"]
      : []),
    ``,
    `## Submitted`,
    new Date().toISOString(),
  ].join("\n");

  await fs.writeFile(filePath, content, "utf-8");

  log("info", "mq-task", "Task submitted", { taskId, type: input.taskType });

  return taskId;
}
```

- [ ] **Step 4: Implement result collection**

Create `apps/agent-bridge/src/mq/result.ts`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { log } from "../lib/logger";

/**
 * Collect a result from the .claude-mq/ outbox.
 * Returns the file content or null if not found.
 */
export async function collectResult(
  mqDir: string,
  taskId: string
): Promise<string | null> {
  const filePath = path.join(mqDir, "outbox", `${taskId}_result.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    log("info", "mq-result", "Result collected", { taskId });
    return content;
  } catch {
    return null;
  }
}

/**
 * Archive a completed task's result file.
 * Moves from outbox/ to archive/.
 */
export async function archiveResult(
  mqDir: string,
  taskId: string
): Promise<void> {
  const src = path.join(mqDir, "outbox", `${taskId}_result.md`);
  const dest = path.join(mqDir, "archive", `${taskId}_result.md`);

  try {
    await fs.rename(src, dest);
    log("info", "mq-result", "Result archived", { taskId });
  } catch {
    log("warn", "mq-result", "Failed to archive result", { taskId });
  }
}
```

- [ ] **Step 5: Implement question handling**

Create `apps/agent-bridge/src/mq/question.ts`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { log } from "../lib/logger";

/**
 * Read a question from the .claude-mq/ outbox.
 * Claude CLI writes *_question.md when it needs clarification.
 */
export async function readQuestion(
  mqDir: string,
  taskId: string
): Promise<string | null> {
  const filePath = path.join(mqDir, "outbox", `${taskId}_question.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    log("info", "mq-question", "Question read", { taskId });
    return content;
  } catch {
    return null;
  }
}

/**
 * Write an answer to the .claude-mq/ inbox.
 * The agent picks up *_answer.md to continue its task.
 */
export async function writeAnswer(
  mqDir: string,
  taskId: string,
  answer: string
): Promise<void> {
  const filePath = path.join(mqDir, "inbox", `${taskId}_answer.md`);
  await fs.writeFile(filePath, answer, "utf-8");
  log("info", "mq-question", "Answer written", { taskId });
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/mq-task.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/mq/task.ts apps/agent-bridge/src/mq/result.ts apps/agent-bridge/src/mq/question.ts apps/agent-bridge/tests/mq-task.test.ts
git commit -m "feat: add .claude-mq/ task submission, result collection, and question handling"
```

---

## Task 7: SkillPattern Collector

**Files:**
- Create: `apps/agent-bridge/src/skill-pattern/collector.ts`
- Create: `apps/agent-bridge/tests/skill-pattern.test.ts`

- [ ] **Step 1: Write failing tests for SkillPattern collector**

Create `apps/agent-bridge/tests/skill-pattern.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    skillPattern: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

import { collectPattern, type AiJobForPattern } from "../src/skill-pattern/collector";

describe("SkillPattern Collector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments successCount when matching pattern exists", async () => {
    const existingPattern = {
      id: "pattern-1",
      name: "journal-draft",
      taskType: "JOURNAL_DRAFT",
      successCount: 5,
    };
    mockFindFirst.mockResolvedValue(existingPattern);
    mockUpdate.mockResolvedValue({ ...existingPattern, successCount: 6 });

    const job: AiJobForPattern = {
      id: "job-1",
      type: "JOURNAL_DRAFT",
      tier: "LOCAL_MLX",
      input: { prompt: "Write journal for March" },
      output: { text: "연구 일지 3월..." },
      durationMs: 3000,
    };

    const result = await collectPattern(job, 10);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "pattern-1" },
      data: expect.objectContaining({
        successCount: 6,
      }),
    });
    expect(result.isNewPattern).toBe(false);
    expect(result.readyForFineTune).toBe(false);
  });

  it("creates new pattern when no match exists", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "pattern-new", successCount: 1 });

    const job: AiJobForPattern = {
      id: "job-2",
      type: "SUMMARY",
      tier: "API_HAIKU",
      input: { prompt: "Summarize meeting" },
      output: { text: "Meeting summary..." },
      durationMs: 2000,
    };

    const result = await collectPattern(job, 10);

    expect(mockCreate).toHaveBeenCalled();
    expect(result.isNewPattern).toBe(true);
  });

  it("flags pattern for fine-tuning when threshold reached", async () => {
    const existingPattern = {
      id: "pattern-2",
      name: "summary-meeting",
      taskType: "SUMMARY",
      successCount: 9,
    };
    mockFindFirst.mockResolvedValue(existingPattern);
    mockUpdate.mockResolvedValue({ ...existingPattern, successCount: 10 });

    const job: AiJobForPattern = {
      id: "job-3",
      type: "SUMMARY",
      tier: "API_HAIKU",
      input: { prompt: "Summarize" },
      output: { text: "Summary" },
      durationMs: 1500,
    };

    const result = await collectPattern(job, 10);

    expect(result.readyForFineTune).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/skill-pattern.test.ts
```

Expected: FAIL — "Cannot find module '../src/skill-pattern/collector'"

- [ ] **Step 3: Implement SkillPattern collector**

Create `apps/agent-bridge/src/skill-pattern/collector.ts`:

```typescript
import { prisma } from "@axle/db";
import { log } from "../lib/logger";

export interface AiJobForPattern {
  id: string;
  type: string;
  tier: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  durationMs: number | null;
}

export interface CollectResult {
  patternId: string;
  isNewPattern: boolean;
  readyForFineTune: boolean;
  successCount: number;
}

/**
 * After an AiJob completes successfully, extract input/output patterns.
 * - If a matching SkillPattern exists (by taskType), increment successCount.
 * - If not, create a new SkillPattern.
 * - Flag patterns with successCount >= threshold for fine-tuning.
 */
export async function collectPattern(
  job: AiJobForPattern,
  finetuneThreshold: number
): Promise<CollectResult> {
  // Try to find existing pattern for this task type
  const existing = await prisma.skillPattern.findFirst({
    where: { taskType: job.type },
  });

  if (existing) {
    const newCount = existing.successCount + 1;
    const readyForFineTune = newCount >= finetuneThreshold;

    await prisma.skillPattern.update({
      where: { id: existing.id },
      data: {
        successCount: newCount,
        lastUsedAt: new Date(),
        ...(readyForFineTune && !existing.isFineTuned
          ? {} // Fine-tuning flagging is handled externally
          : {}),
      },
    });

    log("info", "skill-pattern", "Pattern updated", {
      patternId: existing.id,
      taskType: job.type,
      successCount: newCount,
      readyForFineTune,
    });

    return {
      patternId: existing.id,
      isNewPattern: false,
      readyForFineTune,
      successCount: newCount,
    };
  }

  // Create new pattern
  const inputSchema = extractSchema(job.input);
  const outputSchema = job.output ? extractSchema(job.output) : {};

  const created = await prisma.skillPattern.create({
    data: {
      name: `${job.type.toLowerCase()}-auto`,
      taskType: job.type,
      inputSchema,
      outputSchema,
      successCount: 1,
      lastUsedAt: new Date(),
    },
  });

  log("info", "skill-pattern", "New pattern created", {
    patternId: created.id,
    taskType: job.type,
  });

  return {
    patternId: created.id,
    isNewPattern: true,
    readyForFineTune: false,
    successCount: 1,
  };
}

/**
 * Extract a simplified schema from a JSON object.
 * Records top-level keys and their types.
 */
function extractSchema(obj: Record<string, unknown>): Record<string, string> {
  const schema: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    schema[key] = Array.isArray(value)
      ? "array"
      : value === null
        ? "null"
        : typeof value;
  }
  return schema;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/skill-pattern.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/skill-pattern/ apps/agent-bridge/tests/skill-pattern.test.ts
git commit -m "feat: add SkillPattern collector for AI job pattern extraction and fine-tune flagging"
```

---

## Task 8: Express Routes (Health, AI, Transcribe)

**Files:**
- Create: `apps/agent-bridge/src/routes/health.ts`
- Create: `apps/agent-bridge/src/routes/ai.ts`
- Create: `apps/agent-bridge/src/routes/transcribe.ts`
- Create: `apps/agent-bridge/tests/routes-health.test.ts`
- Create: `apps/agent-bridge/tests/routes-ai.test.ts`

- [ ] **Step 1: Write failing tests for health route**

Create `apps/agent-bridge/tests/routes-health.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock MLX server
vi.mock("../src/mlx/server", () => ({
  isLocalAvailable: vi.fn().mockResolvedValue(true),
}));

import { healthRouter } from "../src/routes/health";

describe("GET /health", () => {
  const app = express();
  app.use("/health", healthRouter);

  it("returns 200 with status fields", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("mlxAvailable");
    expect(res.body).toHaveProperty("timestamp");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/routes-health.test.ts
```

Expected: FAIL — "Cannot find module '../src/routes/health'"

- [ ] **Step 3: Implement health route**

Create `apps/agent-bridge/src/routes/health.ts`:

```typescript
import { Router } from "express";
import { isLocalAvailable } from "../mlx/server";

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get("/", async (_req, res) => {
  const mlxAvailable = await isLocalAvailable();

  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    mlxAvailable,
    timestamp: new Date().toISOString(),
  });
});
```

- [ ] **Step 4: Write failing tests for AI route**

Create `apps/agent-bridge/tests/routes-ai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../src/mlx/proxy", () => ({
  proxyToMlx: vi.fn().mockResolvedValue({
    id: "cmpl-1",
    choices: [{ message: { role: "assistant", content: "Generated text" } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  }),
}));

vi.mock("../src/mlx/server", () => ({
  isLocalAvailable: vi.fn().mockResolvedValue(true),
  MlxServer: vi.fn(),
}));

vi.mock("../src/mq/task", () => ({
  submitTask: vi.fn().mockResolvedValue("task-uuid-123"),
}));

vi.mock("../src/mq/result", () => ({
  collectResult: vi.fn().mockResolvedValue(null),
}));

vi.mock("../src/skill-pattern/collector", () => ({
  collectPattern: vi.fn().mockResolvedValue({
    patternId: "p1",
    isNewPattern: false,
    readyForFineTune: false,
    successCount: 3,
  }),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    aiJob: {
      create: vi.fn().mockResolvedValue({ id: "job-1" }),
      findUnique: vi.fn().mockResolvedValue({
        id: "job-1",
        status: "RUNNING",
        type: "JOURNAL_DRAFT",
        tier: "LOCAL_MLX",
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    skillPattern: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "sp-1" }),
    },
  },
}));

import { createAiRouter } from "../src/routes/ai";

describe("AI Routes", () => {
  const app = express();
  app.use(express.json());

  const aiRouter = createAiRouter({
    mlxBaseUrl: "http://127.0.0.1:8081",
    claudeMqDir: "/tmp/test-mq",
    finetuneThreshold: 10,
  });
  app.use("/api/ai", aiRouter);

  describe("POST /api/ai/run", () => {
    it("accepts a job and returns jobId", async () => {
      const res = await request(app)
        .post("/api/ai/run")
        .send({
          type: "JOURNAL_DRAFT",
          prompt: "Write journal entry",
          projectId: "proj-1",
        });

      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty("jobId");
    });

    it("returns 400 for missing type", async () => {
      const res = await request(app)
        .post("/api/ai/run")
        .send({ prompt: "test" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/ai/status/:jobId", () => {
    it("returns job status", async () => {
      const res = await request(app).get("/api/ai/status/job-1");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
    });
  });
});
```

- [ ] **Step 5: Implement AI route**

Create `apps/agent-bridge/src/routes/ai.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@axle/db";
import { proxyToMlx } from "../mlx/proxy";
import { isLocalAvailable } from "../mlx/server";
import { submitTask } from "../mq/task";
import { collectResult } from "../mq/result";
import { collectPattern } from "../skill-pattern/collector";
import { log } from "../lib/logger";

const aiRunSchema = z.object({
  type: z.enum([
    "BUSINESS_PLAN", "RESEARCH", "OCR", "TRANSCRIBE",
    "SUMMARY", "JOURNAL_DRAFT", "FINANCIAL_ANALYSIS",
    "GAP_DIAGNOSIS", "EVALUATION", "MATCHING",
  ]),
  prompt: z.string().min(1),
  projectId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

interface AiRouterConfig {
  mlxBaseUrl: string;
  claudeMqDir: string;
  finetuneThreshold: number;
}

export function createAiRouter(config: AiRouterConfig): Router {
  const router = Router();

  /**
   * POST /api/ai/run — Submit an AI job.
   * Routes to the correct tier based on job type.
   */
  router.post("/run", async (req, res) => {
    const parsed = aiRunSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { type, prompt, projectId, context } = parsed.data;

    // Determine tier
    const tier = await resolveAiTier(type);

    // Create AiJob record
    const job = await prisma.aiJob.create({
      data: {
        type,
        tier,
        status: "QUEUED",
        input: { prompt, ...(context ?? {}) },
        ...(projectId ? { projectId } : {}),
      },
    });

    log("info", "ai-route", "Job created", { jobId: job.id, type, tier });

    // Fire-and-forget execution based on tier
    void executeJob(job.id, type, tier, prompt, context ?? {}, config);

    res.status(202).json({ jobId: job.id, tier, status: "QUEUED" });
  });

  /**
   * GET /api/ai/status/:jobId — Check job status.
   */
  router.get("/status/:jobId", async (req, res) => {
    const { jobId } = req.params;

    const job = await prisma.aiJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        type: true,
        tier: true,
        status: true,
        output: true,
        errorMessage: true,
        durationMs: true,
        createdAt: true,
      },
    });

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json(job);
  });

  return router;
}

/**
 * Resolve AI tier based on job type and local availability.
 */
async function resolveAiTier(jobType: string): Promise<string> {
  const localAvailable = await isLocalAvailable();

  switch (jobType) {
    case "BUSINESS_PLAN":
    case "RESEARCH":
      return "CLI_CLAUDE";

    case "JOURNAL_DRAFT":
    case "SUMMARY":
    case "OCR":
    case "TRANSCRIBE":
      return localAvailable ? "LOCAL_MLX" : "API_HAIKU";

    case "FINANCIAL_ANALYSIS":
    case "GAP_DIAGNOSIS":
    case "EVALUATION":
    case "MATCHING":
      return "API_HAIKU";

    default:
      return "API_HAIKU";
  }
}

/**
 * Execute an AI job asynchronously based on its tier.
 */
async function executeJob(
  jobId: string,
  type: string,
  tier: string,
  prompt: string,
  context: Record<string, unknown>,
  config: AiRouterConfig
): Promise<void> {
  const startTime = Date.now();

  try {
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: "RUNNING" },
    });

    let output: Record<string, unknown>;

    switch (tier) {
      case "LOCAL_MLX": {
        const result = await proxyToMlx(config.mlxBaseUrl, {
          model: "hermes-3-8b",
          messages: [
            { role: "system", content: "You are a helpful assistant for Korean business consulting." },
            { role: "user", content: prompt },
          ],
          max_tokens: 4096,
        });
        output = { text: result.choices[0]?.message.content ?? "", usage: result.usage };
        break;
      }

      case "CLI_CLAUDE": {
        const taskId = await submitTask(config.claudeMqDir, {
          taskType: type,
          prompt,
          context,
        });
        // CLI_CLAUDE jobs are async — result comes via MQ watcher
        output = { taskId, note: "Submitted to Claude CLI via .claude-mq/" };
        break;
      }

      case "API_HAIKU":
      case "API_OPUS":
      default: {
        // API tier is handled by packages/ai on the web side
        // agent-bridge only handles LOCAL_MLX and CLI_CLAUDE
        output = { note: `API tier ${tier} should be handled by packages/ai` };
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        output,
        durationMs,
      },
    });

    // Collect pattern after successful completion
    await collectPattern(
      {
        id: jobId,
        type,
        tier,
        input: { prompt, ...context },
        output,
        durationMs,
      },
      config.finetuneThreshold
    );

    log("info", "ai-route", "Job completed", { jobId, tier, durationMs });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage,
        durationMs: Date.now() - startTime,
      },
    });

    log("error", "ai-route", "Job failed", { jobId, error: errorMessage });
  }
}
```

- [ ] **Step 6: Implement transcribe route**

Create `apps/agent-bridge/src/routes/transcribe.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { transcribe } from "../mlx/whisper";
import { log } from "../lib/logger";

const transcribeSchema = z.object({
  audioPath: z.string().min(1),
  model: z.string().default("large-v3"),
  language: z.string().default("ko"),
});

interface TranscribeRouterConfig {
  whisperModel: string;
  whisperLanguage: string;
}

export function createTranscribeRouter(config: TranscribeRouterConfig): Router {
  const router = Router();

  /**
   * POST /api/ai/transcribe — Transcribe audio file using mlx-whisper.
   * Expects { audioPath: string } in request body.
   */
  router.post("/", async (req, res) => {
    const parsed = transcribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { audioPath, model, language } = parsed.data;

    log("info", "transcribe-route", "Transcription requested", { audioPath });

    try {
      const result = await transcribe(audioPath, {
        model: model ?? config.whisperModel,
        language: language ?? config.whisperLanguage,
      });

      res.json({
        text: result.text,
        segments: result.segments,
        audioPath,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log("error", "transcribe-route", "Transcription failed", { error: errorMessage });
      res.status(500).json({ error: "Transcription failed", message: errorMessage });
    }
  });

  return router;
}
```

- [ ] **Step 7: Run all route tests**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run tests/routes-health.test.ts tests/routes-ai.test.ts
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/routes/ apps/agent-bridge/tests/routes-health.test.ts apps/agent-bridge/tests/routes-ai.test.ts
git commit -m "feat: add Express routes — health check, AI job runner, and transcription endpoint"
```

---

## Task 9: Server Entry Point + launchd Service

**Files:**
- Create: `apps/agent-bridge/src/index.ts`
- Create: `apps/agent-bridge/scripts/com.axle.agent-bridge.plist`

- [ ] **Step 1: Create Express server entry point**

Create `apps/agent-bridge/src/index.ts`:

```typescript
import express from "express";
import { loadConfig } from "./config";
import { MlxServer } from "./mlx/server";
import { MqWatcher } from "./mq/watcher";
import { writeStatus } from "./mq/status";
import { collectResult, archiveResult } from "./mq/result";
import { healthRouter } from "./routes/health";
import { createAiRouter } from "./routes/ai";
import { createTranscribeRouter } from "./routes/transcribe";
import { log } from "./lib/logger";

const config = loadConfig();

// Initialize Express
const app = express();
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/health", healthRouter);
app.use("/api/ai", createAiRouter({
  mlxBaseUrl: `http://127.0.0.1:${config.mlxPort}`,
  claudeMqDir: config.claudeMqDir,
  finetuneThreshold: config.skillPatternFinetuneThreshold,
}));
app.use("/api/ai/transcribe", createTranscribeRouter({
  whisperModel: config.whisperModel,
  whisperLanguage: config.whisperLanguage,
}));

// Initialize MLX Server
const mlxServer = new MlxServer({
  modelPath: config.mlxModelPath,
  port: config.mlxPort,
  maxTokens: config.mlxMaxTokens,
});

// Initialize MQ Watcher
const mqWatcher = new MqWatcher(config.claudeMqDir);

mqWatcher.onEvent(async (event) => {
  log("info", "main", "MQ event received", { type: event.type, taskId: event.taskId });

  if (event.type === "result") {
    const result = await collectResult(config.claudeMqDir, event.taskId);
    if (result) {
      log("info", "main", "Result collected from Claude CLI", {
        taskId: event.taskId,
        length: result.length,
      });
      await archiveResult(config.claudeMqDir, event.taskId);
    }
  }

  if (event.type === "question") {
    log("info", "main", "Question received from Claude CLI — needs manual answer or API notification", {
      taskId: event.taskId,
    });
    // TODO: Send notification via packages/notification
  }
});

// Startup sequence
async function start(): Promise<void> {
  log("info", "main", "Starting AXLE Agent Bridge", { port: config.port });

  // Ensure MQ directories exist
  const { mkdir } = await import("node:fs/promises");
  await mkdir(`${config.claudeMqDir}/inbox`, { recursive: true });
  await mkdir(`${config.claudeMqDir}/outbox`, { recursive: true });
  await mkdir(`${config.claudeMqDir}/archive`, { recursive: true });

  // Start MLX server (non-blocking — may take time to load model)
  mlxServer.start().catch((err) => {
    log("warn", "main", "MLX server failed to start — running without local LLM", {
      error: String(err),
    });
  });

  // Start MQ watcher
  await mqWatcher.start();

  // Update MQ status
  await writeStatus(config.claudeMqDir, {
    currentTask: null,
    pendingTasks: 0,
    completedTasks: 0,
    lastActivity: new Date().toISOString(),
    agentAvailable: true,
  });

  // Start Express server
  app.listen(config.port, config.host, () => {
    log("info", "main", `Agent Bridge listening on ${config.host}:${config.port}`);
  });
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  log("info", "main", "Shutting down...");
  await mqWatcher.stop();
  await mlxServer.stop();
  await writeStatus(config.claudeMqDir, {
    currentTask: null,
    pendingTasks: 0,
    completedTasks: 0,
    lastActivity: new Date().toISOString(),
    agentAvailable: false,
  });
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((err) => {
  log("error", "main", "Fatal startup error", { error: String(err) });
  process.exit(1);
});
```

- [ ] **Step 2: Create launchd service file**

Create `apps/agent-bridge/scripts/com.axle.agent-bridge.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.axle.agent-bridge</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Volumes/포터블/AX/axle/apps/agent-bridge/dist/index.js</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Volumes/포터블/AX/axle/apps/agent-bridge</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/axle-agent-bridge.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/axle-agent-bridge.stderr.log</string>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
```

- [ ] **Step 3: Verify build**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/agent-bridge/src/index.ts apps/agent-bridge/scripts/
git commit -m "feat: add server entry point with startup/shutdown and launchd service file"
```

---

## Task 10: Integration Verification

- [ ] **Step 1: Run all agent-bridge tests**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx vitest run
```

Expected: All tests pass (config: 2, mlx-server: 5, mlx-proxy: 2, whisper: 3, mq-watcher: 2, mq-task: 4, skill-pattern: 3, routes-health: 1, routes-ai: 3 = **25 total**).

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Verify Turborepo integration**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test --filter=@axle/agent-bridge
```

Expected: Test task completes successfully.

- [ ] **Step 4: Manual smoke test (if MLX installed)**

```bash
cd /Volumes/포터블/AX/axle/apps/agent-bridge
npm run dev
# In another terminal:
curl http://localhost:4100/health
```

Expected: `{"status":"ok","uptime":...,"mlxAvailable":false,"timestamp":"..."}`

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 14 complete — agent-bridge with MLX, MQ, AI Router, whisper, SkillPattern"
```

---

## Summary

Phase 14 delivers:
- **Express server** on Mac Mini (port 4100) with health check, AI job routing, and transcription endpoints
- **MLX server manager**: Start/stop/health-check for Hermes 3 8B via mlx-lm serve, `isLocalAvailable()` for AI Router
- **OpenAI-compatible proxy**: Forward requests to local MLX server at /v1/chat/completions
- **mlx-whisper wrapper**: Local Korean audio transcription via Python subprocess
- **.claude-mq/ bridge**: File-based MQ with Chokidar watcher, task submission (inbox/), result collection (outbox/), question/answer handling, status.json tracking
- **AI Router HTTP API**: POST /api/ai/run (routes to LOCAL_MLX, CLI_CLAUDE, or API tiers), GET /api/ai/status/:jobId
- **SkillPattern collector**: Extract patterns from completed AiJobs, track success count, flag for fine-tuning at threshold
- **launchd service file**: Auto-start on macOS boot

**Next:** Phase 15 (Desktop/Electron) builds on this to connect the desktop app to agent-bridge for local recording, certificate management, and portal automation.
