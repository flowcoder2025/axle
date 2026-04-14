import { z } from "zod";

export const OrgPatchSchema = z
  .object({
    plan: z.enum(["free", "pro", "enterprise"]).optional(),
    quotaAiJobs: z.number().int().min(0).optional(),
    quotaMembers: z.number().int().min(1).optional(),
    isSuspended: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });

export type OrgPatch = z.infer<typeof OrgPatchSchema>;

/** Subset allowed by the updatePlanQuota server action (no isSuspended). */
export const PlanQuotaSchema = z
  .object({
    plan: z.enum(["free", "pro", "enterprise"]).optional(),
    quotaAiJobs: z.number().int().min(0).optional(),
    quotaMembers: z.number().int().min(1).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });

export type PlanQuota = z.infer<typeof PlanQuotaSchema>;
