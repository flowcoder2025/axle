import { prisma } from "@axle/db";
import type { SkillPattern } from "@prisma/client";

/**
 * Agent Bridge API — handles the LoRA adapter promotion for LOCAL_MLX.
 *
 * The bridge is a separate service (see AGENT_BRIDGE_URL) responsible for
 * downloading the fine-tuned adapter and loading it into the local MLX
 * inference runtime. This module only implements the state machine and
 * the HTTP handshake — the actual Unsloth training is done elsewhere.
 */
interface AgentBridgeConfig {
  url: string;
  token: string;
}

function readBridgeConfig(): AgentBridgeConfig | null {
  const url = process.env.AGENT_BRIDGE_URL;
  const token = process.env.AGENT_BRIDGE_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/**
 * POST to the agent bridge to promote a LoRA adapter for local inference.
 * Returns { ok, errorMessage } — never throws. Callers decide state transitions.
 */
export async function postAdapterToBridge(input: {
  patternId: string;
  taskType: string;
  adapterUrl: string;
}): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  const cfg = readBridgeConfig();
  if (!cfg) {
    return {
      ok: false,
      errorMessage:
        "AGENT_BRIDGE_URL/AGENT_BRIDGE_TOKEN not configured — cannot promote",
    };
  }

  try {
    const res = await fetch(`${cfg.url}/adapters/promote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        patternId: input.patternId,
        taskType: input.taskType,
        adapterUrl: input.adapterUrl,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        errorMessage: `Bridge returned ${res.status}: ${body.slice(0, 300)}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : "Unknown bridge error",
    };
  }
}

/**
 * Valid state transitions for the fine-tune / promotion state machine.
 *
 *   IDLE         → CANDIDATE       (auto: successCount >= 10 on learning tick)
 *   CANDIDATE    → QUEUED          (user clicks "파인튜닝 시작" in admin UI)
 *   QUEUED       → FINE_TUNING     (agent-bridge pulls job and starts training)
 *   FINE_TUNING  → COMPLETED       (training done; adapter available)
 *   FINE_TUNING  → FAILED          (training error)
 *   COMPLETED    → PROMOTED        (promoteToLocalMlx succeeds; isFineTuned=true)
 *   COMPLETED    → FAILED          (promoteToLocalMlx fails)
 *   FAILED       → QUEUED          (retry)
 *   PROMOTED     → IDLE / CANDIDATE (demote — new fine-tune cycle)
 */
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  IDLE: new Set(["CANDIDATE", "QUEUED"]),
  CANDIDATE: new Set(["QUEUED", "IDLE"]),
  QUEUED: new Set(["FINE_TUNING", "FAILED", "IDLE"]),
  FINE_TUNING: new Set(["COMPLETED", "FAILED"]),
  COMPLETED: new Set(["PROMOTED", "FAILED"]),
  PROMOTED: new Set(["IDLE", "CANDIDATE"]),
  FAILED: new Set(["QUEUED", "IDLE"]),
};

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid SkillPattern status transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Transition the pattern status, enforcing the state machine.
 */
export async function transitionStatus(
  patternId: string,
  target:
    | "IDLE"
    | "CANDIDATE"
    | "QUEUED"
    | "FINE_TUNING"
    | "COMPLETED"
    | "PROMOTED"
    | "FAILED",
  extra: Partial<Pick<SkillPattern, "errorMessage" | "loraAdapterUrl">> = {},
): Promise<SkillPattern> {
  const current = await prisma.skillPattern.findUnique({
    where: { id: patternId },
  });
  if (!current) {
    throw new Error(`SkillPattern ${patternId} not found`);
  }

  if (current.status === target) {
    return current;
  }

  if (!canTransition(current.status, target)) {
    throw new InvalidTransitionError(current.status, target);
  }

  const data: Record<string, unknown> = { status: target, ...extra };
  if (target === "FINE_TUNING") data.fineTuneStartedAt = new Date();
  if (target === "COMPLETED") data.fineTuneCompletedAt = new Date();
  if (target === "PROMOTED") {
    data.promotedAt = new Date();
    data.isFineTuned = true;
    data.errorMessage = null;
  }
  if (target === "FAILED" && !extra.errorMessage) {
    data.errorMessage = "Unknown error";
  }

  return prisma.skillPattern.update({ where: { id: patternId }, data });
}

/**
 * Mark a candidate pattern as QUEUED for fine-tuning.
 * Triggered by an admin clicking "파인튜닝 시작" in the UI.
 */
export async function queueForFineTune(
  patternId: string,
): Promise<SkillPattern> {
  const pattern = await prisma.skillPattern.findUnique({
    where: { id: patternId },
  });
  if (!pattern) {
    throw new Error(`SkillPattern ${patternId} not found`);
  }

  if (pattern.successCount < 10) {
    throw new Error(
      `SkillPattern ${patternId} has only ${pattern.successCount} successes — need >= 10`,
    );
  }

  if (!["IDLE", "CANDIDATE", "FAILED"].includes(pattern.status)) {
    throw new InvalidTransitionError(pattern.status, "QUEUED");
  }

  return transitionStatus(patternId, "QUEUED");
}

/**
 * Promote a COMPLETED pattern to LOCAL_MLX.
 * Calls agent-bridge to load the LoRA adapter. On success → PROMOTED + isFineTuned=true.
 * On failure → FAILED + errorMessage.
 */
export async function promoteToLocalMlx(
  patternId: string,
): Promise<SkillPattern> {
  const pattern = await prisma.skillPattern.findUnique({
    where: { id: patternId },
  });
  if (!pattern) {
    throw new Error(`SkillPattern ${patternId} not found`);
  }

  if (pattern.status !== "COMPLETED") {
    throw new InvalidTransitionError(pattern.status, "PROMOTED");
  }

  if (!pattern.loraAdapterUrl) {
    return transitionStatus(patternId, "FAILED", {
      errorMessage: "Missing loraAdapterUrl — cannot promote",
    });
  }

  const bridgeResult = await postAdapterToBridge({
    patternId: pattern.id,
    taskType: pattern.taskType,
    adapterUrl: pattern.loraAdapterUrl,
  });

  if (!bridgeResult.ok) {
    return transitionStatus(patternId, "FAILED", {
      errorMessage: bridgeResult.errorMessage,
    });
  }

  return transitionStatus(patternId, "PROMOTED");
}

/**
 * Mark a fine-tuning job as complete + immediately try to promote.
 * Called by the agent-bridge webhook (or admin action) once training finishes.
 */
export async function markFineTuneComplete(
  patternId: string,
  loraAdapterUrl: string,
): Promise<SkillPattern> {
  await transitionStatus(patternId, "COMPLETED", { loraAdapterUrl });
  return promoteToLocalMlx(patternId);
}

/**
 * Check if a given taskType has any promoted pattern available for local inference.
 */
export async function hasPromotedPatternFor(taskType: string): Promise<boolean> {
  const count = await prisma.skillPattern.count({
    where: { taskType, status: "PROMOTED" },
  });
  return count > 0;
}
