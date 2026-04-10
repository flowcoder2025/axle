/**
 * WI-118: .claude-mq/ File Watcher
 *
 * Uses chokidar to watch the inbox directory for new .md task files.
 * On file detected: reads content and triggers the registered processor.
 */

import chokidar, { type FSWatcher } from "chokidar";
import { readFile, mkdir } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { config } from "../config.js";

export interface InboxEvent {
  filePath: string;
  content: string;
  detectedAt: Date;
}

export type InboxHandler = (event: InboxEvent) => Promise<void>;

export class MqWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private _watching = false;

  get isWatching(): boolean {
    return this._watching;
  }

  /**
   * Start watching the inbox directory.
   * Calls `handler` for every new .md file that appears.
   */
  async start(handler: InboxHandler): Promise<void> {
    if (this._watching) return;

    await mkdir(config.CLAUDE_MQ_INBOX, { recursive: true });
    await mkdir(config.CLAUDE_MQ_OUTBOX, { recursive: true });

    this.watcher = chokidar.watch(`${config.CLAUDE_MQ_INBOX}/*.md`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher.on("add", async (filePath: string) => {
      try {
        const content = await readFile(filePath, "utf8");
        const event: InboxEvent = {
          filePath,
          content,
          detectedAt: new Date(),
        };
        this.emit("inbox", event);
        await handler(event);
      } catch (err) {
        this.emit("error", err);
      }
    });

    this.watcher.on("error", (err: unknown) => {
      this.emit("error", err);
    });

    this._watching = true;
    this.emit("started", { inbox: config.CLAUDE_MQ_INBOX });
  }

  /** Stop the watcher. */
  async stop(): Promise<void> {
    if (!this._watching || !this.watcher) return;
    await this.watcher.close();
    this.watcher = null;
    this._watching = false;
    this.emit("stopped");
  }
}

// Singleton instance
export const mqWatcher = new MqWatcher();
