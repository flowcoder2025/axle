import type { AiJobHandler } from "../types.js";
import { asRecord, requireString } from "../input-utils.js";
import { loadModule } from "../lazy-import.js";

interface RagDraftInput {
  clientId: string;
  programId: string;
  projectId: string;
}

interface DocgenModule {
  generateRagDraft: (input: RagDraftInput) => Promise<unknown>;
}

export const businessPlanHandler: AiJobHandler<RagDraftInput, unknown> = {
  type: "BUSINESS_PLAN",
  async run(input) {
    const rec = asRecord(input, "BUSINESS_PLAN");
    const payload: RagDraftInput = {
      clientId: requireString(rec, "clientId", "BUSINESS_PLAN"),
      programId: requireString(rec, "programId", "BUSINESS_PLAN"),
      projectId: requireString(rec, "projectId", "BUSINESS_PLAN"),
    };
    const mod = await loadModule<DocgenModule>("@axle/docgen");
    return mod.generateRagDraft(payload);
  },
};
