import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const A3_PROBLEM_STATEMENT = defineBlock({
  id: "A3",
  category: "A",
  name: "Problem Statement",
  nameKo: "문제 제기",
  description: "Empathetic surfacing of customer pain points.",
  variants: ["question-list", "before-scene", "chat-bubble"],
  priority: "optional",
  schema: z.object({
    points: z.array(z.string().min(1)).min(1),
    intro: z.string().optional(),
  }),
});
