/**
 * Unit tests for generateJournalDraft service
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// --- Mocks ---

const mockJournalOps = {
  update: vi.fn(),
};
const mockClientOps = {
  findUnique: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    researchJournal: mockJournalOps,
    client: mockClientOps,
  },
}));

const mockCreateAiJob = vi.fn();
const mockUpdateJobStatus = vi.fn();
const mockCompleteWithFallback = vi.fn();

vi.mock("@axle/ai", () => ({
  createAiJob: mockCreateAiJob,
  updateJobStatus: mockUpdateJobStatus,
  completeWithFallback: mockCompleteWithFallback,
}));

// --- Helpers ---

function makeJournalInput() {
  return {
    id: "journal-1",
    title: "딥러닝 기반 이미지 분류 연구",
    content: "합성곱 신경망(CNN)을 활용한 이미지 분류 모델을 개발하였다.",
    objectives: null as string | null,
    results: null as string | null,
    nextSteps: null as string | null,
    hours: new Prisma.Decimal("8") as Prisma.Decimal | null,
    date: new Date("2025-04-01"),
    clientId: "client-1",
    researcherContactId: "contact-1",
  };
}

const AI_RESPONSE_JSON = {
  objectives: "CNN 기반 이미지 분류 모델의 정확도 95% 이상 달성",
  results: "ResNet-50 모델을 활용하여 94.7% 정확도 달성, 데이터 증강 기법 적용",
  nextSteps: "학습률 스케줄링 최적화 및 모델 경량화를 통한 추론 속도 개선",
};

// --- Tests ---

describe("generateJournalDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateAiJob.mockResolvedValue({
      id: "job-1",
      type: "JOURNAL_DRAFT",
      tier: "LOCAL_MLX",
      status: "QUEUED",
    });

    mockClientOps.findUnique.mockResolvedValue({ orgId: "org-1" });
    mockJournalOps.update.mockResolvedValue({ id: "journal-1" });
    mockUpdateJobStatus.mockResolvedValue({ id: "job-1" });

    mockCompleteWithFallback.mockResolvedValue({
      text: JSON.stringify(AI_RESPONSE_JSON),
      usage: { inputTokens: 200, outputTokens: 300 },
      model: "local-mlx",
    });
  });

  it("creates AiJob with correct type and tier", async () => {
    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    const input = makeJournalInput();
    await generateJournalDraft(input);

    expect(mockCreateAiJob).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        type: "JOURNAL_DRAFT",
        tier: "LOCAL_MLX",
        input: expect.objectContaining({
          journalId: "journal-1",
          title: input.title,
        }),
      })
    );
  });

  it("links job to journal via aiDraftJobId", async () => {
    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockJournalOps.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "journal-1" },
        data: { aiDraftJobId: "job-1" },
      })
    );
  });

  it("calls completeWithFallback with JOURNAL_DRAFT", async () => {
    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockCompleteWithFallback).toHaveBeenCalledWith(
      "JOURNAL_DRAFT",
      expect.objectContaining({ prompt: expect.any(String) }),
    );
  });

  it("calls provider.complete with system prompt and journal context", async () => {
    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockCompleteWithFallback).toHaveBeenCalledWith(
      "JOURNAL_DRAFT",
      expect.objectContaining({
        system: expect.stringContaining("research journal assistant"),
        prompt: expect.stringContaining("딥러닝 기반 이미지 분류 연구"),
        maxTokens: 2048,
      })
    );
  });

  it("updates journal with AI-generated fields", async () => {
    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    // Second update call (first is aiDraftJobId linking)
    const updateCalls = mockJournalOps.update.mock.calls;
    const aiFieldsUpdate = updateCalls.find(
      (call: unknown[]) =>
        (call[0] as { data: Record<string, unknown> }).data.objectives !== undefined
    );
    expect(aiFieldsUpdate).toBeDefined();
    expect(aiFieldsUpdate![0]).toEqual(
      expect.objectContaining({
        where: { id: "journal-1" },
        data: {
          objectives: AI_RESPONSE_JSON.objectives,
          results: AI_RESPONSE_JSON.results,
          nextSteps: AI_RESPONSE_JSON.nextSteps,
        },
      })
    );
  });

  it("marks job as COMPLETED with output and duration", async () => {
    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockUpdateJobStatus).toHaveBeenCalledWith("job-1", {
      status: "COMPLETED",
      output: AI_RESPONSE_JSON,
      durationMs: expect.any(Number),
    });
  });

  it("handles markdown-fenced JSON response", async () => {
    mockCompleteWithFallback.mockResolvedValue({
      text: "```json\n" + JSON.stringify(AI_RESPONSE_JSON) + "\n```",
      usage: { inputTokens: 200, outputTokens: 300 },
      model: "local-mlx",
    });

    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "COMPLETED" })
    );
  });

  it("marks job as FAILED when AI call throws", async () => {
    mockCompleteWithFallback.mockRejectedValue(new Error("Provider unavailable"));

    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockUpdateJobStatus).toHaveBeenCalledWith("job-1", {
      status: "FAILED",
      errorMessage: "Provider unavailable",
    });
  });

  it("marks job as FAILED when JSON parsing fails", async () => {
    mockCompleteWithFallback.mockResolvedValue({
      text: "This is not valid JSON",
      usage: { inputTokens: 200, outputTokens: 50 },
      model: "local-mlx",
    });

    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        status: "FAILED",
        errorMessage: expect.any(String),
      })
    );
  });

  it("marks job as FAILED when response missing required fields", async () => {
    mockCompleteWithFallback.mockResolvedValue({
      text: JSON.stringify({ objectives: "only objectives" }),
      usage: { inputTokens: 200, outputTokens: 50 },
      model: "local-mlx",
    });

    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(makeJournalInput());

    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        status: "FAILED",
        errorMessage: expect.stringContaining("missing required fields"),
      })
    );
  });

  it("includes existing objectives/results/nextSteps in prompt when present", async () => {
    const input = makeJournalInput();
    input.objectives = "기존 목표";
    input.results = "기존 결과";
    input.nextSteps = "기존 계획";

    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    await generateJournalDraft(input);

    const promptArg = mockCompleteWithFallback.mock.calls[0][1].prompt as string;
    expect(promptArg).toContain("기존 목표");
    expect(promptArg).toContain("기존 결과");
    expect(promptArg).toContain("기존 계획");
  });

  it("still returns job even when AI call fails", async () => {
    mockCompleteWithFallback.mockRejectedValue(new Error("Network error"));

    const { generateJournalDraft } = await import(
      "../../lib/services/journal-draft"
    );
    const result = await generateJournalDraft(makeJournalInput());

    expect(result).toEqual(
      expect.objectContaining({
        id: "job-1",
        type: "JOURNAL_DRAFT",
      })
    );
  });
});
