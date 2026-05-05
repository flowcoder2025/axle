import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const B1_FEATURE_CARDS = defineBlock({
  id: "B1",
  category: "B",
  name: "Feature Cards",
  nameKo: "특장점 카드",
  description: "3–4 key advantages laid out as cards.",
  variants: ["icon-grid", "number-list", "photo-card"],
  priority: "required",
  schema: z.object({
    items: z
      .array(
        z.object({
          title: z.string().min(1),
          description: z.string().min(1),
          icon: z.string().optional(),
          imageSrc: z.string().optional(),
        }),
      )
      .min(2)
      .max(6),
  }),
});
