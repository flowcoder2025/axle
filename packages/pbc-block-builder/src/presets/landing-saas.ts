/**
 * `landing-saas` preset (WI-508).
 *
 * Conversion-oriented SaaS landing page composition. Mirrors the typical
 * above-the-fold → core value → trust → CTA narrative.
 *
 * The data is placeholder content meant to be replaced — but every block
 * payload validates against its zod schema so consumers can drop the
 * preset straight into `renderComposition()` without surgery.
 */

import type { PageComposition } from "../types.js";

export const LANDING_SAAS: PageComposition = {
  theme: "default",
  metadata: { preset: "landing-saas" },
  blocks: [
    {
      id: "A1",
      variant: "full-bleed",
      data: {
        headline: "Ship faster. Stress less.",
        tagline:
          "The opinionated platform that turns your ideas into production in days, not months.",
        ctaText: "Start free trial",
        ctaHref: "/signup",
      },
    },
    {
      id: "A3",
      data: {
        intro: "If any of these sound familiar, you are in the right place.",
        points: [
          "Shipping a new feature takes weeks of plumbing work",
          "Your CI is flaky and nobody owns it",
          "Onboarding a new engineer costs a sprint",
        ],
      },
    },
    {
      id: "B1",
      variant: "icon-grid",
      data: {
        items: [
          {
            title: "One-command setup",
            description:
              "Go from clone to running in 60 seconds — no env shaming.",
            icon: "⚡",
          },
          {
            title: "Built-in observability",
            description:
              "Logs, traces, and metrics wired in by default. Find issues before customers do.",
            icon: "📈",
          },
          {
            title: "Convention over configuration",
            description:
              "Sane defaults that scale from prototype to production.",
            icon: "🧭",
          },
        ],
      },
    },
    {
      id: "C5",
      variant: "stat-card",
      data: {
        items: [
          { label: "Teams shipping daily", value: "2,400+" },
          { label: "Average deploy time", value: "47", unit: "s" },
          { label: "Customer NPS", value: "72" },
        ],
      },
    },
    {
      id: "C1",
      variant: "badge-row",
      data: {
        items: [
          { name: "SOC 2 Type II", issuer: "AICPA", year: 2025 },
          { name: "ISO 27001", issuer: "ISO", year: 2024 },
          { name: "GDPR Ready", issuer: "EU" },
        ],
      },
    },
    {
      id: "E3",
      variant: "accordion",
      data: {
        items: [
          {
            question: "Is there a free tier?",
            answer:
              "Yes — every account starts on the free tier. No credit card required.",
          },
          {
            question: "Can I self-host?",
            answer:
              "Enterprise plans include a self-hosted option with the same feature set.",
          },
          {
            question: "How does pricing scale?",
            answer:
              "Pricing scales with active developers, not with usage spikes.",
          },
        ],
      },
    },
    {
      id: "E1",
      variant: "sticky-bottom",
      data: {
        price: "$0",
        ctaText: "Start free trial",
        ctaHref: "/signup",
        urgencyText: "Cancel anytime. No credit card required.",
      },
    },
  ],
};
