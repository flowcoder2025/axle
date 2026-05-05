import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const B4_USP_FULLSHOT = defineBlock({
  id: "B4",
  category: "B",
  name: "USP Full-shot",
  nameKo: "USP 풀샷",
  description: "Single image-led shot that condenses the unique selling proposition.",
  variants: ["infographic", "feature-callout", "comparison-table"],
  priority: "optional",
  schema: z.object({
    imageSrc: z.string().min(1),
    callouts: z
      .array(z.object({ label: z.string(), x: z.number().optional(), y: z.number().optional() }))
      .optional(),
    headline: z.string().optional(),
  }),
});
