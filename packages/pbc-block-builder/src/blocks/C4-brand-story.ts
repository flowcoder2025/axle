import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const C4_BRAND_STORY = defineBlock({
  id: "C4",
  category: "C",
  name: "Brand Story",
  nameKo: "브랜드 스토리",
  description: "Brand philosophy, founder introduction, mission.",
  variants: ["founder-letter", "brand-timeline", "mission-statement"],
  priority: "optional",
  schema: z.object({
    headline: z.string().min(1),
    body: z.string().min(1),
    founderName: z.string().optional(),
    founderImage: z.string().optional(),
    timeline: z
      .array(z.object({ year: z.number().int(), label: z.string() }))
      .optional(),
  }),
});
