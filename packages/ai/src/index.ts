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

// RAG — document embedding + semantic search
export {
  generateEmbedding,
  createDocumentEmbedding,
  resetOpenAIClient,
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
