import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const B3_KEY_INGREDIENT = defineBlock({
  id: "B3",
  category: "B",
  name: "Key Ingredient / Tech",
  nameKo: "핵심 성분/기술",
  description: "Spotlight on signature ingredient, technology, or material.",
  variants: ["ingredient-spotlight", "tech-diagram", "material-closeup"],
  priority: "recommended",
  schema: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    properties: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    imageSrc: z.string().optional(),
  }),
});
