export { complete } from "./claude.js";
export type { ClaudeCompletionInput } from "./claude.js";

export { resolveAiTier, resolveAiTierAsync } from "./router.js";
export type { RouterConfig } from "./router.js";

// SkillPattern — LOCAL_MLX promotion state machine
export {
  postAdapterToBridge,
  canTransition,
  transitionStatus,
  queueForFineTune,
  promoteToLocalMlx,
  markFineTuneComplete,
  hasPromotedPatternFor,
  InvalidTransitionError,
} from "./skill-pattern/promotion.js";

export {
  createAiJob,
  updateJobStatus,
  getJobResult,
  getJobsByProject,
} from "./job.js";

export type { CreateAiJobData, UpdateJobStatusData } from "./types.js";
export type { AiJob, AiJobType, AiTier, JobStatus } from "./types.js";

// SkillPattern — learning loop
export {
  extractAndStorePattern,
  findMatchingPattern,
  getFineTuningCandidates,
  markAsFineTuned,
} from "./skill-pattern/learning.js";
export type { PatternExtractionInput } from "./skill-pattern/learning.js";

// Gap Diagnosis
export { analyzeGaps } from "./diagnosis/gap-analyzer.js";
export type {
  GapAnalysisInput,
  GapResult,
  GapItem,
} from "./diagnosis/gap-analyzer.js";

// Evaluation Engine
export { evaluate, DEFAULT_CRITERIA } from "./evaluation/engine.js";
export type {
  EvaluationInput,
  EvaluationCriteria,
  EvaluationResult,
} from "./evaluation/engine.js";

// RAG — document embedding + semantic search
export {
  generateEmbedding,
  resetOpenAIClient,
  toVectorLiteral,
  vectorParam,
  semanticSearch,
  hybridSearch,
  upsertEmbedding,
  deleteEmbedding,
  getEmbeddingsBySource,
} from "./rag/index.js";
export type {
  SearchResult,
  SemanticSearchOptions,
  HybridSearchOptions,
  EmbeddingRecord,
} from "./rag/index.js";

// Providers
export { getProvider, resolveProvider, completeWithFallback } from "./providers/index.js";
export type { AiProvider, CompletionInput, CompletionResult } from "./providers/index.js";
export { AnthropicProvider } from "./providers/index.js";
export { LocalMlxProvider } from "./providers/index.js";
export { ClaudeCliProvider } from "./providers/index.js";
export { OpenRouterProvider } from "./providers/index.js";

// Pre-Submission Verification
export { verifyPreSubmission } from "./verification/pre-submission.js";
export type {
  DocumentData,
  VerificationResult,
  VerificationIssue,
} from "./verification/types.js";

// AiJob dispatcher — type → handler registry
export {
  dispatch,
  getHandler,
  hasHandler,
  listRegisteredTypes,
  registerHandler,
  resetRegistry,
  registerBuiltinHandlers,
  UnknownJobTypeError,
  InvalidJobInputError,
} from "./dispatcher/index.js";
export type { AiJobHandler } from "./dispatcher/index.js";
