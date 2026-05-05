import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const D1_SPEC_TABLE = defineBlock({
  id: "D1",
  category: "D",
  name: "Spec Table",
  nameKo: "스펙 테이블",
  description: "Product specifications or nutritional information.",
  variants: ["simple-table", "compare-table", "tab-table"],
  priority: "required",
  schema: z.object({
    rows: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
        }),
      )
      .min(1),
    title: z.string().optional(),
  }),
});
