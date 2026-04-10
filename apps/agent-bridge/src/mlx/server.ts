/**
 * WI-116: MLX Server Manager
 *
 * Manages the lifecycle of a local mlx_lm OpenAI-compatible server:
 * spawn, kill, health-check, auto-restart.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { config, mlxBaseUrl } from "../config.js";

export type MlxServerStatus = "stopped" | "starting" | "running" | "error";

export interface MlxServerState {
  status: MlxServerStatus;
  pid?: number;
  startedAt?: Date;
  lastError?: string;
  restartCount: number;
}

export class MlxServerManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private _state: MlxServerState = { status: "stopped", restartCount: 0 };
  private _shuttingDown = false;

  get state(): Readonly<MlxServerState> {
    return { ...this._state };
  }

  /**
   * Start the mlx_lm server subprocess.
   * No-op if already running or starting.
   */
  async start(): Promise<void> {
    if (
      this._state.status === "running" ||
      this._state.status === "starting"
    ) {
      return;
    }
    this._setState({ status: "starting" });
    this._spawn();
  }

  /**
   * Stop the server and cancel any pending restart.
   */
  async stop(): Promise<void> {
    this._shuttingDown = true;
    this._clearTimers();
    this._killProcess();
    this._setState({ status: "stopped", pid: undefined, startedAt: undefined });
  }

  /**
   * Perform a single HTTP health-check against /health or /v1/models.
   * Returns true when the server responds with 2xx.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${mlxBaseUrl()}/v1/models`, {
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  private _spawn(): void {
    const args = [
      "-m",
      "mlx_lm.server",
      "--model",
      config.MLX_MODEL_PATH,
      "--port",
      String(config.MLX_PORT),
      "--host",
      config.MLX_HOST,
    ];

    this.process = spawn("python3", args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    const pid = this.process.pid;
    this._setState({ pid });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line.includes("Application startup complete")) {
        this._setState({ status: "running", startedAt: new Date() });
        this.emit("started", this._state);
        this._startHealthTimer();
      }
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      // mlx_lm prints startup info to stderr — capture running signal too
      if (msg.includes("Application startup complete")) {
        this._setState({ status: "running", startedAt: new Date() });
        this.emit("started", this._state);
        this._startHealthTimer();
      }
      this.emit("log", msg);
    });

    this.process.on("exit", (code, signal) => {
      const lastError = `Process exited with code=${code} signal=${signal}`;
      this._setState({ status: "error", pid: undefined, lastError });
      this._clearTimers();
      this.emit("exit", { code, signal });

      if (!this._shuttingDown) {
        this._scheduleRestart();
      }
    });

    this.process.on("error", (err) => {
      const lastError = `Failed to spawn mlx_lm: ${err.message}`;
      this._setState({ status: "error", lastError });
      this.emit("error", err);

      if (!this._shuttingDown) {
        this._scheduleRestart();
      }
    });
  }

  private _killProcess(): void {
    if (this.process && !this.process.killed) {
      try {
        this.process.kill("SIGTERM");
      } catch {
        // already gone
      }
    }
    this.process = null;
  }

  private _startHealthTimer(): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(async () => {
      const ok = await this.healthCheck();
      if (!ok && this._state.status === "running") {
        this._setState({
          status: "error",
          lastError: "Health check failed",
        });
        this.emit("unhealthy");
        this._killProcess();
        if (!this._shuttingDown) {
          this._scheduleRestart();
        }
      }
    }, config.MLX_HEALTH_INTERVAL_MS);
  }

  private _scheduleRestart(): void {
    if (this.restartTimer) return;
    const count = this._state.restartCount + 1;
    this._setState({ restartCount: count });
    this.emit("restarting", { restartCount: count });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this._shuttingDown = false;
      this._setState({ status: "starting" });
      this._spawn();
    }, config.MLX_RESTART_DELAY_MS);
  }

  private _clearTimers(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private _setState(patch: Partial<MlxServerState>): void {
    this._state = { ...this._state, ...patch };
    this.emit("stateChange", this._state);
  }
}

// Singleton instance used across the application
export const mlxServer = new MlxServerManager();
