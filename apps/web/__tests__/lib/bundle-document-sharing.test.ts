/**
 * WI-323: BUNDLE 공통 서류 전파 plan 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeDocName,
  isMatchingDocName,
  planPropagation,
  type PropagationInputChild,
  type PropagationInputDocument,
} from "@/lib/services/bundle-document-sharing";

describe("normalizeDocName", () => {
  it("trims + lowercases + collapses spaces", () => {
    expect(normalizeDocName("  사업자 등록증  ")).toBe("사업자 등록증");
    expect(normalizeDocName("사업자  등록증")).toBe("사업자 등록증");
    expect(normalizeDocName("Business  Registration")).toBe(
      "business registration",
    );
  });

  it("treats spaces-only differences as same", () => {
    expect(normalizeDocName("사업자등록증")).toBe("사업자등록증");
  });
});

describe("isMatchingDocName", () => {
  it("returns true for exact and near-exact pairs", () => {
    expect(isMatchingDocName("사업자등록증", "사업자등록증")).toBe(true);
    expect(isMatchingDocName("사업자 등록증", "사업자  등록증")).toBe(true);
    expect(isMatchingDocName("Business Reg", "business reg")).toBe(true);
  });

  it("returns false when names differ semantically", () => {
    expect(isMatchingDocName("사업자등록증", "법인등기부등본")).toBe(false);
    expect(isMatchingDocName("발명신고서", "직무발명 승계 동의서")).toBe(false);
  });

  it("does not apply fuzzy matching (a partial substring is not a match)", () => {
    // Intentional: 퍼지 매칭은 오작동 위험이 커서 의도적으로 배제.
    expect(isMatchingDocName("사업자등록증", "사업자등록증 사본")).toBe(false);
  });
});

function makeChild(
  id: string,
  items: Array<{
    id: string;
    name: string;
    status?: "PENDING" | "REQUESTED" | "UPLOADED" | "VERIFIED";
    documentId?: string | null;
  }>,
): PropagationInputChild {
  return {
    id,
    checklistItems: items.map((i) => ({
      id: i.id,
      name: i.name,
      status: (i.status ?? "PENDING") as PropagationInputChild["checklistItems"][number]["status"],
      documentId: i.documentId ?? null,
    })),
  };
}

describe("planPropagation", () => {
  const doc = (id: string, name: string): PropagationInputDocument => ({
    id,
    name,
  });

  it("plans updates for every unlinked child item matching by name", () => {
    const plan = planPropagation(
      [doc("d1", "사업자등록증")],
      [
        makeChild("venture", [{ id: "i1", name: "사업자등록증" }]),
        makeChild("research", [{ id: "i2", name: "사업자등록증" }]),
        makeChild("patent", [{ id: "i3", name: "사업자등록증" }]),
      ],
    );
    expect(plan.updates).toHaveLength(3);
    expect(plan.updates.map((u) => u.checklistItemId).sort()).toEqual([
      "i1",
      "i2",
      "i3",
    ]);
    expect(plan.updates[0].toDocumentId).toBe("d1");
  });

  it("skips child items whose status is VERIFIED (preserves human verification)", () => {
    const plan = planPropagation(
      [doc("d1", "사업자등록증")],
      [
        makeChild("venture", [
          { id: "i1", name: "사업자등록증", status: "VERIFIED" },
        ]),
      ],
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.skippedBecauseVerified).toBe(1);
  });

  it("skips child items already linked to the same Document (idempotent)", () => {
    const plan = planPropagation(
      [doc("d1", "사업자등록증")],
      [
        makeChild("venture", [
          { id: "i1", name: "사업자등록증", status: "UPLOADED", documentId: "d1" },
        ]),
      ],
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.skippedBecauseAlreadyLinkedToSame).toBe(1);
  });

  it("skips child items already linked to a different Document (user override)", () => {
    const plan = planPropagation(
      [doc("d1", "사업자등록증")],
      [
        makeChild("venture", [
          {
            id: "i1",
            name: "사업자등록증",
            status: "UPLOADED",
            documentId: "other-doc",
          },
        ]),
      ],
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.skippedBecauseLinkedToOther).toBe(1);
  });

  it("counts parent documents that found no matching child item", () => {
    const plan = planPropagation(
      [doc("d1", "사업자등록증"), doc("d2", "한정된 서류")],
      [makeChild("venture", [{ id: "i1", name: "사업자등록증" }])],
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.noMatchInChildren).toBe(1);
  });

  it("returns an empty plan for empty inputs without error", () => {
    const plan = planPropagation([], []);
    expect(plan.updates).toEqual([]);
    expect(plan.noMatchInChildren).toBe(0);
  });

  it("handles multiple parent documents matching different items in one pass", () => {
    const plan = planPropagation(
      [doc("d1", "사업자등록증"), doc("d2", "법인등기부등본")],
      [
        makeChild("venture", [
          { id: "i1", name: "사업자등록증" },
          { id: "i2", name: "법인등기부등본" },
        ]),
        makeChild("research", [
          { id: "i3", name: "사업자등록증" },
          { id: "i4", name: "연구공간 사진" }, // unique, no match
        ]),
      ],
    );
    expect(plan.updates).toHaveLength(3);
    expect(plan.updates.map((u) => u.itemName).sort()).toEqual([
      "법인등기부등본",
      "사업자등록증",
      "사업자등록증",
    ]);
  });

  it("records whitespace/case differences as a successful match", () => {
    const plan = planPropagation(
      [doc("d1", "사업자  등록증")],
      [makeChild("venture", [{ id: "i1", name: "사업자 등록증" }])],
    );
    expect(plan.updates).toHaveLength(1);
  });

  it("does not mutate the input arrays", () => {
    const parent = [doc("d1", "사업자등록증")];
    const children = [
      makeChild("venture", [{ id: "i1", name: "사업자등록증" }]),
    ];
    const beforeParent = JSON.stringify(parent);
    const beforeChildren = JSON.stringify(children);
    planPropagation(parent, children);
    expect(JSON.stringify(parent)).toBe(beforeParent);
    expect(JSON.stringify(children)).toBe(beforeChildren);
  });
});
