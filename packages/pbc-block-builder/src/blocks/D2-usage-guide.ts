import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const D2_USAGE_GUIDE = defineBlock({
  id: "D2",
  category: "D",
  name: "Usage Guide",
  nameKo: "사용법/활용",
  description: "Step-by-step instructions or how-to walkthrough.",
  variants: ["step-list", "photo-step", "video-embed"],
  priority: "recommended",
  schema: z.object({
    steps: z
      .array(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          imageSrc: z.string().optional(),
        }),
      )
      .min(1),
    videoUrl: z.string().optional(),
  }),
});
