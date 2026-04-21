import type { AiJobHandler } from "../types.js";
import { asRecord, requireString, optionalString } from "../input-utils.js";
import { completeWithFallback } from "../../providers/index.js";

interface ResearchInput {
  prompt: string;
  system?: string;
}

export const researchHandler: AiJobHandler<ResearchInput, { text: string; model: string }> = {
  type: "RESEARCH",
  async run(input) {
    const rec = asRecord(input, "RESEARCH");
    const prompt = requireString(rec, "prompt", "RESEARCH");
    const system = optionalString(rec, "system");
    const result = await completeWithFallback("RESEARCH", { prompt, system });
    return { text: result.text, model: result.model };
  },
};
