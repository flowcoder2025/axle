import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AiJobType } from "@prisma/client";
import {
  dispatch,
  getHandler,
  hasHandler,
  listRegisteredTypes,
  registerHandler,
  resetRegistry,
  registerBuiltinHandlers,
  UnknownJobTypeError,
  InvalidJobInputError,
  type AiJobHandler,
} from "../src/dispatcher/index.js";

// Provider fallback is invoked from the 5 text-based handlers. We mock it at
// module-level so handler tests exercise only the adapter shape.
vi.mock("../src/providers/index.js", async () => {
  const actual = await vi.importActual<typeof import("../src/providers/index.js")>(
    "../src/providers/index.js",
  );
  return {
    ...actual,
    completeWithFallback: vi.fn(async () => ({
      text: "mock-output",
      model: "mock-model",
      usage: { inputTokens: 10, outputTokens: 20 },
    })),
  };
});

// Engine handlers (evaluate, analyzeGaps) hit prisma. Mock the engines.
vi.mock("../src/evaluation/engine.js", async () => {
  const actual = await vi.importActual<typeof import("../src/evaluation/engine.js")>(
    "../src/evaluation/engine.js",
  );
  return {
    ...actual,
    evaluate: vi.fn(async () => ({
      criteria: [],
      totalScore: 7.5,
      grade: "B" as const,
      strengths: [],
      weaknesses: [],
      improvements: [],
    })),
  };
});

vi.mock("../src/diagnosis/gap-analyzer.js", () => ({
  analyzeGaps: vi.fn(async () => ({
    gaps: [],
    readiness: 80,
    summary: "mock-summary",
  })),
}));

describe("dispatcher registry", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("registers and retrieves a handler by type", () => {
    const handler: AiJobHandler = {
      type: "SUMMARY",
      run: async () => "ok",
    };
    registerHandler(handler);
    expect(hasHandler("SUMMARY")).toBe(true);
    expect(getHandler("SUMMARY")).toBe(handler);
  });

  it("lists only registered types", () => {
    registerHandler({ type: "SUMMARY", run: async () => null });
    registerHandler({ type: "RESEARCH", run: async () => null });
    const types = listRegisteredTypes().sort();
    expect(types).toEqual(["RESEARCH", "SUMMARY"]);
  });

  it("throws UnknownJobTypeError for unregistered type", () => {
    expect(() => getHandler("OCR" as AiJobType)).toThrow(UnknownJobTypeError);
  });

  it("dispatch() delegates to the handler and returns its output", async () => {
    const run = vi.fn(async (input: unknown) => ({ echoed: input }));
    registerHandler({ type: "SUMMARY", run });
    const result = await dispatch("SUMMARY", { foo: "bar" });
    expect(run).toHaveBeenCalledWith({ foo: "bar" });
    expect(result).toEqual({ echoed: { foo: "bar" } });
  });

  it("dispatch() throws UnknownJobTypeError for unknown type", async () => {
    await expect(dispatch("OCR" as AiJobType, {})).rejects.toBeInstanceOf(
      UnknownJobTypeError,
    );
  });

  it("resetRegistry() clears all handlers", () => {
    registerHandler({ type: "SUMMARY", run: async () => null });
    resetRegistry();
    expect(listRegisteredTypes()).toEqual([]);
  });

  it("registerBuiltinHandlers() registers all 10 AiJobTypes", () => {
    registerBuiltinHandlers();
    const types = listRegisteredTypes().sort();
    expect(types).toEqual(
      [
        "BUSINESS_PLAN",
        "EVALUATION",
        "FINANCIAL_ANALYSIS",
        "GAP_DIAGNOSIS",
        "JOURNAL_DRAFT",
        "MATCHING",
        "OCR",
        "RESEARCH",
        "SUMMARY",
        "TRANSCRIBE",
      ].sort(),
    );
  });
});

describe("built-in handlers — input validation", () => {
  beforeEach(() => {
    resetRegistry();
    registerBuiltinHandlers();
  });

  it("rejects non-object input", async () => {
    await expect(dispatch("SUMMARY", "not-an-object")).rejects.toBeInstanceOf(
      InvalidJobInputError,
    );
  });

  it("rejects missing required fields (SUMMARY.content)", async () => {
    await expect(dispatch("SUMMARY", {})).rejects.toBeInstanceOf(InvalidJobInputError);
  });

  it("rejects missing required fields (BUSINESS_PLAN needs clientId/programId/projectId)", async () => {
    await expect(
      dispatch("BUSINESS_PLAN", { clientId: "c1" }),
    ).rejects.toBeInstanceOf(InvalidJobInputError);
  });

  it("rejects invalid OCR input (empty base64)", async () => {
    await expect(
      dispatch("OCR", { imageBase64: "", mimeType: "image/png" }),
    ).rejects.toBeInstanceOf(InvalidJobInputError);
  });
});

describe("text-generation handlers — provider mocked", () => {
  beforeEach(() => {
    resetRegistry();
    registerBuiltinHandlers();
  });

  it("SUMMARY returns text+model from completeWithFallback", async () => {
    const result = (await dispatch("SUMMARY", { content: "some content" })) as {
      text: string;
      model: string;
    };
    expect(result).toEqual({ text: "mock-output", model: "mock-model" });
  });

  it("RESEARCH returns text+model from completeWithFallback", async () => {
    const result = (await dispatch("RESEARCH", { prompt: "what is X?" })) as {
      text: string;
      model: string;
    };
    expect(result.text).toBe("mock-output");
  });

  it("TRANSCRIBE cleans raw audioText", async () => {
    const result = (await dispatch("TRANSCRIBE", { audioText: "음 어 그래서" })) as {
      text: string;
    };
    expect(result.text).toBe("mock-output");
  });

  it("JOURNAL_DRAFT accepts activities", async () => {
    const result = (await dispatch("JOURNAL_DRAFT", {
      activities: "미팅 2건",
      date: "2026-04-21",
    })) as { text: string };
    expect(result.text).toBe("mock-output");
  });

  it("FINANCIAL_ANALYSIS accepts financials string", async () => {
    const result = (await dispatch("FINANCIAL_ANALYSIS", {
      financials: "매출 10억",
    })) as { text: string };
    expect(result.text).toBe("mock-output");
  });
});

describe("engine handlers — direct delegation", () => {
  beforeEach(() => {
    resetRegistry();
    registerBuiltinHandlers();
  });

  it("EVALUATION delegates to evaluate()", async () => {
    const result = (await dispatch("EVALUATION", {
      documentContent: "사업 개요...",
    })) as { grade: string; totalScore: number };
    expect(result.grade).toBe("B");
    expect(result.totalScore).toBe(7.5);
  });

  it("GAP_DIAGNOSIS delegates to analyzeGaps()", async () => {
    const result = (await dispatch("GAP_DIAGNOSIS", {
      clientId: "c1",
      programId: "p1",
    })) as { readiness: number };
    expect(result.readiness).toBe(80);
  });
});
