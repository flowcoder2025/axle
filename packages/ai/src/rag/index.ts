export {
  generateEmbedding,
  createDocumentEmbedding,
  resetOpenAIClient,
} from "./embeddings.js";

export {
  semanticSearch,
  hybridSearch,
} from "./search.js";
export type { SearchResult, SemanticSearchOptions, HybridSearchOptions } from "./search.js";

export {
  upsertEmbedding,
  deleteEmbedding,
  getEmbeddingsBySource,
} from "./crud.js";
export type { EmbeddingRecord } from "./crud.js";
