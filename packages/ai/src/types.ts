import type { AiJob, AiJobType, AiTier, JobStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type { AiJob, AiJobType, AiTier, JobStatus };

export interface CreateAiJobData {
  projectId?: string;
  type: AiJobType;
  input: Prisma.InputJsonValue;
  skillPatternId?: string;
  /** Override auto-resolved tier. If omitted, resolveAiTier() is used. */
  tier?: AiTier;
}

export interface UpdateJobStatusData {
  status: JobStatus;
  output?: Prisma.InputJsonValue;
  errorMessage?: string;
  durationMs?: number;
}
