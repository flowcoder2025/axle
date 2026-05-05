/**
 * retouch-free — FlowRetouch FREE tier preset.
 *
 * Lightweight retouching — single batch, conservative skin smoothing, no
 * advanced color grading. Mirrors FlowRetouch's free tier behaviour so the
 * paywalled difference between FREE and PRO is encoded in this PBC, not
 * scattered across apps.
 */

import type { Preset } from "./types.js";

export const FREE_MODE_SYSTEM_PROMPT = [
  "You are an automated photo retoucher running on the free tier. Apply the",
  "user's instruction to the source photograph with the following limits:",
  "",
  "1. Identity preservation is non-negotiable. Never change facial structure",
  "   or recognizable features.",
  "2. Skin retouching is light only:",
  "   - Reduce visible blemishes and redness mildly.",
  "   - Do not remove freckles, moles, or permanent features.",
  "   - Preserve full skin texture — no smoothing that hides pores.",
  "3. Color: minor white-balance and exposure correction only. No editorial",
  "   color grading. No mood-shift treatments.",
  "4. Output a single image, same aspect ratio as the source. No collage,",
  "   no text, no watermark.",
  "5. If the user's instruction would require advanced editing (extensive",
  "   skin smoothing, mood-grading, scene changes, age progression, etc.),",
  "   apply only the conservative portion and ignore the rest.",
].join("\n");

export const RETOUCH_FREE: Preset = {
  mode: "RETOUCH",
  style: "retouch-free",
  count: 1,
  metadata: {
    systemPrompt: FREE_MODE_SYSTEM_PROMPT,
    tier: "free",
  },
};
