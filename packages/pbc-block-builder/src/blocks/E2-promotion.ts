import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const E2_PROMOTION = defineBlock({
  id: "E2",
  category: "E",
  name: "Promotion / Coupon",
  nameKo: "프로모/할인",
  description: "Discounts, coupon codes, limited-time offers.",
  variants: ["coupon-card", "price-compare", "bundle-deal"],
  priority: "optional",
  schema: z.object({
    title: z.string().min(1),
    discount: z.string().optional(),
    code: z.string().optional(),
    expiresAt: z.string().optional(),
    description: z.string().optional(),
  }),
});
