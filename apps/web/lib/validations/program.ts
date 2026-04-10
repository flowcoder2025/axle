import { z } from "zod";

export const programCategorySchema = z.enum([
  "STARTUP",
  "VENTURE",
  "RND",
  "CERTIFICATION",
  "EXPORT",
  "SMART_FACTORY",
  "GENERAL",
]);

export const programCreateSchema = z.object({
  name: z.string().min(1, "name is required"),
  category: programCategorySchema,
  agency: z.string().optional(),
  announcementUrl: z.string().url("invalid URL").optional().or(z.literal("")),
  announcementDocId: z.string().optional(),
  applicationStart: z.string().datetime().optional().nullable(),
  applicationEnd: z.string().datetime().optional().nullable(),
  maxFunding: z.number().nonnegative().optional().nullable(),
  requirements: z.record(z.string(), z.unknown()).optional().nullable(),
  eligibility: z.record(z.string(), z.unknown()).optional().nullable(),
  region: z.string().optional(),
  memo: z.string().optional(),
});

export const programUpdateSchema = programCreateSchema.partial();

export const programQuerySchema = z.object({
  category: programCategorySchema.optional(),
  region: z.string().optional(),
  hasDeadline: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ProgramCreateInput = z.infer<typeof programCreateSchema>;
export type ProgramUpdateInput = z.infer<typeof programUpdateSchema>;
export type ProgramQueryParams = z.infer<typeof programQuerySchema>;
