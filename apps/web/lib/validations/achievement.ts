import { z } from "zod";

const achievementTypeSchema = z.enum([
  "PATENT",
  "AWARD",
  "CONTRACT",
  "INVESTMENT",
  "CERTIFICATION",
]);

export const clientAchievementCreateSchema = z.object({
  type: achievementTypeSchema,
  title: z.string().min(1, "Title is required"),
  date: z.string().datetime({ offset: true }).optional(),
  amount: z.number().nonnegative().optional(),
  description: z.string().optional(),
  documentId: z.string().optional(),
});

export const clientAchievementUpdateSchema = clientAchievementCreateSchema.partial();

export type ClientAchievementCreateInput = z.infer<typeof clientAchievementCreateSchema>;
export type ClientAchievementUpdateInput = z.infer<typeof clientAchievementUpdateSchema>;
