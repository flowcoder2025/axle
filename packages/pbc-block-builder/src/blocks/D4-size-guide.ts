import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const D4_SIZE_GUIDE = defineBlock({
  id: "D4",
  category: "D",
  name: "Size Guide",
  nameKo: "사이즈 가이드",
  description: "Dimensions, fit chart, real-wear photos.",
  variants: ["size-chart", "body-overlay", "real-wear"],
  priority: "optional",
  schema: z.object({
    chart: z.object({
      headers: z.array(z.string().min(1)).min(1),
      rows: z.array(z.array(z.string())).min(1),
    }),
    note: z.string().optional(),
    realWearImages: z.array(z.string()).optional(),
  }),
});
