import type { RagDraftInput, RagDraftOutput, DocumentSection } from "../types.js";
import { REQUIRED_SECTIONS } from "../types.js";

/**
 * RAG Draft Engine (WI-063)
 *
 * Phase 6 implementation: returns structured sections with placeholder content
 * derived from RAG search results. Actual AI generation (Claude CLI) will be
 * wired in Phase 14.
 *
 * The engine performs two conceptual searches:
 *   1. Relevant client documents for the given project (semantic search).
 *   2. Successful past business plans for the same program type.
 *
 * Both searches are mocked in Phase 6 — the interface and plumbing are
 * established so Phase 14 can swap in real calls without structural changes.
 */

// ── Internal helpers ─────────────────────────────────────────────────────────

interface RagCandidate {
  id: string;
  content: string;
  similarity: number;
}

/**
 * Stub: Searches the RAG index for documents relevant to the given project.
 * Phase 14 will replace this with a real call to `@axle/ai` semanticSearch.
 */
async function searchClientDocuments(
  _clientId: string,
  _projectId: string
): Promise<RagCandidate[]> {
  // Phase 14: import { semanticSearch } from "@axle/ai";
  // return semanticSearch({ query: `project:${_projectId}`, topK: 5, filter: { clientId: _clientId } });
  return [];
}

/**
 * Stub: Searches for successful past business plans for the given program.
 * Phase 14 will replace this with a hybrid search over plan archives.
 */
async function searchPastPlans(_programId: string): Promise<RagCandidate[]> {
  // Phase 14: import { hybridSearch } from "@axle/ai";
  // return hybridSearch({ query: `programId:${_programId}`, topK: 3, filter: { status: "approved" } });
  return [];
}

/**
 * Builds a structured placeholder section from the candidate documents.
 * The placeholder clearly marks where Phase 14 AI generation will inject
 * real content.
 */
function buildSection(
  title: string,
  clientDocs: RagCandidate[],
  pastPlans: RagCandidate[]
): DocumentSection {
  const sourceSnippets = [
    ...clientDocs.map((d) => d.content),
    ...pastPlans.map((p) => p.content),
  ]
    .filter(Boolean)
    .slice(0, 3);

  const content =
    sourceSnippets.length > 0
      ? `[${title} — Phase 14: AI will synthesize content from ${sourceSnippets.length} source(s)]\n\n${sourceSnippets.join("\n\n")}`
      : `[${title} — Phase 14: AI content generation pending]`;

  return { title, content };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateRagDraft(
  input: RagDraftInput
): Promise<RagDraftOutput> {
  const { clientId, programId, projectId } = input;

  // 1. Retrieve client-specific context (semantic search)
  const clientDocs = await searchClientDocuments(clientId, projectId);

  // 2. Retrieve successful past plans for the same program type
  const pastPlans = await searchPastPlans(programId);

  // 3. Build structured sections covering the standard Korean business plan structure
  const sections: DocumentSection[] = REQUIRED_SECTIONS.map((title) =>
    buildSection(title, clientDocs, pastPlans)
  );

  // 4. Collect source document references
  const sourceDocs = [
    ...clientDocs.map((d) => d.id),
    ...pastPlans.map((p) => p.id),
  ];

  return {
    sections,
    metadata: {
      sourceDocs,
      // tokensUsed is populated in Phase 14 when real AI calls are made
    },
  };
}
