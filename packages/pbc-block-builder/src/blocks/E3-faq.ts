import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const E3_FAQ = defineBlock({
  id: "E3",
  category: "E",
  name: "FAQ",
  nameKo: "FAQ",
  description: "Frequently asked questions.",
  variants: ["accordion", "chat-style", "category-tab"],
  priority: "recommended",
  schema: z.object({
    items: z
      .array(
        z.object({
          question: z.string().min(1),
          answer: z.string().min(1),
          category: z.string().optional(),
        }),
      )
      .min(1),
  }),
});
