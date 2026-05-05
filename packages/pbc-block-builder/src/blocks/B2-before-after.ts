import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const B2_BEFORE_AFTER = defineBlock({
  id: "B2",
  category: "B",
  name: "Before / After",
  nameKo: "비포/애프터",
  description: "Comparison of pre- and post-use states.",
  variants: ["side-by-side", "slider", "timeline"],
  priority: "recommended",
  schema: z.object({
    before: z.object({ label: z.string(), imageSrc: z.string().optional(), note: z.string().optional() }),
    after: z.object({ label: z.string(), imageSrc: z.string().optional(), note: z.string().optional() }),
    caption: z.string().optional(),
  }),
});
