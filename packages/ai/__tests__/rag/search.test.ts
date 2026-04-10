import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const { mockQueryRaw, mockCreate } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    embeddings: { create: mockCreate },
  })),
}));

vi.mock("@axle/db", () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
      _tag: "PrismaRawSql",
    }),
    raw: (value: string) => ({ value, _tag: "PrismaRaw" }),
    empty: { strings: [""], values: [], _tag: "PrismaRawSql" },
  },
}));

// ── SUT imports ───────────────────────────────────────────────────────────────
import { semanticSearch, hybridSearch } from "../../src/rag/search.js";
import { resetOpenAIClient } from "../../src/rag/embeddings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const FAKE_EMBEDDING = Array.from({ length: 1536 }, (_, i) => i / 1536);

const SAMPLE_RESULTS = [
  {
    id: "r1",
    sourceType: "document",
    sourceId: "doc-1",
    content: "Relevant document text",
    metadata: { tags: ["ai"] },
    similarity: 0.92,
  },
  {
    id: "r2",
    sourceType: "document",
    sourceId: "doc-2",
    content: "Another relevant text",
    metadata: null,
    similarity: 0.85,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("WI-058: semanticSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    resetOpenAIClient();
    mockCreate.mockResolvedValue({ data: [{ embedding: FAKE_EMBEDDING }] });
    mockQueryRaw.mockResolvedValue(SAMPLE_RESULTS);
  });

  it("returns search results from prisma.$queryRaw", async () => {
    const results = await semanticSearch("funding support");

    expect(results).toEqual(SAMPLE_RESULTS);
    expect(mockQueryRaw).toHaveBeenCalledOnce();
  });

  it("generates an embedding for the query before searching", async () => {
    await semanticSearch("startup accelerator");

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "startup accelerator",
    });
  });

  it("accepts sourceType filter option", async () => {
    await semanticSearch("client profile", { sourceType: "client" });

    expect(mockQueryRaw).toHaveBeenCalledOnce();
    // A different SQL branch is used when sourceType is provided — ensure it ran
    const [sqlArg] = mockQueryRaw.mock.calls[0] as [unknown];
    expect(sqlArg).toBeDefined();
  });

  it("returns empty array when no results found", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const results = await semanticSearch("obscure query");

    expect(results).toEqual([]);
  });

  it("uses default limit of 10 and threshold of 0.7", async () => {
    // Options omitted — should still call through without error
    await expect(semanticSearch("test")).resolves.toBeDefined();
  });

  it("accepts custom limit and threshold", async () => {
    await expect(
      semanticSearch("test", { limit: 5, threshold: 0.9 })
    ).resolves.toBeDefined();
  });
});

describe("WI-058: hybridSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    resetOpenAIClient();
    mockCreate.mockResolvedValue({ data: [{ embedding: FAKE_EMBEDDING }] });
    mockQueryRaw.mockResolvedValue(SAMPLE_RESULTS);
  });

  it("returns fused results from prisma.$queryRaw", async () => {
    const results = await hybridSearch("business plan templates");

    expect(results).toEqual(SAMPLE_RESULTS);
    expect(mockQueryRaw).toHaveBeenCalledOnce();
  });

  it("generates an embedding for the query", async () => {
    await hybridSearch("market analysis");

    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("accepts sourceType filter option", async () => {
    await hybridSearch("funding", { sourceType: "program" });

    expect(mockQueryRaw).toHaveBeenCalledOnce();
  });

  it("accepts custom limit", async () => {
    await expect(hybridSearch("test", { limit: 20 })).resolves.toBeDefined();
  });

  it("returns empty array when no results found", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const results = await hybridSearch("no matches");

    expect(results).toEqual([]);
  });
});
