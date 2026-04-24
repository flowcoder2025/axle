import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be hoisted so vi.mock can reference them) ──────────────────
const {
  mockSemanticSearch,
  mockCompleteWithFallback,
  mockDocumentFindMany,
} = vi.hoisted(() => ({
  mockSemanticSearch: vi.fn(),
  mockCompleteWithFallback: vi.fn(),
  mockDocumentFindMany: vi.fn(),
}));

vi.mock("@axle/ai", () => ({
  semanticSearch: mockSemanticSearch,
  completeWithFallback: mockCompleteWithFallback,
}));

vi.mock("@axle/db", () => ({
  prisma: {
    document: { findMany: mockDocumentFindMany },
  },
}));

// ── SUT import ──────────────────────────────────────────────────────────────
import {
  generateRagDraft,
  searchClientDocuments,
  searchPastPlans,
  buildSectionPrompt,
} from "../../src/engines/rag-draft.js";
import {
  REQUIRED_SECTIONS,
  VENTURE_BUSINESS_PLAN_SECTIONS,
} from "../../src/types.js";

// ── Fixtures ────────────────────────────────────────────────────────────────
const baseInput = {
  clientId: "client-001",
  programId: "GOV-2024-01",
  projectId: "project-001",
};

function mkSearchResult(
  sourceId: string,
  content: string,
  similarity = 0.9
): {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: unknown;
  similarity: number;
} {
  return {
    id: `emb-${sourceId}`,
    sourceType: "document",
    sourceId,
    content,
    metadata: {},
    similarity,
  };
}

function mkCompletion(text: string) {
  return {
    text,
    usage: { inputTokens: 100, outputTokens: 200 },
    model: "claude-opus-4-6",
  };
}

describe("WI-201: generateRagDraft — RAG-backed business plan draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no RAG hits, AI returns a short section body.
    mockSemanticSearch.mockResolvedValue([]);
    mockDocumentFindMany.mockResolvedValue([]);
    mockCompleteWithFallback.mockImplementation(async (_jobType, input) => {
      const title = /"(.+?)" 섹션/.exec(input.prompt)?.[1] ?? "section";
      return mkCompletion(`Generated body for ${title}`);
    });
  });

  it("returns every required venture section in order", async () => {
    const result = await generateRagDraft(baseInput);
    expect(result.sections.map((s) => s.title)).toEqual([...REQUIRED_SECTIONS]);
  });

  it("calls completeWithFallback once per required section with BUSINESS_PLAN tier", async () => {
    await generateRagDraft(baseInput);
    expect(mockCompleteWithFallback).toHaveBeenCalledTimes(REQUIRED_SECTIONS.length);
    for (const call of mockCompleteWithFallback.mock.calls) {
      expect(call[0]).toBe("BUSINESS_PLAN");
      expect(call[1]).toMatchObject({
        system: expect.any(String),
        prompt: expect.any(String),
        maxTokens: expect.any(Number),
      });
    }
  });

  it("fills section.content with AI-generated text (no placeholder markers)", async () => {
    const result = await generateRagDraft(baseInput);
    for (const section of result.sections) {
      expect(section.content).toMatch(/^Generated body for/);
      expect(section.content).not.toContain("Phase 14");
      expect(section.content).not.toContain("pending");
    }
  });

  it("accumulates tokensUsed across all sections", async () => {
    const result = await generateRagDraft(baseInput);
    // N sections × (100 + 200) per `mkCompletion` in fixtures
    expect(result.metadata.tokensUsed).toBe(REQUIRED_SECTIONS.length * 300);
  });

  it("deduplicates sourceDocs across client + past-plan RAG hits", async () => {
    mockSemanticSearch.mockResolvedValue([
      mkSearchResult("doc-A", "client content A"),
      mkSearchResult("doc-B", "shared content B"),
    ]);
    // Document filter: doc-A owned by client, doc-B is a past plan (owned too, but dedupe)
    mockDocumentFindMany.mockImplementation(async (args: { where: unknown }) => {
      const where = args.where as {
        clientId?: string;
        category?: string;
        project?: { type: string };
        id: { in: string[] };
      };
      if (where.clientId) {
        return [{ id: "doc-A" }, { id: "doc-B" }];
      }
      if (where.category === "OUTPUT") {
        return [{ id: "doc-B" }];
      }
      return [];
    });

    const result = await generateRagDraft(baseInput);
    expect(result.metadata.sourceDocs).toEqual(
      expect.arrayContaining(["doc-A", "doc-B"])
    );
    // No duplicates
    const unique = new Set(result.metadata.sourceDocs);
    expect(unique.size).toBe(result.metadata.sourceDocs.length);
  });
});

