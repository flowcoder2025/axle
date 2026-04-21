/**
 * fieldMap → HwpxEdit[] converter
 *
 * Each HwpxTemplate stores a structured mapping from user-facing field names
 * to HWPX edit targets (cell coordinates, checkbox names, text markers). At
 * edit time the caller submits `values`, and we translate those into the
 * concrete `HwpxEdit[]` list consumed by `editHwpx()`.
 */

import type { HwpxEdit } from "@axle/docgen";
import {
  HwpxFieldMapEntrySchema,
  type HwpxFieldMap,
} from "@/lib/validations/hwpx-template";

export class FieldMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldMapError";
  }
}

/**
 * Translate a user-provided `values` object into a list of HwpxEdit operations
 * using the mapping stored on the template.
 *
 * - Unknown keys in `values` are ignored (forward-compatible templates).
 * - Known keys with the wrong value type (e.g. checkbox receiving a string)
 *   throw `FieldMapError` — the API route should surface that as 400.
 */
export function buildEditsFromFieldMap(
  fieldMap: HwpxFieldMap,
  values: Record<string, string | boolean>
): HwpxEdit[] {
  const edits: HwpxEdit[] = [];

  for (const [fieldKey, rawEntry] of Object.entries(fieldMap)) {
    const parsed = HwpxFieldMapEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      throw new FieldMapError(
        `fieldMap.${fieldKey}: invalid entry — ${parsed.error.issues
          .map((i) => i.message)
          .join(", ")}`
      );
    }
    const entry = parsed.data;

    if (!(fieldKey in values)) {
      // Field is declared in the template but not supplied — skip it.
      // (Partial fills are allowed; applyEdits leaves untouched cells as-is.)
      continue;
    }

    const value = values[fieldKey];

    if (entry.type === "cell") {
      if (typeof value !== "string") {
        throw new FieldMapError(
          `fieldMap.${fieldKey}: cell value must be a string`
        );
      }
      edits.push({
        type: "set_cell",
        table: entry.table,
        row: entry.row,
        col: entry.col,
        value,
      });
    } else if (entry.type === "checkbox") {
      if (typeof value !== "boolean") {
        throw new FieldMapError(
          `fieldMap.${fieldKey}: checkbox value must be a boolean`
        );
      }
      edits.push({
        type: "toggle_checkbox",
        name: entry.name,
        checked: value,
      });
    } else if (entry.type === "text") {
      if (typeof value !== "string") {
        throw new FieldMapError(
          `fieldMap.${fieldKey}: text value must be a string`
        );
      }
      edits.push({
        type: "replace_text",
        search: entry.search,
        replacement: value,
      });
    }
  }

  return edits;
}
