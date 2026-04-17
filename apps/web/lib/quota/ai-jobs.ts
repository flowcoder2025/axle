import { prisma } from "@axle/db";

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED";
  readonly used: number;
  readonly limit: number;

  constructor(used: number, limit: number) {
    super(`AI job quota exceeded: ${used}/${limit} this month`);
    this.used = used;
    this.limit = limit;
  }
}

export class OrgNotFoundError extends Error {
  readonly code = "ORG_NOT_FOUND";
  constructor(orgId: string) {
    super(`Organization not found: ${orgId}`);
  }
}

export type AiJobQuotaStatus = {
  used: number;
  limit: number;
  remaining: number;
};

function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getAiJobQuotaStatus(orgId: string): Promise<AiJobQuotaStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { quotaAiJobs: true },
  });
  if (!org) throw new OrgNotFoundError(orgId);

  const used = await prisma.aiJob.count({
    where: {
      createdAt: { gte: startOfMonth() },
      orgId,
    },
  });

  return {
    used,
    limit: org.quotaAiJobs,
    remaining: Math.max(0, org.quotaAiJobs - used),
  };
}

export async function assertAiJobQuota(orgId: string): Promise<AiJobQuotaStatus> {
  const status = await getAiJobQuotaStatus(orgId);
  if (status.used >= status.limit) {
    throw new QuotaExceededError(status.used, status.limit);
  }
  return status;
}
