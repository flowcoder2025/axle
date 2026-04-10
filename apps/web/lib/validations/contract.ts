import { z } from "zod";

// ── Party schema ──────────────────────────────────────────────────────────────

export const contractPartySchema = z.object({
  name: z.string().min(1, "name is required"),
  representative: z.string().min(1, "representative is required"),
  businessNumber: z.string().optional(),
  address: z.string().optional(),
});

export type ContractParty = z.infer<typeof contractPartySchema>;

// ── Term schema ───────────────────────────────────────────────────────────────

export const contractTermSchema = z.object({
  title: z.string().min(1, "title is required"),
  content: z.string().min(1, "content is required"),
  order: z.number().int().positive("order must be positive"),
});

export type ContractTerm = z.infer<typeof contractTermSchema>;

// ── Create / Update ───────────────────────────────────────────────────────────

export const contractCreateSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  projectId: z.string().optional(),
  title: z.string().min(1, "title is required"),
  partyA: contractPartySchema,
  partyB: contractPartySchema,
  terms: z.array(contractTermSchema).min(1, "at least one term is required"),
  totalAmount: z.number().nonnegative().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const contractUpdateSchema = z.object({
  projectId: z.string().optional().nullable(),
  title: z.string().min(1).optional(),
  partyA: contractPartySchema.optional(),
  partyB: contractPartySchema.optional(),
  terms: z.array(contractTermSchema).min(1).optional(),
  totalAmount: z.number().nonnegative().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "SIGNED", "EXPIRED"]).optional(),
});

export const contractSignSchema = z.object({
  signatureDataUrl: z.string().min(1, "signatureDataUrl is required"),
});

// ── Query / Search ────────────────────────────────────────────────────────────

export const contractSearchSchema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "SIGNED", "EXPIRED"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
export type ContractSearchParams = z.infer<typeof contractSearchSchema>;
export type ContractSignInput = z.infer<typeof contractSignSchema>;
