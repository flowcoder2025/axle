import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks — must use vi.hoisted so variables are ready when vi.mock is hoisted ──
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  executeRaw: vi.fn(),
  OpenAI: vi.fn(),
}));

vi.mock("openai", () => ({
  default: mocks.OpenAI.mockImplementation(() => ({
    embeddings: { create: mocks.create },
  })),
}));

vi.mock("@axle/db", () => ({
  prisma: { $executeRaw: mocks.executeRaw },
}));

// Prisma.sql / Prisma.raw helpers used in the module under test
vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
      _tag: "PrismaRawSql",
    }),
    raw: (value: string) => ({ value, _tag: "PrismaRaw" }),
  },
}));

// ── SUT imports ───────────────────────────────────────────────────────────────
import {
  generateEmbedding,
  createDocumentEmbedding,
  resetOpenAIClient,
} from "../../src/rag/embeddings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const FAKE_EMBEDDING = Array.from({ length: 1536 }, (_, i) => i / 1536);

function stubOpenAIKey() {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
}

function makeEmbeddingResponse(values: number[]) {
  return { data: [{ embedding: values }] };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("WI-057: generateEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetOpenAIClient();
    // Re-bind implementation after clearAllMocks resets it
    mocks.OpenAI.mockImplementation(() => ({
      embeddings: { create: mocks.create },
    }));
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    await expect(generateEmbedding("hello")).rejects.toThrow("OPENAI_API_KEY");
  });

  it("returns the embedding array from OpenAI", async () => {
    stubOpenAIKey();
    mocks.create.mockResolvedValue(makeEmbeddingResponse(FAKE_EMBEDDING));

    const result = await generateEmbedding("test text");

    expect(result).toEqual(FAKE_EMBEDDING);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "test text",
    });
  });

  it("reuses the OpenAI client across calls (singleton)", async () => {
    stubOpenAIKey();
    mocks.create.mockResolvedValue(makeEmbeddingResponse(FAKE_EMBEDDING));

    await generateEmbedding("first");
    await generateEmbedding("second");

    // Constructor called once across two calls
    expect(mocks.OpenAI).toHaveBeenCalledTimes(1);
  });
});

describe("WI-057: createDocumentEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetOpenAIClient();
    mocks.OpenAI.mockImplementation(() => ({
      embeddings: { create: mocks.create },
    }));
    stubOpenAIKey();
    mocks.create.mockResolvedValue(makeEmbeddingResponse(FAKE_EMBEDDING));
    mocks.executeRaw.mockResolvedValue(1);
  });

  it("calls generateEmbedding and executes raw SQL upsert", async () => {
    await createDocumentEmbedding("document", "doc-1", "Some content");

    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
  });

  it("passes a Prisma.sql object to $executeRaw", async () => {
    await createDocumentEmbedding("client", "client-42", "Client description");

    expect(mocks.executeRaw).toHaveBeenCalledOnce();
    const [sqlArg] = mocks.executeRaw.mock.calls[0] as [{ _tag: string }];
    expect(sqlArg._tag).toBe("PrismaRawSql");
  });

  it("includes metadata when provided", async () => {
    await createDocumentEmbedding("program", "prog-7", "Program text", {
      tags: ["startup", "tech"],
    });

    expect(mocks.executeRaw).toHaveBeenCalledOnce();
  });

  it("handles undefined metadata without error", async () => {
    await expect(
      createDocumentEmbedding("document", "doc-2", "Content without meta")
    ).resolves.toBeUndefined();
  });
});
