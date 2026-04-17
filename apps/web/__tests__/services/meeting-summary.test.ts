/**
 * Unit tests for generateSummary service
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockTranscriptOps = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    meetingTranscript: mockTranscriptOps,
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

// --- Test data ---

const MEETING_ID = "meeting-1";
const TRANSCRIPT_ID = "transcript-1";
const JOB_ID = "job-1";
const PROJECT_ID = "project-1";
const ORG_ID = "org-1";

const BASE_TRANSCRIPT = {
  id: TRANSCRIPT_ID,
  rawTranscript: "회의 내용입니다. 결정 사항: A를 진행합니다.",
  meeting: {
    projectId: PROJECT_ID,
    project: { client: { orgId: ORG_ID } },
  },
};

const AI_RESPONSE = {
  summary: "A 프로젝트 진행 방향을 논의했습니다.",
  keyDecisions: ["A를 진행한다"],
  actionItems: [{ task: "A 구현", assignee: "홍길동" }],
};

const BASE_JOB = {
  id: JOB_ID,
  type: "SUMMARY",
  tier: "API_HAIKU",
  status: "QUEUED",
};

// --- Tests ---

describe("generateSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // completeWithFallback is called directly (not via provider.complete)
  });

  it("returns early when transcript is not found", async () => {
    mockTranscriptOps.findUnique.mockResolvedValue(null);

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );
    await generateSummary(MEETING_ID);

    expect(mockCreateAiJob).not.toHaveBeenCalled();
    expect(mockTranscriptOps.update).not.toHaveBeenCalled();
  });

  it("returns early when rawTranscript is null", async () => {
    mockTranscriptOps.findUnique.mockResolvedValue({
      ...BASE_TRANSCRIPT,
      rawTranscript: null,
    });

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );
    await generateSummary(MEETING_ID);

    expect(mockCreateAiJob).not.toHaveBeenCalled();
  });

  it("returns early when meeting has no project/client (no orgId)", async () => {
    mockTranscriptOps.findUnique.mockResolvedValue({
      ...BASE_TRANSCRIPT,
      meeting: { projectId: null, project: null },
    });

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );
    await generateSummary(MEETING_ID);

    expect(mockCreateAiJob).not.toHaveBeenCalled();
  });

  it("creates job, calls AI, and updates transcript with summary", async () => {
    mockTranscriptOps.findUnique.mockResolvedValue(BASE_TRANSCRIPT);
    mockCreateAiJob.mockResolvedValue(BASE_JOB);
    mockTranscriptOps.update.mockResolvedValue({});
    mockCompleteWithFallback.mockResolvedValue({
      text: JSON.stringify(AI_RESPONSE),
      usage: { inputTokens: 100, outputTokens: 200 },
      model: "claude-haiku-4-5-20251001",
    });
    mockUpdateJobStatus.mockResolvedValue({});

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );
    await generateSummary(MEETING_ID);

    // Verify job creation
    expect(mockCreateAiJob).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        type: "SUMMARY",
        tier: "API_HAIKU",
        projectId: PROJECT_ID,
      })
    );

    // Verify aiJobId linked to transcript
    expect(mockTranscriptOps.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { meetingId: MEETING_ID },
        data: { aiJobId: JOB_ID },
      })
    );

    // Verify AI provider was resolved and called
    expect(mockCompleteWithFallback).toHaveBeenCalledWith("SUMMARY",
      expect.objectContaining({
        system: expect.stringContaining("meeting summarizer"),
        prompt: BASE_TRANSCRIPT.rawTranscript,
        maxTokens: 2048,
      })
    );

    // Verify transcript updated with AI summary
    expect(mockTranscriptOps.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { meetingId: MEETING_ID },
        data: {
          summary: AI_RESPONSE.summary,
          keyDecisions: AI_RESPONSE.keyDecisions,
        },
      })
    );

    // Verify job status set to COMPLETED
    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      JOB_ID,
      expect.objectContaining({
        status: "COMPLETED",
        output: AI_RESPONSE,
      })
    );
  });

  it("marks job as FAILED when AI provider throws", async () => {
    mockTranscriptOps.findUnique.mockResolvedValue(BASE_TRANSCRIPT);
    mockCreateAiJob.mockResolvedValue(BASE_JOB);
    mockTranscriptOps.update.mockResolvedValue({});
    mockCompleteWithFallback.mockRejectedValue(new Error("API rate limit exceeded"));
    mockUpdateJobStatus.mockResolvedValue({});

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );
    await generateSummary(MEETING_ID);

    // Job should be created
    expect(mockCreateAiJob).toHaveBeenCalled();

    // Job status should be FAILED
    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      JOB_ID,
      expect.objectContaining({
        status: "FAILED",
        errorMessage: "API rate limit exceeded",
      })
    );

    // Transcript should NOT be updated with summary (only aiJobId)
    expect(mockTranscriptOps.update).toHaveBeenCalledTimes(1);
    expect(mockTranscriptOps.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { aiJobId: JOB_ID },
      })
    );
  });

  it("marks job as FAILED when AI returns invalid JSON", async () => {
    mockTranscriptOps.findUnique.mockResolvedValue(BASE_TRANSCRIPT);
    mockCreateAiJob.mockResolvedValue(BASE_JOB);
    mockTranscriptOps.update.mockResolvedValue({});
    mockCompleteWithFallback.mockResolvedValue({
      text: "This is not valid JSON",
      usage: { inputTokens: 50, outputTokens: 30 },
      model: "claude-haiku-4-5-20251001",
    });
    mockUpdateJobStatus.mockResolvedValue({});

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );
    await generateSummary(MEETING_ID);

    // Job status should be FAILED due to JSON parse error
    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      JOB_ID,
      expect.objectContaining({
        status: "FAILED",
        errorMessage: expect.stringContaining(""),
      })
    );
  });

  it("does not throw even when the outer try/catch fires", async () => {
    mockTranscriptOps.findUnique.mockRejectedValue(
      new Error("DB connection error")
    );

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );

    // Should not throw — fire-and-forget
    await expect(generateSummary(MEETING_ID)).resolves.toBeUndefined();
  });

  it("caps rawTranscript input to 8000 characters", async () => {
    const longTranscript = "가".repeat(10000);
    mockTranscriptOps.findUnique.mockResolvedValue({
      ...BASE_TRANSCRIPT,
      rawTranscript: longTranscript,
    });
    mockCreateAiJob.mockResolvedValue(BASE_JOB);
    mockTranscriptOps.update.mockResolvedValue({});
    mockCompleteWithFallback.mockResolvedValue({
      text: JSON.stringify(AI_RESPONSE),
      usage: { inputTokens: 100, outputTokens: 200 },
      model: "claude-haiku-4-5-20251001",
    });
    mockUpdateJobStatus.mockResolvedValue({});

    const { generateSummary } = await import(
      "../../lib/services/meeting-summary"
    );
    await generateSummary(MEETING_ID);

    // AI prompt should be capped at 8000 chars
    expect(mockCompleteWithFallback).toHaveBeenCalledWith("SUMMARY",
      expect.objectContaining({
        prompt: longTranscript.slice(0, 8000),
      })
    );

    // Job input should also be capped
    expect(mockCreateAiJob).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          rawTranscript: longTranscript.slice(0, 8000),
        }),
      })
    );
  });
});
