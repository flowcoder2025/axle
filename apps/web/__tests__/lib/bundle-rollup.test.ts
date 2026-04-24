/**
 * WI-322: BUNDLE rollup unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  computeChildProgress,
  computeBundleRollup,
  countChecklistDone,
  type RollupChildInput,
} from "@/lib/services/bundle-rollup";

function makeChild(over: Partial<RollupChildInput> = {}): RollupChildInput {
  return {
    id: "c1",
    title: "자식 프로젝트",
    type: "VENTURE_CERT",
    status: "IN_PROGRESS",
    checklistTotal: 0,
    checklistDone: 0,
    docsCount: 0,
    ...over,
  };
}

describe("computeChildProgress", () => {
  it("returns 100% when status is COMPLETED, regardless of checklist", () => {
    const result = computeChildProgress(
      makeChild({
        status: "COMPLETED",
        checklistTotal: 10,
        checklistDone: 2,
      }),
    );
    expect(result.progressPercent).toBe(100);
    expect(result.progressSource).toBe("completed");
  });

  it("uses checklist ratio when items exist and status is not COMPLETED", () => {
    const result = computeChildProgress(
      makeChild({
        status: "IN_PROGRESS",
        checklistTotal: 10,
        checklistDone: 3,
      }),
    );
    expect(result.progressPercent).toBe(30);
    expect(result.progressSource).toBe("checklist");
  });

  it("rounds checklist percentage to nearest integer", () => {
    // 2/3 = 66.67 → 67
    const result = computeChildProgress(
      makeChild({ checklistTotal: 3, checklistDone: 2 }),
    );
    expect(result.progressPercent).toBe(67);
  });

  it("falls back to status-derived percent when checklist is empty", () => {
    const result = computeChildProgress(
      makeChild({ status: "APPROVED", checklistTotal: 0 }),
    );
    expect(result.progressPercent).toBe(90);
    expect(result.progressSource).toBe("status-fallback");
  });

  it("returns 0% for INTAKE without checklist", () => {
    expect(
      computeChildProgress(makeChild({ status: "INTAKE" })).progressPercent,
    ).toBe(0);
  });

  it("returns 0% for REJECTED (no credit)", () => {
    expect(
      computeChildProgress(makeChild({ status: "REJECTED" })).progressPercent,
    ).toBe(0);
  });

  it("clamps checklist done above total to 100%", () => {
    // Defensive: shouldn't happen in practice but we tolerate bad inputs.
    const result = computeChildProgress(
      makeChild({ checklistTotal: 5, checklistDone: 10 }),
    );
    expect(result.progressPercent).toBe(100);
  });

  it("returns 0% when checklistTotal is 0 and checklistDone is 0 with INTAKE", () => {
    expect(
      computeChildProgress(
        makeChild({ status: "INTAKE", checklistTotal: 0, checklistDone: 0 }),
      ).progressPercent,
    ).toBe(0);
  });
});

describe("computeBundleRollup", () => {
  it("returns zeroed aggregate for empty children array", () => {
    const { children, aggregate } = computeBundleRollup([]);
    expect(children).toEqual([]);
    expect(aggregate).toEqual({
      avgProgress: 0,
      completedCount: 0,
      totalCount: 0,
      allCompleted: false,
    });
  });

  it("computes average progress across heterogeneous children", () => {
    const { aggregate } = computeBundleRollup([
      makeChild({ id: "a", status: "COMPLETED" }), // 100
      makeChild({ id: "b", status: "IN_PROGRESS", checklistTotal: 10, checklistDone: 5 }), // 50
      makeChild({ id: "c", status: "INTAKE" }), // 0
    ]);
    // (100 + 50 + 0) / 3 = 50
    expect(aggregate.avgProgress).toBe(50);
    expect(aggregate.totalCount).toBe(3);
    expect(aggregate.completedCount).toBe(1);
    expect(aggregate.allCompleted).toBe(false);
  });

  it("flags allCompleted when every child is COMPLETED", () => {
    const { aggregate } = computeBundleRollup([
      makeChild({ id: "a", status: "COMPLETED" }),
      makeChild({ id: "b", status: "COMPLETED" }),
    ]);
    expect(aggregate.avgProgress).toBe(100);
    expect(aggregate.allCompleted).toBe(true);
    expect(aggregate.completedCount).toBe(2);
  });

  it("does not flag allCompleted for a single non-COMPLETED child", () => {
    const { aggregate } = computeBundleRollup([
      makeChild({ status: "APPROVED" }),
    ]);
    expect(aggregate.allCompleted).toBe(false);
  });

  it("attaches progress to each child in the output", () => {
    const { children } = computeBundleRollup([
      makeChild({ id: "a", status: "COMPLETED" }),
      makeChild({
        id: "b",
        status: "IN_PROGRESS",
        checklistTotal: 4,
        checklistDone: 1,
      }),
    ]);
    expect(children[0].progressPercent).toBe(100);
    expect(children[0].progressSource).toBe("completed");
    expect(children[1].progressPercent).toBe(25);
    expect(children[1].progressSource).toBe("checklist");
  });
});

describe("countChecklistDone", () => {
  it("counts only VERIFIED items as done", () => {
    const count = countChecklistDone([
      { status: "PENDING" },
      { status: "REQUESTED" },
      { status: "UPLOADED" },
      { status: "VERIFIED" },
      { status: "VERIFIED" },
    ]);
    expect(count).toBe(2);
  });

  it("returns 0 for empty input", () => {
    expect(countChecklistDone([])).toBe(0);
  });

  it("does not count UPLOADED (UI marks uploaded as pending verification)", () => {
    const count = countChecklistDone([
      { status: "UPLOADED" },
      { status: "UPLOADED" },
    ]);
    expect(count).toBe(0);
  });
});
