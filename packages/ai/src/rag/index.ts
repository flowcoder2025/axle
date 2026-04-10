export {
  generateEmbedding,
  resetOpenAIClient,
} from "./embeddings.js";

export {
  toVectorLiteral,
  vectorParam,
} from "./vector-utils.js";

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
