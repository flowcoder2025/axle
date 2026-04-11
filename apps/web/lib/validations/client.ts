import { z } from "zod";

const clientStatusSchema = z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]);

export const clientCreateSchema = z.object({
  name: z.string().min(1, "name is required"),
  businessNumber: z.string().optional(),
  ceoName: z.string().optional(),
  industry: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("invalid email format").optional().or(z.literal("")),
  website: z.string().url("invalid URL format").optional().or(z.literal("")),
  memo: z.string().optional(),
  status: clientStatusSchema.optional().default("ACTIVE"),
  assignedToId: z.string().optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  capitalAmount: z.number().nonnegative().optional(),
  foundedDate: z.string().datetime().optional().nullable(),
  region: z.string().optional(),
  isVenture: z.boolean().optional().default(false),
  isInnoBiz: z.boolean().optional().default(false),
  isMainBiz: z.boolean().optional().default(false),
  isSocial: z.boolean().optional().default(false),
  ventureValidUntil: z.string().datetime().optional().nullable(),
  masterProfile: z.record(z.string(), z.unknown()).optional().nullable(),
  profileBlocks: z.array(z.unknown()).optional().nullable(),
});

export const clientUpdateSchema = clientCreateSchema.partial().omit({ name: true }).extend({
  name: z.string().min(1, "name is required").optional(),
});

export const clientSearchSchema = z.object({
  q: z.string().optional(),
  status: clientStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z
    .enum(["name", "createdAt", "updatedAt", "status"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
export type ClientSearchParams = z.infer<typeof clientSearchSchema>;
