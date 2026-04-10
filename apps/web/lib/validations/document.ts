import { z } from "zod";

const docCategorySchema = z.enum(["INPUT", "OUTPUT", "TEMPLATE", "ISSUED"]);
const ocrStatusSchema = z.enum(["NONE", "PROCESSING", "COMPLETED", "FAILED"]);

export const documentUploadSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  projectId: z.string().optional(),
  category: docCategorySchema,
  name: z.string().optional(),
  parentDocId: z.string().optional(),
});

export const documentUpdateSchema = z.object({
  category: docCategorySchema.optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  autoRenew: z.boolean().optional(),
});

export const documentSearchSchema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  category: docCategorySchema.optional(),
  ocrStatus: ocrStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentSearchParams = z.infer<typeof documentSearchSchema>;
