import { z } from "zod";

const docStatusSchema = z.enum(["PENDING", "REQUESTED", "UPLOADED", "VERIFIED"]);

/**
 * checklistItemCreateSchema — validates POST body for creating a checklist item manually.
 * projectId is injected from the URL param, not from the body.
 */
export const checklistItemCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
});

/**
 * checklistItemUpdateSchema — validates PATCH body.
 * Allows updating status and linking a documentId.
 */
export const checklistItemUpdateSchema = z.object({
  status: docStatusSchema.optional(),
  documentId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
});

export type ChecklistItemCreateInput = z.infer<typeof checklistItemCreateSchema>;
export type ChecklistItemUpdateInput = z.infer<typeof checklistItemUpdateSchema>;
