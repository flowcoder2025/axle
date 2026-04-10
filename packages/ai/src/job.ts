import { prisma } from "@axle/db";
import type { Prisma } from "@prisma/client";
import { resolveAiTier } from "./router.js";
import type { CreateAiJobData, UpdateJobStatusData } from "./types.js";

/**
 * Create an AiJob record with QUEUED status.
 * Tier is auto-resolved via resolveAiTier() unless explicitly provided.
 */
export async function createAiJob(data: CreateAiJobData) {
  const tier = data.tier ?? resolveAiTier(data.type);

  return prisma.aiJob.create({
    data: {
      projectId: data.projectId,
      type: data.type,
      tier,
      status: "QUEUED",
      input: data.input as Prisma.InputJsonValue,
      skillPatternId: data.skillPatternId,
    },
  });
}

/**
 * Update job status, and optionally store output or error info.
 */
export async function updateJobStatus(
  jobId: string,
  data: UpdateJobStatusData
) {
  return prisma.aiJob.update({
    where: { id: jobId },
    data: {
      status: data.status,
      ...(data.output !== undefined
        ? { output: data.output as Prisma.InputJsonValue }
        : {}),
      ...(data.errorMessage !== undefined
        ? { errorMessage: data.errorMessage }
        : {}),
      ...(data.durationMs !== undefined
        ? { durationMs: data.durationMs }
        : {}),
    },
  });
}

/**
 * Retrieve a single job including its output field.
 */
export async function getJobResult(jobId: string) {
  return prisma.aiJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      projectId: true,
      type: true,
      tier: true,
      status: true,
      input: true,
      output: true,
      cost: true,
      durationMs: true,
      errorMessage: true,
      skillPatternId: true,
      createdAt: true,
    },
  });
}

/**
 * List all AI jobs belonging to a project, newest first.
 */
export async function getJobsByProject(projectId: string) {
  return prisma.aiJob.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      type: true,
      tier: true,
      status: true,
      cost: true,
      durationMs: true,
      errorMessage: true,
      createdAt: true,
    },
  });
}