describe("WI-201: searchClientDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when clientId is missing", async () => {
    const result = await searchClientDocuments("", "query");
    expect(result).toEqual([]);
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it("returns empty array when query is blank", async () => {
    const result = await searchClientDocuments("client-1", "   ");
    expect(result).toEqual([]);
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it("calls semanticSearch with sourceType=document and filters by clientId", async () => {
    mockSemanticSearch.mockResolvedValue([
      mkSearchResult("doc-1", "owned content"),
      mkSearchResult("doc-2", "foreign content"),
    ]);
    mockDocumentFindMany.mockResolvedValue([{ id: "doc-1" }]);

    const result = await searchClientDocuments("client-42", "fund plan", 3);

    expect(mockSemanticSearch).toHaveBeenCalledWith("fund plan", {
      sourceType: "document",
      limit: 12, // topK * 4
    });
    expect(mockDocumentFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["doc-1", "doc-2"] }, clientId: "client-42" },
      select: { id: true },
    });
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("doc-1");
  });

  it("skips DB query when semanticSearch returns nothing", async () => {
    mockSemanticSearch.mockResolvedValue([]);
    const result = await searchClientDocuments("client-1", "query");
    expect(result).toEqual([]);
    expect(mockDocumentFindMany).not.toHaveBeenCalled();
  });

  it("caps result length at topK after filtering", async () => {
    mockSemanticSearch.mockResolvedValue([
      mkSearchResult("doc-1", "a"),
      mkSearchResult("doc-2", "b"),
      mkSearchResult("doc-3", "c"),
    ]);
    mockDocumentFindMany.mockResolvedValue([
      { id: "doc-1" },
      { id: "doc-2" },
      { id: "doc-3" },
    ]);

    const result = await searchClientDocuments("client-1", "q", 2);
    expect(result).toHaveLength(2);
  });
});

describe("WI-201: searchPastPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when query is blank", async () => {
    const result = await searchPastPlans("");
    expect(result).toEqual([]);
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it("filters to OUTPUT documents belonging to BUSINESS_PLAN projects", async () => {
    mockSemanticSearch.mockResolvedValue([
      mkSearchResult("plan-1", "approved plan"),
      mkSearchResult("other-1", "not a plan"),
    ]);
    mockDocumentFindMany.mockResolvedValue([{ id: "plan-1" }]);

    const result = await searchPastPlans("green energy R&D", 2);

    expect(mockSemanticSearch).toHaveBeenCalledWith("green energy R&D", {
      sourceType: "document",
      limit: 8, // topK * 4
    });
    expect(mockDocumentFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["plan-1", "other-1"] },
        category: "OUTPUT",
        project: { type: "BUSINESS_PLAN" },
      },
      select: { id: true },
    });
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("plan-1");
  });
});

// ─── WI-328: 9-section schema injection into AI prompt ─────────────────────

describe("WI-328: buildSectionPrompt injects section config into prompt", () => {
  const marketConfig = VENTURE_BUSINESS_PLAN_SECTIONS.find(
    (s) => s.id === "market",
  )!;

  it("includes the section title + instruction verbatim", () => {
    const prompt = buildSectionPrompt(marketConfig, baseInput, [], []);
    expect(prompt).toContain(marketConfig.title);
    expect(prompt).toContain(marketConfig.instruction);
  });

  it("includes every tip from the agency guideline", () => {
    const prompt = buildSectionPrompt(marketConfig, baseInput, [], []);
    for (const tip of marketConfig.tips) {
      expect(prompt).toContain(tip);
    }
  });

  it("includes the min/max character constraints", () => {
    const prompt = buildSectionPrompt(marketConfig, baseInput, [], []);
    expect(prompt).toContain(`${marketConfig.minChars}자 이상`);
    expect(prompt).toContain(`${marketConfig.maxChars}자 이내`);
  });

  it("falls back to '해당 없음' when no RAG context is supplied", () => {
    const prompt = buildSectionPrompt(marketConfig, baseInput, [], []);
    expect(prompt).toContain("(해당 없음)");
  });
});
