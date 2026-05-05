import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const C3_MEDIA_COVERAGE = defineBlock({
  id: "C3",
  category: "C",
  name: "Media Coverage",
  nameKo: "미디어 노출",
  description: "Press / broadcast / SNS mentions.",
  variants: ["press-logo-bar", "article-card", "sns-embed"],
  priority: "optional",
  schema: z.object({
    items: z
      .array(
        z.object({
          outlet: z.string().min(1),
          title: z.string().optional(),
          url: z.string().optional(),
          logoSrc: z.string().optional(),
          publishedAt: z.string().optional(),
        }),
      )
      .min(1),
  }),
});
