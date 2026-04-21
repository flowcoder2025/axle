import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { completeWithFallback } from "../../providers/index.js";

interface TranscribeInput {
  audioText: string; // pre-transcribed raw text to clean up / format
  instruction?: string;
}

export const transcribeHandler: AiJobHandler<TranscribeInput, { text: string; model: string }> = {
  type: "TRANSCRIBE",
  async run(input) {
    const rec = asRecord(input, "TRANSCRIBE");
    const audioText = requireString(rec, "audioText", "TRANSCRIBE");
    const instruction =
      typeof rec.instruction === "string" && rec.instruction.length > 0
        ? rec.instruction
        : "다음 받아쓰기 원문을 화자 구분과 문장 부호를 포함해 정돈된 회의록 스크립트로 정리하세요.";

    const result = await completeWithFallback("TRANSCRIBE", {
      system: "You clean up raw speech-to-text transcripts into readable Korean minutes.",
      prompt: `${instruction}\n\n---\n${audioText}`,
      maxTokens: 2000,
    });
    return { text: result.text, model: result.model };
  },
};
