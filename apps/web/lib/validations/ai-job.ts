import { z } from "zod";

const aiJobTypeSchema = z.enum([
  "BUSINESS_PLAN",
  "RESEARCH",
  "OCR",
  "TRANSCRIBE",
  "SUMMARY",
  "JOURNAL_DRAFT",
  "FINANCIAL_ANALYSIS",
  "GAP_DIAGNOSIS",
  "EVALUATION",
  "MATCHING",
]);

const aiTierSchema = z.enum(["LOCAL_MLX", "API_HAIKU", "API_OPUS", "CLI_CLAUDE"]);

const jobStatusSchema = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]);

export const aiJobCreateSchema = z.object({
  projectId: z.string().optional(),
  type: aiJobTypeSchema,
  input: z.record(z.string(), z.unknown()),
  skillPatternId: z.string().optional(),
  /** Optional tier override — if omitted, auto-resolved by resolveAiTier */
  tier: aiTierSchema.optional(),
});

export const aiJobQuerySchema = z.object({
  projectId: z.string().optional(),
  type: aiJobTypeSchema.optional(),
  status: jobStatusSchema.optional(),
  tier: aiTierSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const aiJobStatusUpdateSchema = z.object({
  status: jobStatusSchema,
  output: z.record(z.string(), z.unknown()).optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type AiJobCreateInput = z.infer<typeof aiJobCreateSchema>;
export type AiJobQueryInput = z.infer<typeof aiJobQuerySchema>;
export type AiJobStatusUpdateInput = z.infer<typeof aiJobStatusUpdateSchema>;
