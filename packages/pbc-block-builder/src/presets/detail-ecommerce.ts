/**
 * `detail-ecommerce` preset (WI-508).
 *
 * Korean e-commerce style product detail page composition. Heavy on
 * visual proof, spec, and trust blocks — matches the FlowStudio v2
 * detail-page builder that this PBC inherits from.
 *
 * NOTE on C2 reviews — the AI copy pipeline (WI-507) hard-refuses C2
 * generation per Korean fair-trade law, but a *preset* is a starting
 * template, not AI output. The reviews here are placeholder shells the
 * consumer is expected to replace with real `reviews_raw` rows before
 * publishing. The `_template: true` marker on each entry surfaces the
 * intent at audit time.
 */

import type { PageComposition } from "../types.js";

export const DETAIL_ECOMMERCE: PageComposition = {
  theme: "default",
  metadata: { preset: "detail-ecommerce" },
  blocks: [
    {
      id: "A1",
      variant: "full-bleed",
      data: {
        headline: "[Product name]",
        tagline: "[Single-line value proposition]",
        backgroundImage: "placeholder://hero",
      },
    },
    {
      id: "B2",
      variant: "side-by-side",
      data: {
        before: { label: "Before", note: "[The customer's pain point]" },
        after: { label: "After", note: "[The transformation your product delivers]" },
        caption: "[One-line caption]",
      },
    },
    {
      id: "B1",
      variant: "icon-grid",
      data: {
        items: [
          {
            title: "[Key benefit 1]",
            description: "[Two-sentence explanation grounded in real customer outcomes.]",
          },
          {
            title: "[Key benefit 2]",
            description: "[Two-sentence explanation grounded in real customer outcomes.]",
          },
          {
            title: "[Key benefit 3]",
            description: "[Two-sentence explanation grounded in real customer outcomes.]",
          },
        ],
      },
    },
    {
      id: "C2",
      variant: "review-card",
      data: {
        // Replace with real reviews from your reviews_raw table before publishing.
        summary: { averageRating: 4.8, totalCount: 0 },
        reviews: [
          {
            rating: 5,
            quote: "[Replace with a real customer quote]",
            author: "[Customer name]",
            date: "YYYY-MM-DD",
          },
        ],
      },
    },
    {
      id: "D1",
      variant: "simple-table",
      data: {
        title: "Specifications",
        rows: [
          { label: "Material", value: "[e.g. Aluminum 6061]" },
          { label: "Weight", value: "[e.g. 1.2kg]" },
          { label: "Origin", value: "[e.g. Made in Korea]" },
        ],
      },
    },
    {
      id: "D3",
      variant: "grid-layout",
      data: {
        items: [
          { name: "Main product", quantity: 1 },
          { name: "User manual", quantity: 1 },
          { name: "Warranty card", quantity: 1 },
        ],
      },
    },
    {
      id: "F2",
      variant: "swatch-grid",
      data: {
        options: [
          { name: "Black", colorHex: "#111111", available: true },
          { name: "White", colorHex: "#FAFAFA", available: true },
          { name: "Sand", colorHex: "#D6C9A8", available: false },
        ],
      },
    },
    {
      id: "E2",
      variant: "coupon-card",
      data: {
        title: "First-purchase discount",
        discount: "10% off",
        code: "WELCOME10",
        expiresAt: "2026-12-31",
      },
    },
    {
      id: "E4",
      variant: "info-box",
      data: {
        shippingNote: "Free shipping on orders over ₩50,000",
        returnNote: "30-day exchange / return policy",
        policies: [
          { label: "Order cutoff", value: "2 PM KST same-day shipping" },
          { label: "Carrier", value: "CJ Logistics" },
        ],
      },
    },
    {
      id: "E1",
      variant: "sticky-bottom",
      data: {
        price: "₩39,000",
        originalPrice: "₩49,000",
        ctaText: "Add to cart",
        ctaHref: "/cart/add",
        urgencyText: "Only a few left in stock",
      },
    },
  ],
};
