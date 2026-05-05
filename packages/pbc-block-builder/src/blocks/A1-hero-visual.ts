import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const A1_HERO_VISUAL = defineBlock({
  id: "A1",
  category: "A",
  name: "Hero Visual",
  nameKo: "히어로 비주얼",
  description: "First-screen hero — primary product image with one-line headline.",
  variants: ["full-bleed", "split-half", "overlay-text"],
  priority: "required",
  schema: z.object({
    headline: z.string().min(1),
    tagline: z.string().optional(),
    backgroundImage: z.string().optional(),
    ctaText: z.string().optional(),
    ctaHref: z.string().optional(),
  }),
});
