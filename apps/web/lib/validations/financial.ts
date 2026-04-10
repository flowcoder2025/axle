import { z } from "zod";

export const clientFinancialCreateSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  revenue: z.number().nonnegative().optional(),
  operatingProfit: z.number().optional(),
  netProfit: z.number().optional(),
  totalAssets: z.number().nonnegative().optional(),
  totalLiabilities: z.number().nonnegative().optional(),
  totalEquity: z.number().optional(),
  creditRating: z.string().optional(),
  source: z.string().optional(),
});

export const clientFinancialUpdateSchema = clientFinancialCreateSchema.partial().omit({ year: true });

export type ClientFinancialCreateInput = z.infer<typeof clientFinancialCreateSchema>;
export type ClientFinancialUpdateInput = z.infer<typeof clientFinancialUpdateSchema>;
