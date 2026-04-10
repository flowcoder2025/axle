import { z } from "zod";

export const emailTypeSchema = z.enum([
  "DOC_REQUEST",
  "DOC_PUSH",
  "MEETING_SUMMARY",
  "ESTIMATE",
  "CONTRACT",
  "JOURNAL_REMINDER",
  "DEADLINE_ALERT",
  "MATCHING_DIGEST",
  "ONBOARDING",
]);

export const emailLogQuerySchema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  type: emailTypeSchema.optional(),
  channel: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type EmailLogQueryParams = z.infer<typeof emailLogQuerySchema>;
