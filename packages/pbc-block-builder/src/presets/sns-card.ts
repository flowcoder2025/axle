/**
 * `sns-card` preset (WI-508).
 *
 * Compact composition sized for a single SNS post (Instagram square,
 * Threads / X card). Three or four blocks total — anything more bloats
 * the card past a single screen on mobile.
 */

import type { PageComposition } from "../types.js";

export const SNS_CARD: PageComposition = {
  theme: "default",
  metadata: { preset: "sns-card" },
  blocks: [
    {
      id: "A1",
      variant: "overlay-text",
      data: {
        headline: "[Hook headline]",
        backgroundImage: "placeholder://card-bg",
      },
    },
    {
      id: "A2",
      variant: "bold-center",
      data: {
        line: "[One-line zinger that earns the swipe]",
      },
    },
    {
      id: "F1",
      variant: "full-photo",
      data: {
        images: [{ src: "placeholder://lifestyle", alt: "Lifestyle shot" }],
        aspectRatio: "1 / 1",
      },
    },
    {
      id: "E1",
      variant: "inline-banner",
      data: {
        price: "—",
        ctaText: "Link in bio",
        ctaHref: "/bio",
      },
    },
  ],
};
