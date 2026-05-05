/**
 * `business-doc` preset (WI-508).
 *
 * Proposal / report / one-pager layout. Heavy on detail blocks (D-category)
 * since business docs lean on hard numbers, specs, and step-by-step plans.
 *
 * Designed to render cleanly through the DOCX-element adapter (WI-506) so
 * consumers can export the resulting `PageComposition` straight to Word.
 */

import type { PageComposition } from "../types.js";

export const BUSINESS_DOC: PageComposition = {
  theme: "default",
  metadata: { preset: "business-doc" },
  blocks: [
    {
      id: "A1",
      variant: "split-half",
      data: {
        headline: "[Document title]",
        tagline: "[Subtitle / engagement reference]",
      },
    },
    {
      id: "C4",
      variant: "mission-statement",
      data: {
        headline: "About",
        body: "[One-paragraph organizational summary tailored to this audience.]",
      },
    },
    {
      id: "A3",
      variant: "question-list",
      data: {
        intro: "Problem we are solving",
        points: [
          "[Pain point 1 — concrete and measurable]",
          "[Pain point 2 — concrete and measurable]",
          "[Pain point 3 — concrete and measurable]",
        ],
      },
    },
    {
      id: "B1",
      variant: "number-list",
      data: {
        items: [
          {
            title: "[Solution component 1]",
            description: "[How it addresses the problem above.]",
          },
          {
            title: "[Solution component 2]",
            description: "[How it addresses the problem above.]",
          },
          {
            title: "[Solution component 3]",
            description: "[How it addresses the problem above.]",
          },
        ],
      },
    },
    {
      id: "C5",
      variant: "stat-card",
      data: {
        items: [
          { label: "Expected impact", value: "[KPI value]" },
          { label: "Timeline", value: "[Weeks or months]" },
          { label: "Team", value: "[Headcount]" },
        ],
      },
    },
    {
      id: "D1",
      variant: "simple-table",
      data: {
        title: "Scope",
        rows: [
          { label: "In scope", value: "[Bullet 1, bullet 2]" },
          { label: "Out of scope", value: "[Bullet 1, bullet 2]" },
          { label: "Assumptions", value: "[Bullet 1, bullet 2]" },
        ],
      },
    },
    {
      id: "D2",
      variant: "step-list",
      data: {
        steps: [
          { title: "Discovery", description: "[Goals and success criteria.]" },
          { title: "Design", description: "[Architecture and review gates.]" },
          { title: "Build", description: "[Iteration plan and demos.]" },
          { title: "Launch", description: "[Rollout and acceptance.]" },
        ],
      },
    },
    {
      id: "E4",
      variant: "policy-table",
      data: {
        shippingNote: "[Delivery / hand-off terms]",
        returnNote: "[Revision / change-order policy]",
        policies: [
          { label: "Payment", value: "[Milestones or schedule]" },
          { label: "Confidentiality", value: "[NDA reference]" },
        ],
      },
    },
  ],
};
