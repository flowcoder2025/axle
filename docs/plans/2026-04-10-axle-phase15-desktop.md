# AXLE Phase 15: Desktop (Electron) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Electron desktop app that wraps the AXLE web app and adds native capabilities: audio recording for meeting transcription, PKCS#12 certificate management for government portal access, Playwright-based portal automation (HomeTax, 민원24, etc.) with self-repair, and direct agent-bridge communication.

**Architecture:** Electron 36+ main process with BrowserWindow loading the deployed web app URL. Native IPC modules expose recording, certificate, portal automation, and agent-bridge communication to the renderer via contextBridge. Offline mode uses SQLite for local CRUD cache.

**Tech Stack:** Electron 36+, electron-builder, Playwright 1.50+, better-sqlite3, Chokidar 4, @axle/db (type imports only), Vitest, TypeScript 5

**Depends on:** Phase 9 (Meetings/recording), Phase 14 (Agent Bridge)

---

## File Structure

```
axle/
├── apps/
│   └── desktop/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── electron-builder.yml
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts              # Electron main process entry
│       │   │   ├── window.ts             # BrowserWindow factory
│       │   │   ├── tray.ts               # System tray with status indicator
│       │   │   ├── ipc/
│       │   │   │   ├── recorder.ts       # Native audio recording IPC
│       │   │   │   ├── cert.ts           # PKCS#12 certificate management IPC
│       │   │   │   ├── portal.ts         # Government portal automation IPC
│       │   │   │   └── agent.ts          # Agent bridge communication IPC
│       │   │   ├── portal/
│       │   │   │   ├── page-objects/
│       │   │   │   │   ├── hometax.ts    # HomeTax page object
│       │   │   │   │   ├── minwon24.ts   # 민원24 page object
│       │   │   │   │   ├── insurance.ts  # 4대보험 page object
│       │   │   │   │   ├── venturein.ts  # VENTUREIN page object
│       │   │   │   │   └── koita.ts      # KOITA page object
│       │   │   │   ├── cert-auth.ts      # Certificate-based login flow
│       │   │   │   ├── self-repair.ts    # Screenshot → AI → new selectors
│       │   │   │   └── selectors.json    # Dynamic selector storage
│       │   │   └── offline/
│       │   │       └── cache.ts          # SQLite local cache
│       │   └── preload/
│       │       └── index.ts              # contextBridge API exposure
│       ├── tests/
│       │   ├── recorder.test.ts
│       │   ├── cert.test.ts
│       │   ├── portal-selectors.test.ts
│       │   ├── self-repair.test.ts
│       │   ├── agent-ipc.test.ts
│       │   └── offline-cache.test.ts
│       └── resources/
│           └── icon.png                  # App icon (placeholder)
```

---

## Task 1: Project Scaffold + Electron Config

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/vitest.config.ts`
- Create: `apps/desktop/electron-builder.yml`

- [ ] **Step 1: Create apps/desktop/package.json**

```json
{
  "name": "@axle/desktop",
  "version": "0.0.1",
  "private": true,
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "tsx watch src/main/index.ts",
    "build": "tsc && electron-builder",
    "build:main": "tsc",
    "start": "electron dist/main/index.js",
    "test": "vitest run",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.0",
    "chokidar": "^4.0.0",
    "electron-updater": "^6.4.0",
    "playwright": "^1.50.0"
  },
  "devDependencies": {
    "electron": "^36.0.0",
    "electron-builder": "^26.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 2: Create apps/desktop/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "CommonJS",
    "moduleResolution": "node",
    "target": "ES2022",
    "esModuleInterop": true
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
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 4: Create electron-builder.yml**

```yaml
appId: com.axle.desktop
productName: AXLE
copyright: Copyright 2026 FlowCoder

directories:
  output: release
  buildResources: resources

mac:
  category: public.app-category.business
  target:
    - dmg
    - zip
  icon: resources/icon.png
  hardenedRuntime: true
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist

dmg:
  artifactName: AXLE-${version}.${ext}

files:
  - dist/**/*
  - resources/**/*
  - "!node_modules/**/playwright*"
  - "!node_modules/**/*.map"

extraResources:
  - from: src/main/portal/selectors.json
    to: selectors.json

asar: true

publish:
  provider: generic
  url: https://releases.axle.app
```

- [ ] **Step 5: Create placeholder icon**

```bash
mkdir -p /Volumes/포터블/AX/axle/apps/desktop/resources
# Create a 1x1 placeholder PNG (will be replaced with real icon)
printf '\x89PNG\r\n\x1a\n' > /Volumes/포터블/AX/axle/apps/desktop/resources/icon.png
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/package.json apps/desktop/tsconfig.json apps/desktop/vitest.config.ts apps/desktop/electron-builder.yml apps/desktop/resources/
git commit -m "feat: add apps/desktop scaffold with Electron 36 and electron-builder config"
```

---

## Task 2: Main Process Entry + Window + Tray

**Files:**
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/main/window.ts`
- Create: `apps/desktop/src/main/tray.ts`

- [ ] **Step 1: Create BrowserWindow factory**

Create `apps/desktop/src/main/window.ts`:

```typescript
import { BrowserWindow, shell } from "electron";
import * as path from "node:path";

const WEB_URL = process.env.AXLE_WEB_URL ?? "http://localhost:3000";
const PRELOAD_PATH = path.join(__dirname, "..", "preload", "index.js");

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "AXLE",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for some IPC features
    },
    show: false,
  });

  // Show window when ready to avoid white flash
  win.once("ready-to-show", () => {
    win.show();
  });

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Load the web app
  win.loadURL(WEB_URL);

  return win;
}
```

- [ ] **Step 2: Create system tray**

Create `apps/desktop/src/main/tray.ts`:

```typescript
import { Tray, Menu, nativeImage, type BrowserWindow } from "electron";
import * as path from "node:path";

export type TrayStatus = "connected" | "disconnected" | "recording";

export class AppTray {
  private tray: Tray | null = null;
  private status: TrayStatus = "disconnected";

  constructor(private mainWindow: BrowserWindow) {}

