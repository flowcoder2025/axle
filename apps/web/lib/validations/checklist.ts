import { z } from "zod";
import { ProjectType } from "@prisma/client";

/**
 * checklistTemplateCreateSchema — validates the body for POST /api/checklist-templates.
 * orgId is injected from the session, not accepted from the body.
 */
export const checklistTemplateCreateSchema = z.object({
  projectType: z.nativeEnum(ProjectType),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

/**
 * checklistTemplateUpdateSchema — all fields optional for PATCH.
 */
export const checklistTemplateUpdateSchema = checklistTemplateCreateSchema.partial();

export type ChecklistTemplateCreateInput = z.infer<typeof checklistTemplateCreateSchema>;
export type ChecklistTemplateUpdateInput = z.infer<typeof checklistTemplateUpdateSchema>;
