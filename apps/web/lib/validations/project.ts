import { z } from "zod";

const projectTypeSchema = z.enum([
  "BUSINESS_PLAN",
  "VENTURE_CERT",
  "SOBOOJANG_CERT",
  "RESEARCH_INSTITUTE",
  "PATENT",
  "FINANCIAL_ANALYSIS",
  "RESEARCH_TASK",
  "BUNDLE",
]);

const projectStatusSchema = z.enum([
  "INTAKE",
  "DOC_COLLECTING",
  "IN_PROGRESS",
  "REVIEW",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
]);

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const feeTypeSchema = z.enum(["FIXED", "SUCCESS_RATE", "MONTHLY"]);

export const projectCreateSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  programId: z.string().optional(),
  parentId: z.string().optional(),
  type: projectTypeSchema,
  title: z.string().min(1, "title is required"),
  priority: prioritySchema.optional().default("MEDIUM"),
  assignedToId: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  memo: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  feeType: feeTypeSchema.optional(),
  feeAmount: z.number().nonnegative().optional(),
  successRate: z.number().min(0).max(100).optional(),
  isPaid: z.boolean().optional().default(false),
  /** Only used when type === 'BUNDLE'. Overrides default child types. */
  childTypes: z.array(projectTypeSchema).optional(),
});

export const projectUpdateSchema = z.object({
  title: z.string().min(1, "title is required").optional(),
  priority: prioritySchema.optional(),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  memo: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  feeType: feeTypeSchema.optional().nullable(),
  feeAmount: z.number().nonnegative().optional().nullable(),
  successRate: z.number().min(0).max(100).optional().nullable(),
  isPaid: z.boolean().optional(),
});

export const projectSearchSchema = z.object({
  clientId: z.string().optional(),
  type: projectTypeSchema.optional(),
  status: projectStatusSchema.optional(),
  assignedToId: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const projectStatusTransitionSchema = z.object({
  status: projectStatusSchema,
});

// ---- RESEARCH_TASK metadata ----

export const investigationItemSchema = z.object({
  topic: z.string().min(1, "topic is required"),
  description: z.string().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
});

export const researchTaskMetadataSchema = z.object({
  investigationItems: z
    .array(investigationItemSchema)
    .min(1, "at least one investigation item is required"),
  clientContext: z.unknown().optional(),
});

export type InvestigationItem = z.infer<typeof investigationItemSchema>;
export type ResearchTaskMetadata = z.infer<typeof researchTaskMetadataSchema>;

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type ProjectSearchParams = z.infer<typeof projectSearchSchema>;
export type ProjectStatusTransitionInput = z.infer<typeof projectStatusTransitionSchema>;
