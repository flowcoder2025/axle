import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const D3_PACKAGE_CONTENTS = defineBlock({
  id: "D3",
  category: "D",
  name: "Package Contents",
  nameKo: "구성품/세트",
  description: "What's in the box / set composition.",
  variants: ["grid-layout", "exploded-view", "bundle-card"],
  priority: "optional",
  schema: z.object({
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          quantity: z.number().int().positive().optional(),
          imageSrc: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .min(1),
  }),
});
