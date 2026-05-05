import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const F2_COLOR_OPTIONS = defineBlock({
  id: "F2",
  category: "F",
  name: "Color / Options",
  nameKo: "컬러/옵션",
  description: "Color variants and product option showcase.",
  variants: ["swatch-grid", "option-card", "color-lifestyle"],
  priority: "optional",
  schema: z.object({
    options: z
      .array(
        z.object({
          name: z.string().min(1),
          colorHex: z.string().optional(),
          imageSrc: z.string().optional(),
          available: z.boolean().optional(),
        }),
      )
      .min(1),
  }),
});
