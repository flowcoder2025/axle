import { registerHandler } from "./registry.js";
import { businessPlanHandler } from "./handlers/business-plan.js";
import { researchHandler } from "./handlers/research.js";
import { ocrHandler } from "./handlers/ocr.js";
import { transcribeHandler } from "./handlers/transcribe.js";
import { summaryHandler } from "./handlers/summary.js";
import { journalDraftHandler } from "./handlers/journal-draft.js";
import { financialAnalysisHandler } from "./handlers/financial-analysis.js";
import { gapDiagnosisHandler } from "./handlers/gap-diagnosis.js";
import { evaluationHandler } from "./handlers/evaluation.js";
import { matchingHandler } from "./handlers/matching.js";

/**
 * Register all built-in AiJob handlers.
 *
 * This is side-effect-free until called, which lets tests swap in doubles
 * via `resetRegistry()` → `registerHandler(mock)` without this import
 * eagerly populating the registry.
 */
export function registerBuiltinHandlers(): void {
  registerHandler(businessPlanHandler);
  registerHandler(researchHandler);
  registerHandler(ocrHandler);
  registerHandler(transcribeHandler);
  registerHandler(summaryHandler);
  registerHandler(journalDraftHandler);
  registerHandler(financialAnalysisHandler);
  registerHandler(gapDiagnosisHandler);
  registerHandler(evaluationHandler);
  registerHandler(matchingHandler);
}

export {
  dispatch,
  getHandler,
  hasHandler,
  listRegisteredTypes,
  registerHandler,
  resetRegistry,
} from "./registry.js";

export {
  UnknownJobTypeError,
  InvalidJobInputError,
  type AiJobHandler,
} from "./types.js";

export { businessPlanHandler } from "./handlers/business-plan.js";
export { researchHandler } from "./handlers/research.js";
export { ocrHandler } from "./handlers/ocr.js";
export { transcribeHandler } from "./handlers/transcribe.js";
export { summaryHandler } from "./handlers/summary.js";
export { journalDraftHandler } from "./handlers/journal-draft.js";
export { financialAnalysisHandler } from "./handlers/financial-analysis.js";
export { gapDiagnosisHandler } from "./handlers/gap-diagnosis.js";
export { evaluationHandler } from "./handlers/evaluation.js";
export { matchingHandler } from "./handlers/matching.js";
