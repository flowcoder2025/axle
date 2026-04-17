import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (must use vi.hoisted for factory-based mocking) ---

const { mockAiJob } = vi.hoisted(() => {
  const mockAiJob = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  return { mockAiJob };
});

vi.mock("@axle/db", () => ({
  prisma: {
    aiJob: mockAiJob,
  },
}));

import {
  createAiJob,
  updateJobStatus,
  getJobResult,
  getJobsByProject,
} from "../src/job.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAiJob", () => {
  it("creates a job with QUEUED status and auto-resolved tier", async () => {
    const fakeJob = {
      id: "job-1",
      type: "BUSINESS_PLAN",
      tier: "CLI_CLAUDE",
      status: "QUEUED",
      input: { prompt: "hello" },
    };
    mockAiJob.create.mockResolvedValue(fakeJob);

    const result = await createAiJob({
      orgId: "org-1",
      type: "BUSINESS_PLAN",
      input: { prompt: "hello" },
    });

    expect(mockAiJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-1",
        type: "BUSINESS_PLAN",
        tier: "CLI_CLAUDE",
        status: "QUEUED",
        input: { prompt: "hello" },
      }),
    });
    expect(result).toEqual(fakeJob);
  });

  it("respects an explicit tier override", async () => {
    const fakeJob = { id: "job-2", tier: "API_OPUS" };
    mockAiJob.create.mockResolvedValue(fakeJob);

    await createAiJob({
      orgId: "org-1",
      type: "BUSINESS_PLAN",
      input: {},
      tier: "API_OPUS",
    });

    expect(mockAiJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tier: "API_OPUS" }),
    });
  });

  it("sets projectId when provided", async () => {
    mockAiJob.create.mockResolvedValue({ id: "job-3" });

    await createAiJob({
      orgId: "org-1",
      type: "SUMMARY",
      input: {},
      projectId: "proj-1",
    });

    expect(mockAiJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: "org-1", projectId: "proj-1" }),
    });
  });

  it("auto-resolves to API_HAIKU for FINANCIAL_ANALYSIS", async () => {
    mockAiJob.create.mockResolvedValue({ id: "job-4", tier: "API_HAIKU" });

    await createAiJob({ orgId: "org-1", type: "FINANCIAL_ANALYSIS", input: {} });

    expect(mockAiJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tier: "API_HAIKU" }),
    });
  });
});

describe("updateJobStatus", () => {
  it("updates status only when no output/error provided", async () => {
    mockAiJob.update.mockResolvedValue({ id: "job-1", status: "RUNNING" });

    await updateJobStatus("job-1", { status: "RUNNING" });

    expect(mockAiJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "RUNNING" },
    });
  });

  it("includes output when provided", async () => {
    mockAiJob.update.mockResolvedValue({ id: "job-1", status: "COMPLETED" });

    await updateJobStatus("job-1", {
      status: "COMPLETED",
      output: { result: "done" },
      durationMs: 1200,
    });

    expect(mockAiJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "COMPLETED",
        output: { result: "done" },
        durationMs: 1200,
      },
    });
  });

  it("includes errorMessage when job fails", async () => {
    mockAiJob.update.mockResolvedValue({ id: "job-1", status: "FAILED" });

    await updateJobStatus("job-1", {
      status: "FAILED",
      errorMessage: "timeout",
    });

    expect(mockAiJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "FAILED", errorMessage: "timeout" },
    });
  });
});

describe("getJobResult", () => {
  it("returns job with output", async () => {
    const fakeJob = {
      id: "job-1",
      status: "COMPLETED",
      output: { text: "result" },
    };
    mockAiJob.findUnique.mockResolvedValue(fakeJob);

    const result = await getJobResult("job-1");

    expect(mockAiJob.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1" } })
    );
    expect(result).toEqual(fakeJob);
  });

  it("returns null when job not found", async () => {
    mockAiJob.findUnique.mockResolvedValue(null);
    const result = await getJobResult("nonexistent");
    expect(result).toBeNull();
  });
});

describe("getJobsByProject", () => {
  it("returns jobs ordered newest first", async () => {
    const fakeJobs = [
      { id: "job-2", createdAt: new Date("2024-02-01") },
      { id: "job-1", createdAt: new Date("2024-01-01") },
    ];
    mockAiJob.findMany.mockResolvedValue(fakeJobs);

    const result = await getJobsByProject("proj-1");

    expect(mockAiJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "proj-1" },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(result).toEqual(fakeJobs);
  });

  it("returns empty array when project has no jobs", async () => {
    mockAiJob.findMany.mockResolvedValue([]);
    const result = await getJobsByProject("proj-empty");
    expect(result).toEqual([]);
  });
});
