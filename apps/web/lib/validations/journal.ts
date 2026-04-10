import { z } from "zod";

export const journalStatusSchema = z.enum(["DRAFT", "SUBMITTED", "APPROVED"]);

export const journalCreateSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  researcherContactId: z.string().min(1, "researcherContactId is required"),
  date: z.string().datetime("date must be a valid ISO 8601 datetime"),
  title: z.string().min(1, "title is required"),
  content: z.string().min(1, "content is required"),
  objectives: z.string().optional(),
  results: z.string().optional(),
  nextSteps: z.string().optional(),
  hours: z.number().positive().optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const journalUpdateSchema = journalCreateSchema
  .omit({ clientId: true, researcherContactId: true })
  .partial();

export const journalQuerySchema = z.object({
  clientId: z.string().optional(),
  researcherContactId: z.string().optional(),
  status: journalStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const monthlyReportSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export type JournalCreateInput = z.infer<typeof journalCreateSchema>;
export type JournalUpdateInput = z.infer<typeof journalUpdateSchema>;
export type JournalQueryParams = z.infer<typeof journalQuerySchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
