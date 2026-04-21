import type { AiJobHandler } from "../types.js";
import { asRecord, requireString, optionalString } from "../input-utils.js";
import { evaluate, type EvaluationResult } from "../../evaluation/engine.js";

interface EvaluationInput {
  documentContent: string;
  programId?: string;
}

export const evaluationHandler: AiJobHandler<EvaluationInput, EvaluationResult> = {
  type: "EVALUATION",
  async run(input) {
    const rec = asRecord(input, "EVALUATION");
    const payload: EvaluationInput = {
      documentContent: requireString(rec, "documentContent", "EVALUATION"),
      programId: optionalString(rec, "programId"),
    };
    return evaluate(payload);
  },
};
