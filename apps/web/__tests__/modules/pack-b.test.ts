import { describe, expect, it } from "vitest";
import { packB, packBModules } from "../../src/modules/pack-b-rd-support/index.js";

const ALLOWED_SCOPES = new Set([
  "programs:read",
  "matching:read",
  "journals:read",
  "platform:admin",
]);

describe("WI-623 Pack B — 정부 지원사업 (6 modules)", () => {
  it("packB declares 6 modules", () => {
    expect(packB.id).toBe("B");
    expect(packB.modules).toHaveLength(6);
  });

  it("packB module ids match the per-module config ids", () => {
    expect(packB.modules).toEqual(packBModules.map((m) => m.id));
  });

  it("matching depends on programs, ai-patterns-admin depends on matching", () => {
    const matching = packBModules.find((m) => m.id === "matching")!;
    const aiPatterns = packBModules.find((m) => m.id === "ai-patterns-admin")!;
    const checklist = packBModules.find((m) => m.id === "checklist-admin")!;
    expect(matching.deps.hard).toContain("programs");
    expect(aiPatterns.deps.hard).toContain("matching");
    expect(checklist.deps.hard).toContain("programs");
  });

  it("matching + journals are multiOrg", () => {
    const multi = packBModules.filter((m) => m.multiOrg).map((m) => m.id).sort();
    expect(multi).toEqual(["journals", "matching"]);
  });

  it("admin modules use platform:admin scope and admin=true", () => {
    const admins = packBModules.filter((m) => m.admin === true);
    expect(admins.map((m) => m.id).sort()).toEqual([
      "ai-patterns-admin",
      "checklist-admin",
      "hwpx-admin",
    ]);
    for (const m of admins) {
      expect(m.permission).toBe("platform:admin");
    }
  });

  it("permission scopes are drawn from the documented set", () => {
    for (const mod of packBModules) {
      expect(ALLOWED_SCOPES.has(mod.permission)).toBe(true);
    }
  });
});
