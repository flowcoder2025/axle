import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const E1_CTA_BANNER = defineBlock({
  id: "E1",
  category: "E",
  name: "CTA Banner",
  nameKo: "CTA 배너",
  description: "Buy / add-to-cart driver. Often sticky on mobile.",
  variants: ["sticky-bottom", "inline-banner", "urgency-timer"],
  priority: "required",
  schema: z.object({
    price: z.string().min(1),
    originalPrice: z.string().optional(),
    ctaText: z.string().min(1),
    ctaHref: z.string().min(1),
    urgencyText: z.string().optional(),
  }),
});
