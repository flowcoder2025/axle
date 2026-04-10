import { prisma } from "@axle/db";
import type { SkillPattern } from "@prisma/client";
import { createHash } from "crypto";

export interface PatternExtractionInput {
  aiJobId: string;
  type: string; // AiJobType
  input: unknown;
  output: unknown;
  success: boolean;
}

/**
 * Compute a stable SHA-256 hash for a given value by JSON-serialising it.
 * Unknown or circular objects fall back to an empty-object hash.
 */
function hashSchema(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value) ?? "{}";
  } catch {
    json = "{}";
  }
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

/**
 * Build the pattern signature: taskType + hash of the input shape.
 * Using only the input hash keeps the signature stable across runs with
 * different concrete values but the same structural shape.
 */
function buildSignature(taskType: string, input: unknown): string {
  return `${taskType}:${hashSchema(input)}`;
}

/**
 * Build a human-readable name for an auto-created pattern.
 */
function buildPatternName(taskType: string): string {
  return `Auto:${taskType}`;
}

/**
 * Extract a pattern from a completed AiJob and persist it.
 *
 * - Finds an existing SkillPattern matching (taskType + input schema hash).
 * - If found: increments successCount and updates lastUsedAt.
 * - If not found: creates a new SkillPattern record.
 * - Marks the pattern as a fine-tuning candidate when successCount >= 10.
 */
export async function extractAndStorePattern(
  data: PatternExtractionInput
): Promise<void> {
  // Only learn from successful completions
  if (!data.success) return;

  const signature = buildSignature(data.type, data.input);
  const inputSchema = { type: data.type, hash: hashSchema(data.input) };
  const outputSchema = { hash: hashSchema(data.output) };

  const existing = await prisma.skillPattern.findFirst({
    where: {
      taskType: data.type,
      // Match by the stored hash in inputSchema
      inputSchema: { equals: inputSchema },
    },
  });

  if (existing) {
    const newCount = existing.successCount + 1;
    await prisma.skillPattern.update({
      where: { id: existing.id },
      data: {
        successCount: newCount,
        lastUsedAt: new Date(),
        // Promote to fine-tuning candidate once threshold is reached
        ...(newCount >= 10 && !existing.isFineTuned
          ? { isFineTuned: false } // keep isFineTuned false — it means "candidate", markAsFineTuned sets true
          : {}),
      },
    });
  } else {
    await prisma.skillPattern.create({
      data: {
        name: buildPatternName(data.type),
        taskType: data.type,
        inputSchema,
        outputSchema,
        successCount: 1,
        lastUsedAt: new Date(),
        isFineTuned: false,
      },
    });
  }
}

/**
 * Find the best matching SkillPattern for the given task type and input.
 * Returns the pattern with the highest successCount among those whose
 * inputSchema hash matches, or null if none exists.
 */
export async function findMatchingPattern(
  taskType: string,
  input: unknown
): Promise<SkillPattern | null> {
  const inputSchema = { type: taskType, hash: hashSchema(input) };

  return prisma.skillPattern.findFirst({
    where: {
      taskType,
      inputSchema: { equals: inputSchema },
    },
    orderBy: { successCount: "desc" },
  });
}

/**
 * Return all patterns that have been seen >= 10 times and are not yet
 * marked as fine-tuned — these are candidates for a fine-tuning run.
 */
export async function getFineTuningCandidates(): Promise<SkillPattern[]> {
  return prisma.skillPattern.findMany({
    where: {
      successCount: { gte: 10 },
      isFineTuned: false,
    },
    orderBy: { successCount: "desc" },
  });
}

/**
 * Mark a pattern as having been used in a fine-tuning run.
 */
export async function markAsFineTuned(patternId: string): Promise<void> {
  await prisma.skillPattern.update({
    where: { id: patternId },
    data: { isFineTuned: true },
  });
}
