import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { completeWithFallback } from "../../providers/index.js";

interface JournalDraftInput {
  activities: string; // raw activity log
  date?: string;
}

export const journalDraftHandler: AiJobHandler<
  JournalDraftInput,
  { text: string; model: string }
> = {
  type: "JOURNAL_DRAFT",
  async run(input) {
    const rec = asRecord(input, "JOURNAL_DRAFT");
    const activities = requireString(rec, "activities", "JOURNAL_DRAFT");
    const date = typeof rec.date === "string" ? rec.date : undefined;
    const dateLine = date ? `일자: ${date}\n` : "";

    const result = await completeWithFallback("JOURNAL_DRAFT", {
      system:
        "You draft a Korean consultant journal entry in the standard format: 주요 업무 / 특이사항 / 후속 조치.",
      prompt: `${dateLine}다음 활동 로그를 바탕으로 일지 초안을 작성하세요.\n\n${activities}`,
      maxTokens: 1000,
    });
    return { text: result.text, model: result.model };
  },
};
