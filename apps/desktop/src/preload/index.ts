/**
 * Preload script: exposes a narrow, typed axle API to the renderer via contextBridge.
 * All methods go through IPC — renderer has zero direct Node access.
 */

import type { IpcRenderer } from "electron";

declare const contextBridge: {
  exposeInMainWorld(key: string, value: unknown): void;
};
declare const ipcRenderer: IpcRenderer;

// ---------------------------------------------------------------------------
// Type definitions for the exposed API
// ---------------------------------------------------------------------------

export interface RecordingInfo {
  filePath: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
}

export interface RecorderState {
  status: "idle" | "recording" | "paused" | "stopped";
  durationMs: number;
}

export interface CertSubject {
  commonName: string;
  organization?: string;
  country?: string;
}

export interface CertInfo {
  id: string;
  filePath: string;
  subject: CertSubject;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
}

export interface PortalSession {
  sessionId: string;
  portal: "hometax" | "minwon24" | "insurance" | "venturein" | "koita";
  loggedInAt: string;
}

export interface PortalScrapeResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface AgentHealth {
  status: "ok" | "degraded" | "offline";
  version: string;
  latencyMs: number;
}

export interface TranscribeResult {
  text: string;
  language?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

// ---------------------------------------------------------------------------
// Exposed window.axle API
// ---------------------------------------------------------------------------

const axleAPI = {
  recorder: {
    start: (): Promise<void> => ipcRenderer.invoke("recorder:start"),
    stop: (): Promise<RecordingInfo> => ipcRenderer.invoke("recorder:stop"),
    pause: (): Promise<void> => ipcRenderer.invoke("recorder:pause"),
    resume: (): Promise<void> => ipcRenderer.invoke("recorder:resume"),
    getState: (): Promise<RecorderState> => ipcRenderer.invoke("recorder:getState"),
  },

  cert: {
    load: (filePath: string, password: string): Promise<CertInfo> =>
      ipcRenderer.invoke("cert:load", filePath, password),
    list: (): Promise<CertInfo[]> => ipcRenderer.invoke("cert:list"),
    verify: (id: string): Promise<boolean> => ipcRenderer.invoke("cert:verify", id),
    remove: (id: string): Promise<void> => ipcRenderer.invoke("cert:remove", id),
  },

  portal: {
    login: (
      portal: PortalSession["portal"],
      credentials: Record<string, string>
    ): Promise<PortalSession> => ipcRenderer.invoke("portal:login", portal, credentials),
    scrape: (
      sessionId: string,
      action: string,
      params?: Record<string, unknown>
    ): Promise<PortalScrapeResult> =>
      ipcRenderer.invoke("portal:scrape", sessionId, action, params),
    status: (sessionId: string): Promise<PortalSession | null> =>
      ipcRenderer.invoke("portal:status", sessionId),
    logout: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke("portal:logout", sessionId),
  },

  agent: {
    health: (): Promise<AgentHealth> => ipcRenderer.invoke("agent:health"),
    submit: (payload: Record<string, unknown>): Promise<{ jobId: string }> =>
      ipcRenderer.invoke("agent:submit", payload),
    transcribe: (filePath: string): Promise<TranscribeResult> =>
      ipcRenderer.invoke("agent:transcribe", filePath),
  },
} as const;

contextBridge.exposeInMainWorld("axle", axleAPI);

// ---------------------------------------------------------------------------
// TypeScript global augmentation (used by renderer tsconfig)
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    axle: typeof axleAPI;
  }
}
