import { z } from "zod";

export const autoTypeSchema = z.enum([
  "HOMETAX_ISSUE",
  "MINWON24_ISSUE",
  "INSURANCE_ISSUE",
  "PORTAL_UPLOAD",
  "DART_FETCH",
]);

export const jobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const automationLogSearchSchema = z.object({
  clientId: z.string().optional(),
  type: autoTypeSchema.optional(),
  status: jobStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AutomationLogSearch = z.infer<typeof automationLogSearchSchema>;
export type AutoType = z.infer<typeof autoTypeSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
