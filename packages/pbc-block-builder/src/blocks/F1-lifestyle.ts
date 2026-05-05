import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const F1_LIFESTYLE = defineBlock({
  id: "F1",
  category: "F",
  name: "Lifestyle Shot",
  nameKo: "라이프스타일 컷",
  description: "Mood / lifestyle photography placed mid-page for visual rest.",
  variants: ["full-photo", "photo-grid", "carousel"],
  priority: "recommended",
  schema: z.object({
    images: z
      .array(z.object({ src: z.string().min(1), alt: z.string().optional() }))
      .min(1),
    aspectRatio: z.string().optional(),
  }),
});
