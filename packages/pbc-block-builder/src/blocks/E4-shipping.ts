import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const E4_SHIPPING = defineBlock({
  id: "E4",
  category: "E",
  name: "Shipping & Returns",
  nameKo: "배송/교환",
  description: "Delivery, exchange, and return policy.",
  variants: ["info-box", "icon-list", "policy-table"],
  priority: "recommended",
  schema: z.object({
    shippingNote: z.string().min(1),
    returnNote: z.string().min(1),
    policies: z
      .array(z.object({ label: z.string().min(1), value: z.string().min(1) }))
      .optional(),
  }),
});
