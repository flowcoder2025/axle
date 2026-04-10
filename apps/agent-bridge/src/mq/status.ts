/**
 * WI-119: MQ Status Manager
 *
 * Reads and writes the status.json file that tracks the Claude MQ state.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "../config.js";

export type MqStatusValue = "idle" | "processing" | "error";

export interface MqStatus {
  status: MqStatusValue;
  currentJobId?: string;
  updatedAt: string; // ISO 8601
  errorMessage?: string;
}

const DEFAULT_STATUS: MqStatus = {
  status: "idle",
  updatedAt: new Date().toISOString(),
};

export async function readMqStatus(): Promise<MqStatus> {
  try {
    const raw = await readFile(config.CLAUDE_MQ_STATUS_FILE, "utf8");
    return JSON.parse(raw) as MqStatus;
  } catch {
    return { ...DEFAULT_STATUS };
  }
}

export async function writeMqStatus(
  patch: Partial<Omit<MqStatus, "updatedAt">>
): Promise<MqStatus> {
  const current = await readMqStatus();
  const next: MqStatus = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(config.CLAUDE_MQ_STATUS_FILE), { recursive: true });
  await writeFile(config.CLAUDE_MQ_STATUS_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function setMqIdle(): Promise<MqStatus> {
  return writeMqStatus({ status: "idle", currentJobId: undefined, errorMessage: undefined });
}

export async function setMqProcessing(jobId: string): Promise<MqStatus> {
  return writeMqStatus({ status: "processing", currentJobId: jobId, errorMessage: undefined });
}

export async function setMqError(jobId: string, errorMessage: string): Promise<MqStatus> {
  return writeMqStatus({ status: "error", currentJobId: jobId, errorMessage });
}
