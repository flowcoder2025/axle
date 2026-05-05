import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const C1_CERTIFICATION = defineBlock({
  id: "C1",
  category: "C",
  name: "Certification / Awards",
  nameKo: "인증/수상",
  description: "Certifications, awards, and patents.",
  variants: ["badge-row", "certificate-gallery", "award-timeline"],
  priority: "recommended",
  schema: z.object({
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          issuer: z.string().optional(),
          year: z.number().int().optional(),
          imageSrc: z.string().optional(),
        }),
      )
      .min(1),
  }),
});
