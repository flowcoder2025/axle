import { z } from "zod";

const actionStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "DONE"]);

export const actionItemCreateSchema = z.object({
  description: z.string().min(1, "description is required"),
  assigneeUserId: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const actionItemUpdateSchema = z.object({
  description: z.string().min(1, "description is required").optional(),
  status: actionStatusSchema.optional(),
  assigneeUserId: z.string().optional().nullable(),
  assigneeContactId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  linkedChecklistId: z.string().optional().nullable(),
});

export type ActionItemCreateInput = z.infer<typeof actionItemCreateSchema>;
export type ActionItemUpdateInput = z.infer<typeof actionItemUpdateSchema>;
