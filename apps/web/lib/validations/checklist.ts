import { z } from "zod";
import { ChecklistItemType, ProjectType } from "@prisma/client";

/**
 * checklistTemplateCreateSchema — validates the body for POST /api/checklist-templates.
 * orgId defaults to the caller's org (unless platform admin sets scope="platform").
 */
export const checklistTemplateCreateSchema = z.object({
  projectType: z.nativeEnum(ProjectType),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  scope: z.enum(["org", "platform"]).default("org"),
});

/**
 * checklistTemplateUpdateSchema — all fields optional for PATCH.
 */
export const checklistTemplateUpdateSchema = checklistTemplateCreateSchema.partial();

export type ChecklistTemplateCreateInput = z.infer<typeof checklistTemplateCreateSchema>;
export type ChecklistTemplateUpdateInput = z.infer<typeof checklistTemplateUpdateSchema>;

/**
 * Template item schemas — for CRUD on ChecklistTemplateItem rows.
 */
export const checklistTemplateItemCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  itemType: z.nativeEnum(ChecklistItemType).default(ChecklistItemType.DOCUMENT),
  certificateType: z.string().optional(),
});

export const checklistTemplateItemUpdateSchema =
  checklistTemplateItemCreateSchema.partial();

export const checklistTemplateItemReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
});

export type ChecklistTemplateItemCreateInput = z.infer<
  typeof checklistTemplateItemCreateSchema
>;
export type ChecklistTemplateItemUpdateInput = z.infer<
  typeof checklistTemplateItemUpdateSchema
>;