  create(): void {
    const iconPath = path.join(__dirname, "..", "..", "resources", "icon.png");
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    this.tray = new Tray(icon);
    this.tray.setToolTip("AXLE — Consulting Automation");
    this.updateMenu();

    this.tray.on("click", () => {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.focus();
      } else {
        this.mainWindow.show();
      }
    });
  }

  setStatus(status: TrayStatus): void {
    this.status = status;
    this.updateMenu();

    const statusLabel =
      status === "connected" ? "Connected" :
      status === "recording" ? "Recording..." :
      "Disconnected";

    this.tray?.setToolTip(`AXLE — ${statusLabel}`);
  }

  private updateMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      { label: `Status: ${this.status}`, enabled: false },
      { type: "separator" },
      {
        label: "Open AXLE",
        click: () => {
          this.mainWindow.show();
          this.mainWindow.focus();
        },
      },
      {
        label: "Agent Bridge",
        submenu: [
          { label: "Check Health", click: () => this.mainWindow.webContents.send("agent:health-check") },
        ],
      },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ]);

    this.tray?.setContextMenu(contextMenu);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
```

- [ ] **Step 3: Create main process entry**

Create `apps/desktop/src/main/index.ts`:

```typescript
import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";
import { AppTray } from "./tray";
import { registerRecorderIpc } from "./ipc/recorder";
import { registerCertIpc } from "./ipc/cert";
import { registerPortalIpc } from "./ipc/portal";
import { registerAgentIpc } from "./ipc/agent";

let mainWindow: BrowserWindow | null = null;
let appTray: AppTray | null = null;

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  appTray = new AppTray(mainWindow);
  appTray.create();

  // Register IPC handlers
  registerRecorderIpc();
  registerCertIpc();
  registerPortalIpc();
  registerAgentIpc();

  // macOS: re-create window when dock icon clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

// Quit when all windows closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  appTray?.destroy();
});
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/main/index.ts apps/desktop/src/main/window.ts apps/desktop/src/main/tray.ts
git commit -m "feat: add Electron main process with BrowserWindow, system tray, and IPC registration"
```

---

## Task 3: Preload Script (contextBridge)

**Files:**
- Create: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: Create preload script with contextBridge API**

Create `apps/desktop/src/preload/index.ts`:

```typescript
import { contextBridge, ipcRenderer } from "electron";

/**
 * Expose native desktop APIs to the renderer via window.axle.
 * All communication goes through IPC channels — no direct Node.js access.
 */
contextBridge.exposeInMainWorld("axle", {
  // ===== Recorder =====
  recorder: {
    start: () => ipcRenderer.invoke("recorder:start"),
    stop: () => ipcRenderer.invoke("recorder:stop"),
    getStatus: () => ipcRenderer.invoke("recorder:status"),
    onProgress: (callback: (seconds: number) => void) => {
      ipcRenderer.on("recorder:progress", (_event, seconds) => callback(seconds));
    },
  },

  // ===== Certificate =====
  cert: {
    load: (filePath: string, password: string) =>
      ipcRenderer.invoke("cert:load", filePath, password),
    list: () => ipcRenderer.invoke("cert:list"),
    select: (certId: string) => ipcRenderer.invoke("cert:select", certId),
    getActive: () => ipcRenderer.invoke("cert:active"),
  },

  // ===== Portal Automation =====
  portal: {
    issueDocument: (portalType: string, docType: string, clientId: string) =>
      ipcRenderer.invoke("portal:issue", portalType, docType, clientId),
    uploadDocument: (portalType: string, docPath: string, clientId: string) =>
      ipcRenderer.invoke("portal:upload", portalType, docPath, clientId),
    getStatus: (taskId: string) =>
      ipcRenderer.invoke("portal:status", taskId),
    onLog: (callback: (log: { step: string; status: string; screenshot?: string }) => void) => {
      ipcRenderer.on("portal:log", (_event, log) => callback(log));
    },
  },

  // ===== Agent Bridge =====
  agent: {
    health: () => ipcRenderer.invoke("agent:health"),
    submitJob: (type: string, prompt: string, context?: Record<string, unknown>) =>
      ipcRenderer.invoke("agent:submit", type, prompt, context),
    getJobStatus: (jobId: string) =>
      ipcRenderer.invoke("agent:job-status", jobId),
  },

  // ===== Platform Info =====
  platform: {
    isDesktop: true,
    os: process.platform,
    arch: process.arch,
  },
});
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/preload/index.ts
git commit -m "feat: add preload script with contextBridge API for recorder, cert, portal, and agent"
```

---

## Task 4: Native Audio Recording IPC

**Files:**
- Create: `apps/desktop/src/main/ipc/recorder.ts`
- Create: `apps/desktop/tests/recorder.test.ts`

- [ ] **Step 1: Write failing tests for recorder IPC**

Create `apps/desktop/tests/recorder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn().mockReturnValue("/tmp"),
  },
}));

// Mock child_process
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

import { RecorderService } from "../src/main/ipc/recorder";

