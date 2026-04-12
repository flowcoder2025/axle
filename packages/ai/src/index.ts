export { complete } from "./claude.js";
export type { ClaudeCompletionInput } from "./claude.js";

export { resolveAiTier } from "./router.js";
export type { RouterConfig } from "./router.js";

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
export { getProvider, resolveProvider } from "./providers/index.js";
export type { AiProvider, CompletionInput, CompletionResult } from "./providers/index.js";
export { AnthropicProvider } from "./providers/index.js";
export { LocalMlxProvider } from "./providers/index.js";
export { ClaudeCliProvider } from "./providers/index.js";
