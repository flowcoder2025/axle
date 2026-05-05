import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const A2_ONELINE_HOOK = defineBlock({
  id: "A2",
  category: "A",
  name: "One-line Hook",
  nameKo: "원라인 후킹",
  description: "Single intense line of copy with strong background treatment.",
  variants: ["bold-center", "handwriting", "highlight-box"],
  priority: "recommended",
  schema: z.object({
    line: z.string().min(1),
    backgroundColor: z.string().optional(),
    accent: z.string().optional(),
  }),
});