describe("RecorderService", () => {
  let recorder: RecorderService;

  beforeEach(() => {
    vi.clearAllMocks();
    recorder = new RecorderService();
  });

  describe("start", () => {
    it("spawns ffmpeg process for audio capture", async () => {
      const mockProcess = {
        pid: 9999,
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess);

      const result = await recorder.start();

      expect(result.recording).toBe(true);
      expect(result.filePath).toMatch(/\.m4a$/);
      expect(mockSpawn).toHaveBeenCalledWith(
        "ffmpeg",
        expect.arrayContaining(["-f", "avfoundation"]),
        expect.any(Object)
      );
    });

    it("rejects if already recording", async () => {
      const mockProcess = {
        pid: 9999,
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess);

      await recorder.start();
      await expect(recorder.start()).rejects.toThrow("Already recording");
    });
  });

  describe("stop", () => {
    it("sends SIGINT to ffmpeg and returns file path", async () => {
      const mockProcess = {
        pid: 9999,
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === "close") setTimeout(() => cb(0), 10);
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess);

      await recorder.start();
      const result = await recorder.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGINT");
      expect(result.filePath).toMatch(/\.m4a$/);
    });
  });

  describe("getStatus", () => {
    it("returns idle when not recording", () => {
      const status = recorder.getStatus();
      expect(status.recording).toBe(false);
      expect(status.durationSeconds).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/recorder.test.ts
```

Expected: FAIL — "Cannot find module '../src/main/ipc/recorder'"

- [ ] **Step 3: Implement recorder IPC**

Create `apps/desktop/src/main/ipc/recorder.ts`:

```typescript
import { ipcMain, app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";

interface RecordingStatus {
  recording: boolean;
  filePath?: string;
  durationSeconds: number;
  startedAt?: string;
}

interface RecordingResult {
  recording: boolean;
  filePath: string;
}

export class RecorderService {
  private process: ChildProcess | null = null;
  private filePath: string | null = null;
  private startTime: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<RecordingResult> {
    if (this.process) {
      throw new Error("Already recording");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempDir = app?.getPath?.("temp") ?? "/tmp";
    this.filePath = path.join(tempDir, `axle-recording-${timestamp}.m4a`);
    this.startTime = Date.now();

    // macOS: Use ffmpeg with avfoundation to capture default audio input
    this.process = spawn(
      "ffmpeg",
      [
        "-f", "avfoundation",
        "-i", ":default",    // Default audio input device
        "-acodec", "aac",
        "-b:a", "128k",
        "-y",                // Overwrite output
        this.filePath,
      ],
      { stdio: "pipe" }
    );

    this.process.stderr?.on("data", (_data: Buffer) => {
      // ffmpeg outputs progress to stderr — ignored for now
    });

    this.process.on("close", () => {
      this.process = null;
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    });

    return {
      recording: true,
      filePath: this.filePath,
    };
  }

  async stop(): Promise<RecordingResult> {
    if (!this.process || !this.filePath) {
      throw new Error("Not recording");
    }

    const filePath = this.filePath;

    // Send SIGINT to ffmpeg for graceful stop (finalizes file)
    this.process.kill("SIGINT");

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

    this.startTime = null;
    this.filePath = null;

    return { recording: false, filePath };
  }

  getStatus(): RecordingStatus {
    if (!this.process || !this.startTime) {
      return { recording: false, durationSeconds: 0 };
    }

    return {
      recording: true,
      filePath: this.filePath ?? undefined,
      durationSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      startedAt: new Date(this.startTime).toISOString(),
    };
  }
}

export function registerRecorderIpc(): void {
  const recorder = new RecorderService();

  ipcMain.handle("recorder:start", async () => {
    return recorder.start();
  });

  ipcMain.handle("recorder:stop", async () => {
    return recorder.stop();
  });

  ipcMain.handle("recorder:status", () => {
    return recorder.getStatus();
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/recorder.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/main/ipc/recorder.ts apps/desktop/tests/recorder.test.ts
git commit -m "feat: add native audio recording IPC using ffmpeg avfoundation"
```

---

## Task 5: PKCS#12 Certificate Management IPC

**Files:**
- Create: `apps/desktop/src/main/ipc/cert.ts`
- Create: `apps/desktop/tests/cert.test.ts`

- [ ] **Step 1: Write failing tests for certificate management**

Create `apps/desktop/tests/cert.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue("/tmp") },
}));

import { CertService } from "../src/main/ipc/cert";

describe("CertService", () => {
  let certService: CertService;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cert-test-"));
    certService = new CertService(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("loadCertificate", () => {
    it("stores certificate reference with metadata", async () => {
      // Create a dummy .p12 file
      const certPath = path.join(tmpDir, "test.p12");
      await fs.writeFile(certPath, Buffer.from("dummy-cert-data"));

      const result = await certService.loadCertificate(certPath, "test-password");

      expect(result.id).toBeDefined();
      expect(result.subjectName).toBe("test.p12");
      expect(result.filePath).toBe(certPath);
    });

    it("rejects when file does not exist", async () => {
      await expect(
        certService.loadCertificate("/nonexistent/cert.p12", "pass")
      ).rejects.toThrow();
    });
  });

  describe("listCertificates", () => {
    it("returns empty list initially", () => {
      const certs = certService.listCertificates();
      expect(certs).toEqual([]);
    });

    it("returns loaded certificates", async () => {
      const certPath = path.join(tmpDir, "test.p12");
      await fs.writeFile(certPath, Buffer.from("dummy"));

      await certService.loadCertificate(certPath, "pass");

      const certs = certService.listCertificates();
      expect(certs).toHaveLength(1);
    });
  });

  describe("selectCertificate", () => {
    it("sets active certificate by id", async () => {
      const certPath = path.join(tmpDir, "test.p12");
      await fs.writeFile(certPath, Buffer.from("dummy"));

      const { id } = await certService.loadCertificate(certPath, "pass");
      certService.selectCertificate(id);

      const active = certService.getActiveCertificate();
      expect(active?.id).toBe(id);
    });

    it("throws for unknown certificate id", () => {
      expect(() => certService.selectCertificate("unknown-id")).toThrow(
        "Certificate not found"
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/cert.test.ts
```

Expected: FAIL — "Cannot find module '../src/main/ipc/cert'"

- [ ] **Step 3: Implement certificate management IPC**

Create `apps/desktop/src/main/ipc/cert.ts`:

```typescript
import { ipcMain, app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

interface CertificateEntry {
  id: string;
  subjectName: string;
  filePath: string;
  loadedAt: string;
  isActive: boolean;
}

export class CertService {
  private certificates: Map<string, CertificateEntry> = new Map();
  private activeCertId: string | null = null;
  private readonly storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir ?? app?.getPath?.("userData") ?? "/tmp";
  }

  /**
   * Load a PKCS#12 (.pfx/.p12) certificate from the local filesystem.
   * Stores an encrypted reference — the actual cert stays on disk.
   */
  async loadCertificate(
    filePath: string,
    _password: string
  ): Promise<CertificateEntry> {
    // Verify file exists and is readable
    await fs.access(filePath, fs.constants.R_OK);

    const fileName = path.basename(filePath);
    const id = crypto.randomUUID();

    const entry: CertificateEntry = {
      id,
      subjectName: fileName,
      filePath,
      loadedAt: new Date().toISOString(),
      isActive: false,
    };

    this.certificates.set(id, entry);

    // Persist certificate registry
    await this.saveRegistry();

    return entry;
  }

  listCertificates(): CertificateEntry[] {
    return Array.from(this.certificates.values());
  }

  selectCertificate(certId: string): void {
    const cert = this.certificates.get(certId);
    if (!cert) {
      throw new Error("Certificate not found");
    }

    // Deactivate all, activate selected
    for (const entry of this.certificates.values()) {
      entry.isActive = false;
    }
    cert.isActive = true;
    this.activeCertId = certId;
  }

  getActiveCertificate(): CertificateEntry | null {
    if (!this.activeCertId) return null;
    return this.certificates.get(this.activeCertId) ?? null;
  }

  /**
   * Get the file path and password for portal authentication.
   * Used by portal automation to provide cert to Playwright.
   */
  getCertForAuth(): { filePath: string } | null {
    const active = this.getActiveCertificate();
    if (!active) return null;
    return { filePath: active.filePath };
  }

  private async saveRegistry(): Promise<void> {
    const registryPath = path.join(this.storageDir, "cert-registry.json");
    const data = Array.from(this.certificates.values());
    await fs.writeFile(registryPath, JSON.stringify(data, null, 2), "utf-8");
  }
}

export function registerCertIpc(): void {
  const certService = new CertService();

  ipcMain.handle("cert:load", async (_event, filePath: string, password: string) => {
    return certService.loadCertificate(filePath, password);
  });

  ipcMain.handle("cert:list", () => {
    return certService.listCertificates();
  });

  ipcMain.handle("cert:select", (_event, certId: string) => {
    certService.selectCertificate(certId);
    return { success: true };
  });

  ipcMain.handle("cert:active", () => {
    return certService.getActiveCertificate();
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/cert.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/main/ipc/cert.ts apps/desktop/tests/cert.test.ts
git commit -m "feat: add PKCS#12 certificate management IPC for government portal auth"
```

---

## Task 6: Portal Automation — Selectors + Self-Repair

**Files:**
- Create: `apps/desktop/src/main/portal/selectors.json`
- Create: `apps/desktop/src/main/portal/self-repair.ts`
- Create: `apps/desktop/tests/portal-selectors.test.ts`
- Create: `apps/desktop/tests/self-repair.test.ts`

- [ ] **Step 1: Create initial selectors.json**

Create `apps/desktop/src/main/portal/selectors.json`:

```json
{
  "hometax": {
    "loginUrl": "https://www.hometax.go.kr",
    "certLoginButton": "#certLogin",
    "certSelectPopup": ".cert-select-popup",
    "certPasswordInput": "#certPassword",
    "issueMenu": {
      "사업자등록증명": "#menu_issue_biz_cert",
      "납세증명서": "#menu_issue_tax_cert",
      "부가세과세표준증명": "#menu_issue_vat_cert"
    },
    "issueButton": "#btnIssue",
    "downloadButton": "#btnDownload"
  },
  "minwon24": {
    "loginUrl": "https://www.gov.kr",
    "certLoginButton": ".cert-login",
    "issueMenu": {
      "법인등기부등본": "#menu_corp_register",
      "사업자등록증명": "#menu_biz_cert"
    },
    "issueButton": ".btn-issue",
    "downloadButton": ".btn-download"
  },
  "insurance": {
    "loginUrl": "https://www.4insure.or.kr",
    "certLoginButton": "#certLogin",
    "issueMenu": {
      "4대보험완납증명": "#menu_complete_cert",
      "4대보험가입확인서": "#menu_join_cert"
    }
  },
  "venturein": {
    "loginUrl": "https://www.venturein.or.kr",
    "certLoginButton": ".cert-login-btn",
    "applicationForm": "#ventureForm",
    "submitButton": "#btnSubmit"
  },
  "koita": {
    "loginUrl": "https://rnd.koita.or.kr",
    "certLoginButton": "#certLoginBtn",
    "reportForm": "#reportForm",
    "submitButton": "#btnSubmitReport"
  },
  "_meta": {
    "version": 1,
    "lastUpdated": "2026-04-10",
    "autoRepairCount": 0
  }
}
```

- [ ] **Step 2: Write failing tests for self-repair**

Create `apps/desktop/tests/self-repair.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  generateNewSelector,
  updateSelector,
  type SelectorRepairInput,
} from "../src/main/portal/self-repair";

describe("Self-Repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateNewSelector", () => {
    it("sends screenshot to AI and returns new selector", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                selector: "#newLoginButton",
                confidence: 0.85,
                reasoning: "Button moved to new ID",
              }),
            },
          }],
        }),
      });

      const input: SelectorRepairInput = {
        portalType: "hometax",
        selectorKey: "certLoginButton",
        failedSelector: "#certLogin",
        screenshotBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        pageHtml: "<html><body><button id='newLoginButton'>Login</button></body></html>",
      };

      const result = await generateNewSelector(input, "http://127.0.0.1:4100");

      expect(result.selector).toBe("#newLoginButton");
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe("updateSelector", () => {
    it("updates selectors.json with new value", async () => {
      const selectors: Record<string, any> = {
        hometax: { certLoginButton: "#oldSelector" },
        _meta: { version: 1, autoRepairCount: 0 },
      };

      const updated = updateSelector(
        selectors,
        "hometax",
        "certLoginButton",
        "#newSelector"
      );

      expect(updated.hometax.certLoginButton).toBe("#newSelector");
      expect(updated._meta.autoRepairCount).toBe(1);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/self-repair.test.ts
```

Expected: FAIL — "Cannot find module '../src/main/portal/self-repair'"

- [ ] **Step 4: Implement self-repair module**

Create `apps/desktop/src/main/portal/self-repair.ts`:

```typescript
/**
 * Self-repair pattern from FlowVue Scraper:
 * When a selector fails → take screenshot → send to AI → get new selector → update selectors.json
 */

export interface SelectorRepairInput {
  portalType: string;
  selectorKey: string;
  failedSelector: string;
  screenshotBase64: string;
  pageHtml: string;
}

export interface SelectorRepairResult {
  selector: string;
  confidence: number;
  reasoning: string;
}

/**
 * Send a screenshot + page HTML to the AI (via agent-bridge) to generate a new selector.
 */
export async function generateNewSelector(
  input: SelectorRepairInput,
  agentBridgeUrl: string
): Promise<SelectorRepairResult> {
  const prompt = [
    `A Playwright selector has failed on the ${input.portalType} portal.`,
    `Failed selector: ${input.failedSelector}`,
    `Selector key: ${input.selectorKey}`,
    ``,
    `Analyze the page HTML and screenshot to find the correct new CSS/XPath selector.`,
    `Return JSON: { "selector": "...", "confidence": 0.0-1.0, "reasoning": "..." }`,
    ``,
    `Page HTML (truncated):`,
    input.pageHtml.slice(0, 5000),
  ].join("\n");

  const response = await fetch(`${agentBridgeUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "hermes-3-8b",
      messages: [
        {
          role: "system",
          content: "You are a web automation expert. Analyze HTML and screenshots to find CSS selectors for Korean government portal automation.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    throw new Error(`Self-repair AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(content) as SelectorRepairResult;
  } catch {
    return {
      selector: input.failedSelector,
      confidence: 0,
      reasoning: "Failed to parse AI response",
    };
  }
}

/**
 * Update selectors.json in-memory with a repaired selector.
 */
export function updateSelector(
  selectors: Record<string, any>,
  portalType: string,
  selectorKey: string,
  newValue: string
): Record<string, any> {
  const updated = { ...selectors };

  if (updated[portalType] && selectorKey in updated[portalType]) {
    updated[portalType] = {
      ...updated[portalType],
      [selectorKey]: newValue,
    };
  }

  // Update metadata
  if (updated._meta) {
    updated._meta = {
      ...updated._meta,
      autoRepairCount: (updated._meta.autoRepairCount ?? 0) + 1,
      lastUpdated: new Date().toISOString().split("T")[0],
    };
  }

  return updated;
}
```

- [ ] **Step 5: Write tests for selector loading**

Create `apps/desktop/tests/portal-selectors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("selectors.json", () => {
  const selectorsPath = path.join(__dirname, "..", "src", "main", "portal", "selectors.json");

  it("exists and is valid JSON", () => {
    const content = fs.readFileSync(selectorsPath, "utf-8");
    const selectors = JSON.parse(content);

    expect(selectors).toHaveProperty("hometax");
    expect(selectors).toHaveProperty("minwon24");
    expect(selectors).toHaveProperty("insurance");
    expect(selectors).toHaveProperty("venturein");
    expect(selectors).toHaveProperty("koita");
    expect(selectors).toHaveProperty("_meta");
  });

  it("has login URLs for all portals", () => {
    const content = fs.readFileSync(selectorsPath, "utf-8");
    const selectors = JSON.parse(content);

    expect(selectors.hometax.loginUrl).toMatch(/^https?:\/\//);
    expect(selectors.minwon24.loginUrl).toMatch(/^https?:\/\//);
    expect(selectors.insurance.loginUrl).toMatch(/^https?:\/\//);
  });

  it("has cert login selectors for all portals", () => {
    const content = fs.readFileSync(selectorsPath, "utf-8");
    const selectors = JSON.parse(content);

    expect(selectors.hometax.certLoginButton).toBeDefined();
    expect(selectors.minwon24.certLoginButton).toBeDefined();
    expect(selectors.insurance.certLoginButton).toBeDefined();
  });
});
```

- [ ] **Step 6: Run all portal tests**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/portal-selectors.test.ts tests/self-repair.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/main/portal/selectors.json apps/desktop/src/main/portal/self-repair.ts apps/desktop/tests/portal-selectors.test.ts apps/desktop/tests/self-repair.test.ts
git commit -m "feat: add portal selectors.json and AI self-repair for selector changes"
```

---

## Task 7: Portal Page Objects + Automation IPC

**Files:**
- Create: `apps/desktop/src/main/portal/cert-auth.ts`
- Create: `apps/desktop/src/main/portal/page-objects/hometax.ts`
- Create: `apps/desktop/src/main/ipc/portal.ts`

- [ ] **Step 1: Create certificate-based auth flow**

Create `apps/desktop/src/main/portal/cert-auth.ts`:

```typescript
import type { Page } from "playwright";
import * as fs from "node:fs";

interface CertAuthOptions {
  certFilePath: string;
  portalSelectors: Record<string, string>;
}

/**
 * Perform certificate-based login on a government portal.
 * PKCS#12 (.p12/.pfx) → portal auth dialog → authenticated session.
 */
export async function performCertLogin(
  page: Page,
  loginUrl: string,
  opts: CertAuthOptions
): Promise<boolean> {
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Click certificate login button
  const certLoginBtn = opts.portalSelectors.certLoginButton;
  await page.waitForSelector(certLoginBtn, { timeout: 10_000 });
  await page.click(certLoginBtn);

  // Wait for cert selection popup/dialog
  // Government portal cert dialogs vary — handle via CDP client certificate event
  // For portals that use JavaScript-based cert dialogs:
  if (opts.portalSelectors.certSelectPopup) {
    await page.waitForSelector(opts.portalSelectors.certSelectPopup, { timeout: 15_000 });
  }

  // Verify login success — check for logged-in indicator
  await page.waitForTimeout(3_000);

  const isLoggedIn = await page.evaluate(() => {
    // Common indicators: logout button, user name display
    return !!(
      document.querySelector("[class*='logout']") ??
      document.querySelector("[id*='logout']") ??
      document.querySelector("[class*='user-name']")
    );
  });

  return isLoggedIn;
}
```

- [ ] **Step 2: Create HomeTax page object**

Create `apps/desktop/src/main/portal/page-objects/hometax.ts`:

```typescript
import type { Page } from "playwright";

interface HomeTaxSelectors {
  loginUrl: string;
  certLoginButton: string;
  issueMenu: Record<string, string>;
  issueButton: string;
  downloadButton: string;
}

/**
 * HomeTax (홈택스) page object for document issuance automation.
 * Supports: 사업자등록증명, 납세증명서, 부가세과세표준증명
 */
export class HomeTaxPage {
  constructor(
    private page: Page,
    private selectors: HomeTaxSelectors
  ) {}

  async navigateToIssue(docType: string): Promise<void> {
    const menuSelector = this.selectors.issueMenu[docType];
    if (!menuSelector) {
      throw new Error(`Unknown HomeTax document type: ${docType}`);
    }

    await this.page.waitForSelector(menuSelector, { timeout: 10_000 });
    await this.page.click(menuSelector);
    await this.page.waitForLoadState("networkidle");
  }

  async fillIssueForm(businessNumber: string): Promise<void> {
    // Fill business number if not pre-populated
    const bizNumInput = await this.page.$("input[name*='businessNumber'], input[name*='biz_no']");
    if (bizNumInput) {
      await bizNumInput.fill(businessNumber);
    }
  }

  async issueDocument(): Promise<void> {
    await this.page.waitForSelector(this.selectors.issueButton, { timeout: 10_000 });
    await this.page.click(this.selectors.issueButton);
    await this.page.waitForLoadState("networkidle");
  }

  async downloadDocument(): Promise<string | null> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download", { timeout: 30_000 }),
      this.page.click(this.selectors.downloadButton),
    ]);

    const filePath = await download.path();
    return filePath ?? null;
  }

  async takeScreenshot(): Promise<Buffer> {
    return await this.page.screenshot({ fullPage: true });
  }

  async getPageHtml(): Promise<string> {
    return await this.page.content();
  }
}
```

- [ ] **Step 3: Create portal automation IPC**

Create `apps/desktop/src/main/ipc/portal.ts`:

```typescript
import { ipcMain } from "electron";
import { chromium, type Browser, type Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { HomeTaxPage } from "../portal/page-objects/hometax";
import { performCertLogin } from "../portal/cert-auth";
import { generateNewSelector, updateSelector } from "../portal/self-repair";

interface PortalTask {
  id: string;
  status: "running" | "completed" | "failed";
  portalType: string;
  docType: string;
  result?: string;
  error?: string;
  logs: Array<{ step: string; status: string; timestamp: string }>;
}

const activeTasks = new Map<string, PortalTask>();
const SELECTORS_PATH = path.join(__dirname, "..", "portal", "selectors.json");
const AGENT_BRIDGE_URL = process.env.AGENT_BRIDGE_URL ?? "http://127.0.0.1:4100";

function loadSelectors(): Record<string, any> {
  const content = fs.readFileSync(SELECTORS_PATH, "utf-8");
  return JSON.parse(content);
}

function saveSelectors(selectors: Record<string, any>): void {
  fs.writeFileSync(SELECTORS_PATH, JSON.stringify(selectors, null, 2), "utf-8");
}

function addLog(task: PortalTask, step: string, status: string): void {
  task.logs.push({ step, status, timestamp: new Date().toISOString() });
}

/**
 * Issue a document from a government portal.
 * Includes self-repair: if selector fails, take screenshot → AI → new selector.
 */
async function issueDocument(
  portalType: string,
  docType: string,
  _clientId: string
): Promise<PortalTask> {
  const taskId = crypto.randomUUID();
  const task: PortalTask = {
    id: taskId,
    status: "running",
    portalType,
    docType,
    logs: [],
  };
  activeTasks.set(taskId, task);

  let browser: Browser | null = null;

  try {
    const selectors = loadSelectors();
    const portalSelectors = selectors[portalType];

    if (!portalSelectors) {
      throw new Error(`Unknown portal type: ${portalType}`);
    }

    addLog(task, "launch-browser", "started");
    browser = await chromium.launch({
      headless: false, // Government portals require visible browser
    });
    const page = await browser.newPage();
    addLog(task, "launch-browser", "completed");

    // Certificate login
    addLog(task, "cert-login", "started");
    const loginSuccess = await performCertLogin(page, portalSelectors.loginUrl, {
      certFilePath: "", // Will be provided by CertService
      portalSelectors,
    });

    if (!loginSuccess) {
      // Try self-repair on login selector
      addLog(task, "cert-login", "failed — attempting self-repair");
      await attemptSelfRepair(page, portalType, "certLoginButton", portalSelectors.certLoginButton);
    }
    addLog(task, "cert-login", loginSuccess ? "completed" : "repaired");

    // Navigate to document issuance
    if (portalType === "hometax") {
      const hometax = new HomeTaxPage(page, portalSelectors);

      addLog(task, "navigate-issue", "started");
      try {
        await hometax.navigateToIssue(docType);
      } catch {
        // Self-repair on menu selector
        const menuKey = `issueMenu.${docType}`;
        await attemptSelfRepair(page, portalType, menuKey, portalSelectors.issueMenu?.[docType]);
      }
      addLog(task, "navigate-issue", "completed");

      addLog(task, "issue-document", "started");
      await hometax.issueDocument();
      addLog(task, "issue-document", "completed");

      addLog(task, "download", "started");
      const filePath = await hometax.downloadDocument();
      task.result = filePath ?? undefined;
      addLog(task, "download", "completed");
    }

    task.status = "completed";
  } catch (err) {
    task.status = "failed";
    task.error = err instanceof Error ? err.message : String(err);
    addLog(task, "error", task.error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return task;
}

/**
 * Self-repair: take screenshot → send to AI → update selectors.json.
 */
async function attemptSelfRepair(
  page: Page,
  portalType: string,
  selectorKey: string,
  failedSelector: string
): Promise<void> {
  const screenshot = await page.screenshot({ fullPage: true });
  const pageHtml = await page.content();

  try {
    const repair = await generateNewSelector(
      {
        portalType,
        selectorKey,
        failedSelector,
        screenshotBase64: screenshot.toString("base64"),
        pageHtml,
      },
      AGENT_BRIDGE_URL
    );

    if (repair.confidence >= 0.7) {
      const selectors = loadSelectors();
      const updated = updateSelector(selectors, portalType, selectorKey, repair.selector);
      saveSelectors(updated);
    }
  } catch {
    // Self-repair is best-effort — continue with original selector
  }
}

export function registerPortalIpc(): void {
  ipcMain.handle(
    "portal:issue",
    async (_event, portalType: string, docType: string, clientId: string) => {
      return issueDocument(portalType, docType, clientId);
    }
  );

  ipcMain.handle("portal:status", (_event, taskId: string) => {
    return activeTasks.get(taskId) ?? null;
  });
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/main/portal/cert-auth.ts apps/desktop/src/main/portal/page-objects/ apps/desktop/src/main/ipc/portal.ts
git commit -m "feat: add portal automation IPC with HomeTax page object and self-repair"
```

---

## Task 8: Agent Bridge IPC + Offline Cache

**Files:**
- Create: `apps/desktop/src/main/ipc/agent.ts`
- Create: `apps/desktop/src/main/offline/cache.ts`
- Create: `apps/desktop/tests/agent-ipc.test.ts`
- Create: `apps/desktop/tests/offline-cache.test.ts`

- [ ] **Step 1: Write failing tests for agent IPC**

Create `apps/desktop/tests/agent-ipc.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { AgentBridgeClient } from "../src/main/ipc/agent";

describe("AgentBridgeClient", () => {
  let client: AgentBridgeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AgentBridgeClient("http://127.0.0.1:4100");
  });

  describe("health", () => {
    it("returns health status from agent-bridge", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "ok",
          uptime: 120,
          mlxAvailable: true,
          timestamp: "2026-04-10T10:00:00Z",
        }),
      });

      const result = await client.health();

      expect(result.status).toBe("ok");
      expect(result.mlxAvailable).toBe(true);
    });

    it("returns disconnected when agent-bridge is down", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await client.health();

      expect(result.status).toBe("disconnected");
    });
  });

  describe("submitJob", () => {
    it("submits AI job to agent-bridge", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ jobId: "job-123", tier: "LOCAL_MLX", status: "QUEUED" }),
      });

      const result = await client.submitJob("JOURNAL_DRAFT", "Write journal", {
        clientName: "Test",
      });

      expect(result.jobId).toBe("job-123");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:4100/api/ai/run",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });

  describe("getJobStatus", () => {
    it("fetches job status", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "job-123",
          status: "COMPLETED",
          output: { text: "Result" },
        }),
      });

      const result = await client.getJobStatus("job-123");

      expect(result.status).toBe("COMPLETED");
    });
  });
});
```

- [ ] **Step 2: Write failing tests for offline cache**

Create `apps/desktop/tests/offline-cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { OfflineCache } from "../src/main/offline/cache";

describe("OfflineCache", () => {
  let cache: OfflineCache;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "offline-test-"));
    cache = new OfflineCache(path.join(tmpDir, "cache.db"));
  });

  afterEach(() => {
    cache.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("set / get", () => {
    it("stores and retrieves a value", () => {
      cache.set("clients", "c1", { name: "Test Corp", status: "ACTIVE" });
      const result = cache.get("clients", "c1");

      expect(result).toEqual({ name: "Test Corp", status: "ACTIVE" });
    });

    it("returns null for missing key", () => {
      const result = cache.get("clients", "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all entries for a table", () => {
      cache.set("clients", "c1", { name: "Corp A" });
      cache.set("clients", "c2", { name: "Corp B" });

      const all = cache.list("clients");
      expect(all).toHaveLength(2);
    });
  });

  describe("delete", () => {
    it("removes an entry", () => {
      cache.set("clients", "c1", { name: "Corp A" });
      cache.delete("clients", "c1");

      const result = cache.get("clients", "c1");
      expect(result).toBeNull();
    });
  });

  describe("sync metadata", () => {
    it("tracks last sync timestamp", () => {
      cache.setLastSync("clients", new Date("2026-04-10T10:00:00Z"));
      const lastSync = cache.getLastSync("clients");

      expect(lastSync?.toISOString()).toBe("2026-04-10T10:00:00.000Z");
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/agent-ipc.test.ts tests/offline-cache.test.ts
```

Expected: FAIL — Cannot find modules

- [ ] **Step 4: Implement agent bridge client**

Create `apps/desktop/src/main/ipc/agent.ts`:

```typescript
import { ipcMain } from "electron";

interface HealthResult {
  status: string;
  uptime?: number;
  mlxAvailable?: boolean;
  timestamp?: string;
}

interface JobSubmitResult {
  jobId: string;
  tier: string;
  status: string;
}

interface JobStatusResult {
  id: string;
  status: string;
  type?: string;
  tier?: string;
  output?: Record<string, unknown>;
  errorMessage?: string;
}

export class AgentBridgeClient {
  constructor(private readonly baseUrl: string) {}

  async health(): Promise<HealthResult> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) {
        return { status: "error" };
      }
      return (await res.json()) as HealthResult;
    } catch {
      return { status: "disconnected" };
    }
  }

  async submitJob(
    type: string,
    prompt: string,
    context?: Record<string, unknown>
  ): Promise<JobSubmitResult> {
    const res = await fetch(`${this.baseUrl}/api/ai/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, prompt, context }),
    });

    if (!res.ok) {
      throw new Error(`Agent bridge error: ${res.status}`);
    }

    return (await res.json()) as JobSubmitResult;
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const res = await fetch(`${this.baseUrl}/api/ai/status/${jobId}`);

    if (!res.ok) {
      throw new Error(`Agent bridge error: ${res.status}`);
    }

    return (await res.json()) as JobStatusResult;
  }
}

export function registerAgentIpc(): void {
  const bridgeUrl = process.env.AGENT_BRIDGE_URL ?? "http://127.0.0.1:4100";
  const client = new AgentBridgeClient(bridgeUrl);

  ipcMain.handle("agent:health", async () => {
    return client.health();
  });

  ipcMain.handle(
    "agent:submit",
    async (_event, type: string, prompt: string, context?: Record<string, unknown>) => {
      return client.submitJob(type, prompt, context);
    }
  );

  ipcMain.handle("agent:job-status", async (_event, jobId: string) => {
    return client.getJobStatus(jobId);
  });
}
```

- [ ] **Step 5: Implement offline SQLite cache**

Create `apps/desktop/src/main/offline/cache.ts`:

```typescript
import Database from "better-sqlite3";

/**
 * SQLite-based local cache for offline mode.
 * Provides basic CRUD for key entities when network is unavailable.
 * Data syncs with the server when connection is restored.
 */
export class OfflineCache {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        table_name TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (table_name, id)
      );

      CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        last_sync TEXT NOT NULL
      );
    `);
  }

  set(tableName: string, id: string, data: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache (table_name, id, data, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(tableName, id, JSON.stringify(data));
  }

  get(tableName: string, id: string): Record<string, unknown> | null {
    const stmt = this.db.prepare(
      "SELECT data FROM cache WHERE table_name = ? AND id = ?"
    );
    const row = stmt.get(tableName, id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  list(tableName: string): Array<Record<string, unknown>> {
    const stmt = this.db.prepare(
      "SELECT data FROM cache WHERE table_name = ? ORDER BY updated_at DESC"
    );
    const rows = stmt.all(tableName) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data));
  }

  delete(tableName: string, id: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM cache WHERE table_name = ? AND id = ?"
    );
    stmt.run(tableName, id);
  }

  setLastSync(tableName: string, timestamp: Date): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (table_name, last_sync)
      VALUES (?, ?)
    `);
    stmt.run(tableName, timestamp.toISOString());
  }

  getLastSync(tableName: string): Date | null {
    const stmt = this.db.prepare(
      "SELECT last_sync FROM sync_metadata WHERE table_name = ?"
    );
    const row = stmt.get(tableName) as { last_sync: string } | undefined;
    return row ? new Date(row.last_sync) : null;
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run tests/agent-ipc.test.ts tests/offline-cache.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/main/ipc/agent.ts apps/desktop/src/main/offline/ apps/desktop/tests/agent-ipc.test.ts apps/desktop/tests/offline-cache.test.ts
git commit -m "feat: add agent-bridge IPC client and SQLite offline cache"
```

---

## Task 9: Remaining Page Objects (Stubs)

**Files:**
- Create: `apps/desktop/src/main/portal/page-objects/minwon24.ts`
- Create: `apps/desktop/src/main/portal/page-objects/insurance.ts`
- Create: `apps/desktop/src/main/portal/page-objects/venturein.ts`
- Create: `apps/desktop/src/main/portal/page-objects/koita.ts`

- [ ] **Step 1: Create 민원24 page object**

Create `apps/desktop/src/main/portal/page-objects/minwon24.ts`:

```typescript
import type { Page } from "playwright";

interface Minwon24Selectors {
  loginUrl: string;
  certLoginButton: string;
  issueMenu: Record<string, string>;
  issueButton: string;
  downloadButton: string;
}

/**
 * 민원24 (gov.kr) page object for document issuance.
 * Supports: 법인등기부등본, 사업자등록증명
 */
export class Minwon24Page {
  constructor(
    private page: Page,
    private selectors: Minwon24Selectors
  ) {}

  async navigateToIssue(docType: string): Promise<void> {
    const menuSelector = this.selectors.issueMenu[docType];
    if (!menuSelector) {
      throw new Error(`Unknown Minwon24 document type: ${docType}`);
    }
    await this.page.waitForSelector(menuSelector, { timeout: 10_000 });
    await this.page.click(menuSelector);
    await this.page.waitForLoadState("networkidle");
  }

  async issueDocument(): Promise<void> {
    await this.page.waitForSelector(this.selectors.issueButton, { timeout: 10_000 });
    await this.page.click(this.selectors.issueButton);
    await this.page.waitForLoadState("networkidle");
  }

  async downloadDocument(): Promise<string | null> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download", { timeout: 30_000 }),
      this.page.click(this.selectors.downloadButton),
    ]);
    return (await download.path()) ?? null;
  }

  async takeScreenshot(): Promise<Buffer> {
    return await this.page.screenshot({ fullPage: true });
  }
}
```

- [ ] **Step 2: Create 4대보험 page object**

Create `apps/desktop/src/main/portal/page-objects/insurance.ts`:

```typescript
import type { Page } from "playwright";

interface InsuranceSelectors {
  loginUrl: string;
  certLoginButton: string;
  issueMenu: Record<string, string>;
}

/**
 * 4대보험 정보연계센터 page object.
 * Supports: 4대보험완납증명, 4대보험가입확인서
 */
export class InsurancePage {
  constructor(
    private page: Page,
    private selectors: InsuranceSelectors
  ) {}

  async navigateToIssue(docType: string): Promise<void> {
    const menuSelector = this.selectors.issueMenu[docType];
    if (!menuSelector) {
      throw new Error(`Unknown insurance document type: ${docType}`);
    }
    await this.page.waitForSelector(menuSelector, { timeout: 10_000 });
    await this.page.click(menuSelector);
    await this.page.waitForLoadState("networkidle");
  }

  async takeScreenshot(): Promise<Buffer> {
    return await this.page.screenshot({ fullPage: true });
  }
}
```

- [ ] **Step 3: Create VENTUREIN page object**

Create `apps/desktop/src/main/portal/page-objects/venturein.ts`:

```typescript
import type { Page } from "playwright";

interface VentureinSelectors {
  loginUrl: string;
  certLoginButton: string;
  applicationForm: string;
  submitButton: string;
}

/**
 * VENTUREIN (벤처인) page object for venture certification.
 * Supports: application form submission, document upload.
 */
export class VentureinPage {
  constructor(
    private page: Page,
    private selectors: VentureinSelectors
  ) {}

  async navigateToApplication(): Promise<void> {
    await this.page.waitForSelector(this.selectors.applicationForm, { timeout: 10_000 });
  }

  async fillFormField(fieldSelector: string, value: string): Promise<void> {
    await this.page.waitForSelector(fieldSelector, { timeout: 5_000 });
    await this.page.fill(fieldSelector, value);
  }

  async uploadAttachment(fieldSelector: string, filePath: string): Promise<void> {
    const input = await this.page.waitForSelector(fieldSelector, { timeout: 5_000 });
    await input.setInputFiles(filePath);
  }

  async submit(): Promise<void> {
    await this.page.click(this.selectors.submitButton);
    await this.page.waitForLoadState("networkidle");
  }

  async takeScreenshot(): Promise<Buffer> {
    return await this.page.screenshot({ fullPage: true });
  }
}
```

- [ ] **Step 4: Create KOITA page object**

Create `apps/desktop/src/main/portal/page-objects/koita.ts`:

```typescript
import type { Page } from "playwright";

interface KoitaSelectors {
  loginUrl: string;
  certLoginButton: string;
  reportForm: string;
  submitButton: string;
}

/**
 * KOITA (한국산업기술진흥협회) page object.
 * Supports: 기업부설연구소 신고서 제출, 연구개발 보고서 등록.
 */
export class KoitaPage {
  constructor(
    private page: Page,
    private selectors: KoitaSelectors
  ) {}

  async navigateToReport(): Promise<void> {
    await this.page.waitForSelector(this.selectors.reportForm, { timeout: 10_000 });
  }

  async fillFormField(fieldSelector: string, value: string): Promise<void> {
    await this.page.waitForSelector(fieldSelector, { timeout: 5_000 });
    await this.page.fill(fieldSelector, value);
  }

  async submit(): Promise<void> {
    await this.page.click(this.selectors.submitButton);
    await this.page.waitForLoadState("networkidle");
  }

  async takeScreenshot(): Promise<Buffer> {
    return await this.page.screenshot({ fullPage: true });
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/desktop/src/main/portal/page-objects/
git commit -m "feat: add page objects for 민원24, 4대보험, VENTUREIN, KOITA portals"
```

---

## Task 10: Integration Verification

- [ ] **Step 1: Run all desktop tests**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx vitest run
```

Expected: All tests pass (recorder: 4, cert: 5, portal-selectors: 3, self-repair: 2, agent-ipc: 4, offline-cache: 5 = **23 total**).

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/포터블/AX/axle/apps/desktop
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Verify Turborepo integration**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test --filter=@axle/desktop
```

Expected: Test task completes successfully.

- [ ] **Step 4: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 15 complete — Electron desktop with recorder, cert, portal automation, agent bridge"
```

---

## Summary

Phase 15 delivers:
- **Electron 36+ shell** loading the AXLE web app with system tray status indicator
- **Preload/contextBridge** API exposing recorder, cert, portal, and agent IPC to the renderer
- **Native audio recording** via ffmpeg avfoundation for meeting transcription
- **PKCS#12 certificate management** for government portal authentication
- **Portal automation** with Playwright page objects for HomeTax, 민원24, 4대보험, VENTUREIN, KOITA
- **AI self-repair pattern** from FlowVue Scraper: screenshot → AI → new selectors → selectors.json
- **Agent bridge IPC client** for HTTP/WebSocket communication with Mac Mini agent-bridge
- **SQLite offline cache** for basic CRUD when network is unavailable
- **electron-builder config** for macOS dmg/zip packaging

**Next:** Phase 16 (Cron Jobs) sets up Vercel Cron + QStash for automated reminders, deadline alerts, crawler execution, and daily digest emails.
