import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const C5_NUMBERS = defineBlock({
  id: "C5",
  category: "C",
  name: "Numbers",
  nameKo: "숫자로 보기",
  description: "Headline statistics — sales volume, satisfaction, etc.",
  variants: ["counter-row", "stat-card", "progress-bar"],
  priority: "recommended",
  schema: z.object({
    items: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
          unit: z.string().optional(),
          context: z.string().optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
});
