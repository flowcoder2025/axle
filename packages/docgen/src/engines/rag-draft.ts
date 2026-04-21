import { semanticSearch, completeWithFallback } from "@axle/ai";
import type { SearchResult } from "@axle/ai";
import { prisma } from "@axle/db";
import type { RagDraftInput, RagDraftOutput, DocumentSection } from "../types.js";
import { REQUIRED_SECTIONS } from "../types.js";

/**
 * RAG Draft Engine (WI-063 / WI-201)
 *
 * Generates a structured Korean government business-plan draft by:
 *   1. Retrieving relevant client documents via pgvector semantic search.
 *   2. Retrieving past successful business plans (OUTPUT docs in BUSINESS_PLAN projects).
 *   3. Assembling a per-section prompt and calling the Claude provider (with fallback)
 *      to generate each section's narrative.
 *
 * The engine is deterministic about structure — the five REQUIRED_SECTIONS are
 * always produced, in order — but the content of each section is AI-generated.
 */

// ── Tuning constants (hardcoded tuning belongs here, not in business logic) ──

const CLIENT_DOCS_TOP_K = 5;
const PAST_PLANS_TOP_K = 3;
const DOCUMENT_SOURCE_TYPE = "document";
const MAX_TOKENS_PER_SECTION = 1200;

// ── RAG retrieval ────────────────────────────────────────────────────────────

/**
 * Search DocumentEmbedding rows filtered to the given client.
 * pgvector kNN search returns a ranked list; we then restrict to documents
 * actually owned by the client via a Prisma join.
 */
export async function searchClientDocuments(
  clientId: string,
  query: string,
  topK: number = CLIENT_DOCS_TOP_K
): Promise<SearchResult[]> {
  if (!clientId) return [];
  if (!query || query.trim().length === 0) return [];

  // Over-fetch to allow for post-filter narrowing.
  const candidates = await semanticSearch(query, {
    sourceType: DOCUMENT_SOURCE_TYPE,
    limit: topK * 4,
  });

  if (candidates.length === 0) return [];

  const sourceIds = candidates.map((c) => c.sourceId);
  const ownedDocs = await prisma.document.findMany({
    where: { id: { in: sourceIds }, clientId },
    select: { id: true },
  });
  const ownedIds = new Set(ownedDocs.map((d) => d.id));

  return candidates.filter((c) => ownedIds.has(c.sourceId)).slice(0, topK);
}

/**
 * Search past successful business plans.
 * A "past plan" is a Document with category=OUTPUT that belongs to a Project
 * whose type is BUSINESS_PLAN. The semantic query narrows by topical relevance.
 */
export async function searchPastPlans(
  query: string,
  topK: number = PAST_PLANS_TOP_K
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) return [];

  const candidates = await semanticSearch(query, {
    sourceType: DOCUMENT_SOURCE_TYPE,
    limit: topK * 4,
  });

  if (candidates.length === 0) return [];

  const sourceIds = candidates.map((c) => c.sourceId);
  const pastPlanDocs = await prisma.document.findMany({
    where: {
      id: { in: sourceIds },
      category: "OUTPUT",
      project: { type: "BUSINESS_PLAN" },
    },
    select: { id: true },
  });
  const planIds = new Set(pastPlanDocs.map((d) => d.id));

  return candidates.filter((c) => planIds.has(c.sourceId)).slice(0, topK);
}

// ── Prompt assembly + generation ─────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "당신은 대한민국 정부 지원사업 사업계획서 전문 컨설턴트입니다.",
  "정확하고 구체적인 한국어 본문을 작성하되, 근거 없는 과장 금지.",
  "제공되는 RAG 컨텍스트를 우선 활용하고, 컨텍스트에 없는 사실을 지어내지 말 것.",
  "출력은 해당 섹션 본문만. 섹션 제목·마크다운 헤더·설명 문구는 포함하지 말 것.",
].join("\n");

function buildSectionPrompt(
  sectionTitle: string,
  input: RagDraftInput,
  clientDocs: SearchResult[],
  pastPlans: SearchResult[]
): string {
  const clientContext = clientDocs.length
    ? clientDocs
        .map((d, i) => `[클라이언트 문서 ${i + 1}] (유사도 ${d.similarity.toFixed(2)})\n${d.content}`)
        .join("\n\n")
    : "(해당 없음)";

  const pastPlanContext = pastPlans.length
    ? pastPlans
        .map((p, i) => `[과거 사업계획서 ${i + 1}] (유사도 ${p.similarity.toFixed(2)})\n${p.content}`)
        .join("\n\n")
    : "(해당 없음)";

  return [
    `프로그램 ID: ${input.programId}`,
    `프로젝트 ID: ${input.projectId}`,
    `클라이언트 ID: ${input.clientId}`,
    "",
    "── 클라이언트 문서 컨텍스트 ──",
    clientContext,
    "",
    "── 과거 유사 사업계획서 컨텍스트 ──",
    pastPlanContext,
    "",
    `위 컨텍스트를 바탕으로 "${sectionTitle}" 섹션 본문만 작성하십시오.`,
    "분량은 3~6문단. 구체적 수치·근거가 컨텍스트에 있으면 인용하여 활용.",
  ].join("\n");
}

async function generateSection(
  title: string,
  input: RagDraftInput,
  clientDocs: SearchResult[],
  pastPlans: SearchResult[]
): Promise<{ section: DocumentSection; usage: { inputTokens: number; outputTokens: number } }> {
  const prompt = buildSectionPrompt(title, input, clientDocs, pastPlans);

  const result = await completeWithFallback("BUSINESS_PLAN", {
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: MAX_TOKENS_PER_SECTION,
  });

  return {
    section: { title, content: result.text.trim() },
    usage: result.usage,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a full RAG-backed business plan draft.
 * Each of the five REQUIRED_SECTIONS is generated independently so a failure
 * in one section does not corrupt the whole draft.
 */
export async function generateRagDraft(
  input: RagDraftInput
): Promise<RagDraftOutput> {
  const { clientId, programId, projectId } = input;

  // The semantic query should surface documents related to this project/program.
  // We build a single natural-language query from the identifiers; callers can
  // enrich this in a future iteration via optional free-text hints.
  const query = `정부 지원사업 사업계획서 프로그램 ${programId} 프로젝트 ${projectId}`;

  const [clientDocs, pastPlans] = await Promise.all([
    searchClientDocuments(clientId, query),
    searchPastPlans(query),
  ]);

  const sections: DocumentSection[] = [];
  let totalTokens = 0;

  for (const title of REQUIRED_SECTIONS) {
    const { section, usage } = await generateSection(
      title,
      input,
      clientDocs,
      pastPlans
    );
    sections.push(section);
    totalTokens += usage.inputTokens + usage.outputTokens;
  }

  const sourceDocs = Array.from(
    new Set<string>([
      ...clientDocs.map((d) => d.sourceId),
      ...pastPlans.map((p) => p.sourceId),
    ])
  );

  return {
    sections,
    metadata: {
      sourceDocs,
      tokensUsed: totalTokens,
    },
  };
}
