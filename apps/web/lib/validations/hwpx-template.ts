import { z } from "zod";

/**
 * HWPX template field mapping schema.
 *
 * Each entry in `fieldMap` binds a user-facing key (e.g. "company_name") to
 * a structured HWPX edit operation. At edit-time, POST /api/hwpx/edit receives
 * `values: Record<string, string | boolean>` and uses the mapping to generate
 * the `HwpxEdit[]` list consumed by `editHwpx()`.
 *
 * Three operation kinds match the HwpxEdit type union in @axle/docgen:
 *   - cell     → set_cell     (table/row/col indices → text value)
 *   - checkbox → toggle_checkbox (field name → boolean)
 *   - text     → replace_text  (global search/replace)
 */

export const HwpxFieldMapCellEntrySchema = z.object({
  type: z.literal("cell"),
  table: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
});

export const HwpxFieldMapCheckboxEntrySchema = z.object({
  type: z.literal("checkbox"),
  name: z.string().min(1),
});

export const HwpxFieldMapTextEntrySchema = z.object({
  type: z.literal("text"),
  search: z.string().min(1),
});

export const HwpxFieldMapEntrySchema = z.discriminatedUnion("type", [
  HwpxFieldMapCellEntrySchema,
  HwpxFieldMapCheckboxEntrySchema,
  HwpxFieldMapTextEntrySchema,
]);

export const HwpxFieldMapSchema = z.record(z.string(), HwpxFieldMapEntrySchema);

export type HwpxFieldMapEntry = z.infer<typeof HwpxFieldMapEntrySchema>;
export type HwpxFieldMap = z.infer<typeof HwpxFieldMapSchema>;

export const HwpxCategorySchema = z.enum([
  "VENTURE",
  "SOBOOJANG",
  "KOITA",
  "OTHER",
]);

export type HwpxCategory = z.infer<typeof HwpxCategorySchema>;

/** Template create (via multipart: file + metadata JSON). */
export const HwpxTemplateMetadataSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: HwpxCategorySchema,
  fieldMap: HwpxFieldMapSchema,
  orgId: z.string().cuid().optional(),
});

export type HwpxTemplateMetadata = z.infer<typeof HwpxTemplateMetadataSchema>;

/** Template patch — partial metadata update. */
export const HwpxTemplatePatchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    category: HwpxCategorySchema.optional(),
    fieldMap: HwpxFieldMapSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided",
  });

export type HwpxTemplatePatch = z.infer<typeof HwpxTemplatePatchSchema>;

/** POST /api/hwpx/edit body. */
export const HwpxEditRequestSchema = z.object({
  templateId: z.string().cuid(),
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
  filename: z.string().min(1).max(200).optional(),
  projectId: z.string().cuid().optional(),
  clientId: z.string().cuid().optional(),
});

export type HwpxEditRequest = z.infer<typeof HwpxEditRequestSchema>;
