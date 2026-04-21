import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { completeWithFallback } from "../../providers/index.js";

interface SummaryInput {
  content: string;
  style?: "bullet" | "paragraph";
}

export const summaryHandler: AiJobHandler<SummaryInput, { text: string; model: string }> = {
  type: "SUMMARY",
  async run(input) {
    const rec = asRecord(input, "SUMMARY");
    const content = requireString(rec, "content", "SUMMARY");
    const style = rec.style === "paragraph" ? "paragraph" : "bullet";

    const prompt =
      style === "bullet"
        ? `다음 내용을 핵심 포인트 5~8개의 불릿 목록으로 요약하세요.\n\n${content}`
        : `다음 내용을 3~5문장 단락으로 요약하세요.\n\n${content}`;

    const result = await completeWithFallback("SUMMARY", {
      system: "You summarize Korean business content concisely and faithfully.",
      prompt,
      maxTokens: 800,
    });
    return { text: result.text, model: result.model };
  },
};
