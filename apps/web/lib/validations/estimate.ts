import { z } from "zod";

// ── Item schema ───────────────────────────────────────────────────────────────

export const estimateItemSchema = z.object({
  name: z.string().min(1, "name is required"),
  quantity: z.number().int().positive("quantity must be positive"),
  unitPrice: z.number().nonnegative("unitPrice must be non-negative"),
  amount: z.number().nonnegative("amount must be non-negative"),
});

export type EstimateItem = z.infer<typeof estimateItemSchema>;

// ── Create / Update ───────────────────────────────────────────────────────────

export const estimateCreateSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  projectId: z.string().optional(),
  items: z.array(estimateItemSchema).min(1, "at least one item is required"),
  totalAmount: z.number().nonnegative("totalAmount must be non-negative"),
  taxAmount: z.number().nonnegative("taxAmount must be non-negative").optional(),
  validUntil: z.string().datetime().optional().nullable(),
});

export const estimateUpdateSchema = z.object({
  projectId: z.string().optional().nullable(),
  items: z.array(estimateItemSchema).min(1).optional(),
  totalAmount: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).optional(),
});

// ── Query / Search ────────────────────────────────────────────────────────────

export const estimateSearchSchema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type EstimateCreateInput = z.infer<typeof estimateCreateSchema>;
export type EstimateUpdateInput = z.infer<typeof estimateUpdateSchema>;
export type EstimateSearchParams = z.infer<typeof estimateSearchSchema>;
