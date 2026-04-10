import { describe, it, expect } from "vitest";
import {
  canTransition,
  getValidTransitions,
  getStatusLabel,
  VALID_TRANSITIONS,
} from "../../lib/services/project-state-machine";
import type { ProjectStatus } from "@prisma/client";

describe("canTransition", () => {
  it("allows INTAKE → DOC_COLLECTING", () => {
    expect(canTransition("INTAKE", "DOC_COLLECTING")).toBe(true);
  });

  it("allows DOC_COLLECTING → IN_PROGRESS", () => {
    expect(canTransition("DOC_COLLECTING", "IN_PROGRESS")).toBe(true);
  });

  it("allows IN_PROGRESS → REVIEW", () => {
    expect(canTransition("IN_PROGRESS", "REVIEW")).toBe(true);
  });

  it("allows REVIEW → SUBMITTED", () => {
    expect(canTransition("REVIEW", "SUBMITTED")).toBe(true);
  });

  it("allows SUBMITTED → APPROVED", () => {
    expect(canTransition("SUBMITTED", "APPROVED")).toBe(true);
  });

  it("allows SUBMITTED → REJECTED", () => {
    expect(canTransition("SUBMITTED", "REJECTED")).toBe(true);
  });

  it("allows APPROVED → COMPLETED", () => {
    expect(canTransition("APPROVED", "COMPLETED")).toBe(true);
  });

  it("allows REJECTED → IN_PROGRESS (retry)", () => {
    expect(canTransition("REJECTED", "IN_PROGRESS")).toBe(true);
  });

  it("disallows COMPLETED → anything (terminal state)", () => {
    const allStatuses = Object.keys(VALID_TRANSITIONS) as ProjectStatus[];
    for (const status of allStatuses) {
      expect(canTransition("COMPLETED", status)).toBe(false);
    }
  });

  it("disallows skipping states (INTAKE → IN_PROGRESS)", () => {
    expect(canTransition("INTAKE", "IN_PROGRESS")).toBe(false);
  });

  it("disallows backward transitions (REVIEW → INTAKE)", () => {
    expect(canTransition("REVIEW", "INTAKE")).toBe(false);
  });

  it("disallows APPROVED → REJECTED", () => {
    expect(canTransition("APPROVED", "REJECTED")).toBe(false);
  });

  it("disallows self-transition (INTAKE → INTAKE)", () => {
    expect(canTransition("INTAKE", "INTAKE")).toBe(false);
  });
});

describe("getValidTransitions", () => {
  it("returns correct next states for INTAKE", () => {
    expect(getValidTransitions("INTAKE")).toEqual(["DOC_COLLECTING"]);
  });

  it("returns two options for SUBMITTED", () => {
    const transitions = getValidTransitions("SUBMITTED");
    expect(transitions).toContain("APPROVED");
    expect(transitions).toContain("REJECTED");
    expect(transitions).toHaveLength(2);
  });

  it("returns empty array for COMPLETED", () => {
    expect(getValidTransitions("COMPLETED")).toEqual([]);
  });
});

describe("getStatusLabel", () => {
  it("returns Korean label for each status", () => {
    const cases: [ProjectStatus, string][] = [
      ["INTAKE", "접수"],
      ["DOC_COLLECTING", "서류 수집 중"],
      ["IN_PROGRESS", "진행 중"],
      ["REVIEW", "검토 중"],
      ["SUBMITTED", "제출 완료"],
      ["APPROVED", "승인"],
      ["REJECTED", "반려"],
      ["COMPLETED", "완료"],
    ];

    for (const [status, label] of cases) {
      expect(getStatusLabel(status)).toBe(label);
    }
  });
});
