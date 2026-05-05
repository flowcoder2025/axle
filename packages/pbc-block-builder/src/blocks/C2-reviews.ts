/**
 * C2 review data is REAL CUSTOMER reviews only — fabricated reviews violate
 * Korean fair-trade law. The AI copy pipeline (WI-507) MUST refuse to
 * generate this block's data and forward to a human-curated source instead.
 *
 * That contract is enforced at the pipeline layer; the schema here only
 * captures the wire shape.
 */

import { z } from "zod";
import { defineBlock } from "./_helpers.js";

export const C2_REVIEWS = defineBlock({
  id: "C2",
  category: "C",
  name: "Customer Reviews",
  nameKo: "리뷰/후기",
  description:
    "Selected customer reviews. Data MUST come from real reviews_raw — never AI-generated.",
  variants: ["review-card", "screenshot-stack", "star-summary"],
  priority: "required",
  schema: z.object({
    summary: z
      .object({
        averageRating: z.number().min(0).max(5),
        totalCount: z.number().int().nonnegative(),
      })
      .optional(),
    reviews: z
      .array(
        z.object({
          rating: z.number().min(0).max(5),
          quote: z.string().min(1),
          author: z.string().min(1),
          date: z.string().optional(),
          source: z.string().optional(),
        }),
      )
      .min(1),
  }),
});
