import { describe, it, expect } from "vitest";
import { generateRagDraft } from "../../src/engines/rag-draft.js";
import { REQUIRED_SECTIONS } from "../../src/types.js";

describe("generateRagDraft", () => {
  const baseInput = {
    clientId: "client-001",
    programId: "GOV-2024-01",
    projectId: "project-001",
  };

  it("returns all required business plan sections", async () => {
    const result = await generateRagDraft(baseInput);

    const sectionTitles = result.sections.map((s) => s.title);
    for (const required of REQUIRED_SECTIONS) {
      expect(sectionTitles).toContain(required);
    }
  });

  it("returns exactly the 5 standard sections in order", async () => {
    const result = await generateRagDraft(baseInput);

    expect(result.sections).toHaveLength(5);
    expect(result.sections.map((s) => s.title)).toEqual([...REQUIRED_SECTIONS]);
  });

  it("returns metadata with sourceDocs array", async () => {
    const result = await generateRagDraft(baseInput);

    expect(result.metadata).toBeDefined();
    expect(Array.isArray(result.metadata.sourceDocs)).toBe(true);
  });

  it("section content contains phase placeholder marker", async () => {
    const result = await generateRagDraft(baseInput);

    for (const section of result.sections) {
      expect(section.content).toContain("[");
      expect(section.content.length).toBeGreaterThan(0);
    }
  });

  it("handles different input IDs independently", async () => {
    const resultA = await generateRagDraft({ ...baseInput, clientId: "c-A" });
    const resultB = await generateRagDraft({ ...baseInput, clientId: "c-B" });

    // Both should return the same section structure regardless of client
    expect(resultA.sections.map((s) => s.title)).toEqual(
      resultB.sections.map((s) => s.title)
    );
  });

  it("metadata sourceDocs is empty when RAG returns no results (Phase 6 stub)", async () => {
    const result = await generateRagDraft(baseInput);
    // Phase 6: stubs return empty arrays, so sourceDocs should be empty
    expect(result.metadata.sourceDocs).toHaveLength(0);
  });
});
