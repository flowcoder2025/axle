import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { analyzeGaps, type GapResult } from "../../diagnosis/gap-analyzer.js";

interface GapDiagnosisInput {
  clientId: string;
  programId: string;
}

export const gapDiagnosisHandler: AiJobHandler<GapDiagnosisInput, GapResult> = {
  type: "GAP_DIAGNOSIS",
  async run(input) {
    const rec = asRecord(input, "GAP_DIAGNOSIS");
    const payload: GapDiagnosisInput = {
      clientId: requireString(rec, "clientId", "GAP_DIAGNOSIS"),
      programId: requireString(rec, "programId", "GAP_DIAGNOSIS"),
    };
    return analyzeGaps(payload);
  },
};
