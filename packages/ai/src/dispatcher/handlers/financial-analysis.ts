import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { completeWithFallback } from "../../providers/index.js";

interface FinancialAnalysisInput {
  financials: string; // serialized financials (markdown/JSON text)
  clientName?: string;
}

export const financialAnalysisHandler: AiJobHandler<
  FinancialAnalysisInput,
  { text: string; model: string }
> = {
  type: "FINANCIAL_ANALYSIS",
  async run(input) {
    const rec = asRecord(input, "FINANCIAL_ANALYSIS");
    const financials = requireString(rec, "financials", "FINANCIAL_ANALYSIS");
    const clientName = typeof rec.clientName === "string" ? rec.clientName : "해당 기업";

    const result = await completeWithFallback("FINANCIAL_ANALYSIS", {
      system:
        "You are a senior Korean financial analyst. Produce concise, evidence-based analysis covering 수익성, 안정성, 성장성 지표.",
      prompt: `${clientName}의 재무 데이터를 분석하고 3~5개의 핵심 인사이트와 1개의 리스크를 제시하세요.\n\n${financials}`,
      maxTokens: 1500,
    });
    return { text: result.text, model: result.model };
  },
};
