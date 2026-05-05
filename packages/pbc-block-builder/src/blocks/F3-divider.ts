import { z } from "zod";
import { defineBlock } from "./_helpers.js";

/**
 * F3 dividers are typically inserted automatically by the renderer between
 * category transitions. Authors rarely place these by hand; the schema is
 * intentionally minimal so auto-insertion stays cheap.
 */
export const F3_DIVIDER = defineBlock({
  id: "F3",
  category: "F",
  name: "Divider / Whitespace",
  nameKo: "구분선/여백",
  description: "Section transition — gradient line, pattern break, or pure whitespace.",
  variants: ["gradient-divider", "pattern-break", "whitespace"],
  priority: "automatic",
  schema: z.object({
    height: z.number().int().positive().optional(),
    label: z.string().optional(),
  }),
});
